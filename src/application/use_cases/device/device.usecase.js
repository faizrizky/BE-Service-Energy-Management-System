const { prisma } = require("../../../frameworks/database/prismaClient");
const {
  setRelay,
  pingTelemetry,
  listCsDevices,
  getCsDevice,
  setReportInterval,
} = require("../../../frameworks/chirpstack/client");
const {
  parseRelayResponse,
  parseTelemetryResponse,
  isDevEui,
  normalizeDevEui,
  sameDevEui,
} = require("../../../frameworks/chirpstack/contract");
const {
  ensureCsDeviceRegistered,
  removeCsDevice,
  rollbackCsDevice,
  pushReportInterval,
} = require("../../../frameworks/chirpstack/deviceSync");
const { httpError } = require("../../../frameworks/helpers/httpError");
const { isDeviceOnline, getOnlineUntil } = require("./device-online.util");
const logger = require("../../../frameworks/helpers/logger");
const { config } = require("../../../config/config");

const {
  emitDeviceCreated,
  emitDeviceUpdated,
  emitDeviceDeleted,
  emitDeviceStatus,
  emitDeviceCommand,
} = require("../../../frameworks/webserver/socket-events");
const {
  enqueueRelayCommand,
} = require("../../../frameworks/queue/relayCommandQueue");

const MAX_HISTORY_RANGE_DAYS = 90;

const RELAY_WAKE_TIMEOUT_MS = 150000;

const RELAY_CONFIRM_WAIT_MS = 90000;

const RELAY_VERIFY_TIMEOUT_MS = 130000;

const RELAY_COMMAND_DEADLINE_MS = 30 * 60 * 1000;

const RELAY_RETRY_DELAY_MS = 5000;

const RELAY_OFFLINE_AFTER_ATTEMPTS = 1;

const LOCK_WAIT_POLL_MS = 2000;

const PING_TIMEOUT_MS = 120000;

const DEFAULT_TOPUP_FPORT = 112;

const DEVICE_BUSY_MESSAGE =
  "Device sedang memproses perintah lain (relay/telemetry), coba lagi sebentar";

const busyDevices = new Set();

/**
 * Ngecek device lagi dikunci sama perintah relay atau lagi diambil
 * telemetry-nya apa nggak.
 *
 * Dipake di: telemetryPollerJob.js → runTick (device yang lagi sibuk di-skip).
 */
function isDeviceBusy(deviceId) {
  return busyDevices.has(deviceId);
}

/**
 * Nyoba ngunci device (disimpen di memori). Balikin false kalo udah dikunci
 * proses lain.
 *
 * Dipake di: processRelayCommand (file ini).
 */
function acquireDeviceLock(deviceId) {
  if (busyDevices.has(deviceId)) return false;
  busyDevices.add(deviceId);
  return true;
}

/**
 * Ngelepas kunci device abis satu percobaan relay selesai.
 *
 * Dipake di: processRelayCommand (file ini).
 */
function releaseDeviceLock(deviceId) {
  busyDevices.delete(deviceId);
}

/**
 * Jalanin fungsi sambil device dikunci, dan kuncinya pasti dilepas lagi. Kalo
 * device lagi sibuk, lempar 409.
 *
 * Dipake di: fetchAndStoreTelemetry (file ini).
 */
async function withDeviceLock(deviceId, fn) {
  if (busyDevices.has(deviceId)) throw httpError(DEVICE_BUSY_MESSAGE, 409);
  busyDevices.add(deviceId);
  try {
    return await fn();
  } finally {
    busyDevices.delete(deviceId);
  }
}

/**
 * Ngambil device yang wajib udah nyambung ke ChirpStack: 404 kalo nggak ada,
 * 409 kalo devEUI-nya kosong.
 *
 * Dipake di: powerDevice, pingDevice, setDeviceInterval,
 *   getDeviceChirpstackMetadata (file ini).
 */
async function getLinkedDevice(deviceId) {
  const device = await prisma.device.findUnique({ where: { id: deviceId } });
  if (!device) throw httpError("Device tidak ditemukan", 404);
  if (!isDevEui(device.eui)) {
    throw httpError(
      "Device belum terhubung ke ChirpStack (devEUI kosong)",
      409,
    );
  }
  return device;
}

/**
 * Nentuin downlink boleh di-skip apa nggak karena relainya udah sesuai: status
 * di DB sama, telemetry masih fresh, dan perintah terakhir sukses (atau udah
 * ada telemetry baru abis perintah yang gagal).
 *
 * Dipake di: attemptRelayCommand (file ini).
 */
async function isRelayAlreadyInState(device, action, excludeCommandId = null) {
  if (device.status !== action) return false;
  if (!device.lastSeenAt) return false;

  const freshnessMs = device.intervalMinutes * 60 * 1000;
  if (Date.now() - device.lastSeenAt.getTime() >= freshnessMs) return false;

  const lastCommand = await prisma.commandLog.findFirst({
    where: {
      deviceId: device.id,
      action: { in: ["on", "off"] },
      status: { in: ["success", "failed", "cancelled"] },
      ...(excludeCommandId ? { id: { not: excludeCommandId } } : {}),
    },
    orderBy: { executedAt: "desc" },
  });
  if (!lastCommand || lastCommand.status === "success") return true;
  return device.lastSeenAt.getTime() > lastCommand.executedAt.getTime();
}

const UNIQUE_FIELD_LABEL = {
  eui: "devEUI",
};

/**
 * Ngubah error Prisma P2002 (nilai unik dobel) jadi 409 dengan nama field yang
 * gampang dipahami. Error lain dibalikin apa adanya.
 *
 * Dipake di: createDevice (file ini).
 */
function mapPrismaError(err) {
  if (err.code !== "P2002") return err;

  const target = err.meta?.target;
  const fields = Array.isArray(target) ? target : [target].filter(Boolean);
  const label = fields.map((f) => UNIQUE_FIELD_LABEL[f] || f).join(", ");

  return httpError(`${label || "Nilai unik"} sudah dipakai device lain`, 409);
}

/**
 * List device pake paginasi, bisa filter room, gateway, search (8 kolom), sama
 * tanggal, plus info perintah pending tiap device.
 *
 * Dipake di: device.controller.js → index (GET /api/devices).
 */
async function listDevicesPaginated({
  page = 1,
  rowsPerPage = 10,
  search,
  gatewayId,
  roomId,
  createdFrom,
  createdTo,
} = {}) {
  const andConditions = [];

  if (roomId) {
    andConditions.push({
      roomId,
    });
  }

  if (gatewayId) {
    andConditions.push({
      gatewayId,
    });
  }
  if (search) {
    andConditions.push({
      OR: [
        { name: { contains: search, mode: "insensitive" } },
        { roomId: { contains: search, mode: "insensitive" } },
        { gatewayId: { contains: search, mode: "insensitive" } },
        { eui: { contains: search, mode: "insensitive" } },
        { deviceType: { contains: search, mode: "insensitive" } },
        { room: { name: { contains: search, mode: "insensitive" } } },
        { gateway: { name: { contains: search, mode: "insensitive" } } },
      ],
    });
  }

  if (createdFrom || createdTo) {
    const createdAt = {};
    if (createdFrom) createdAt.gte = new Date(createdFrom);
    if (createdTo) {
      const end = new Date(createdTo);
      end.setHours(23, 59, 59, 999);
      createdAt.lte = end;
    }
    andConditions.push({ createdAt });
  }

  const where = andConditions.length ? { AND: andConditions } : undefined;

  const [totalRows, devices] = await Promise.all([
    prisma.device.count({ where }),
    prisma.device.findMany({
      where,
      include: { room: true, gateway: true },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * rowsPerPage,
      take: rowsPerPage,
    }),
  ]);

  const [pendingByDevice, csDevices] = await Promise.all([
    getPendingCommandsByDevice(devices.map((d) => d.id)),
    fetchChirpstackDevices(),
  ]);

  return {
    data: devices.map((d) => ({
      ...d,
      pendingCommand: pendingByDevice.get(d.id) ?? null,
      isOnline: isDeviceOnline(d),
      onlineUntil: getOnlineUntil(d),
      chirpstack: toChirpstackInfo(d, csDevices),
    })),
    page,
    rowsPerPage,
    totalRows,
    totalPages: Math.max(1, Math.ceil(totalRows / rowsPerPage)),
  };
}

/**
 * Ambil daftar device dari ChirpStack (sekali panggil buat satu halaman), terus
 * rapihin jadi Map devEUI (huruf kecil) → { name, deviceProfileId, lastSeenAt }.
 * Kalo middleware lagi mati, balikin null (bukan Map kosong) biar nggak salah
 * ngaku device-nya belom kedaftar.
 *
 * Dipake di: listDevicesPaginated, getDeviceById (file ini).
 */
async function fetchChirpstackDevices() {
  try {
    const raw = await listCsDevices();
    const rows = raw?.data?.result ?? [];

    return new Map(
      rows.map((row) => [
        String(row.devEui || "").toLowerCase(),
        {
          name: row.name ?? null,
          deviceProfileId: row.deviceProfileId ?? null,
          lastSeenAt: row.lastSeenAt ?? null,
        },
      ]),
    );
  } catch (err) {
    logger.warn(
      `[Device] Gagal ambil data device dari ChirpStack: ${err.message}`,
    );
    return null;
  }
}

/**
 * Data ChirpStack buat satu device: terdaftar apa nggak, namanya di ChirpStack,
 * sama kapan terakhir kedengeran di sana.
 *
 * Dipake di: listDevicesPaginated, getDeviceById (file ini).
 */
function toChirpstackInfo(device, csDevices) {
  if (!isDevEui(device.eui) || !csDevices) return null;

  const cs = csDevices.get(String(device.eui).toLowerCase());
  if (!cs) return { registered: false, name: null, lastSeenAt: null };

  return {
    registered: true,
    name: cs.name,
    deviceProfileId: cs.deviceProfileId,
    lastSeenAt: cs.lastSeenAt,
  };
}

/**
 * Detail device plus room, gateway, sama perintah pending-nya. Balikin null
 * kalo nggak ketemu.
 *
 * Dipake di: device.controller.js → show (GET /api/devices/:id).
 */
async function getDeviceById(id) {
  const device = await prisma.device.findUnique({
    where: { id },
    include: { room: true, gateway: true },
  });
  if (!device) return null;

  const [pendingByDevice, csDevices] = await Promise.all([
    getPendingCommandsByDevice([id]),
    fetchChirpstackDevices(),
  ]);
  return {
    ...device,
    pendingCommand: pendingByDevice.get(id) ?? null,
    isOnline: isDeviceOnline(device),
    onlineUntil: getOnlineUntil(device),
    chirpstack: toChirpstackInfo(device, csDevices),
  };
}

/**
 * Nyimpen device baru. Kalo devEUI diisi, daftarin ke ChirpStack (data di DB
 * dihapus lagi kalo gagal) terus kirim interval laporan ke meter. Abis itu
 * ngirim event socket device:created.
 *
 * Dipake di: device.controller.js → store (POST /api/devices).
 */
async function createDevice(data) {
  const devEui = normalizeDevEui(data.eui) ?? null;

  let device;
  try {
    device = await prisma.device.create({
      data: {
        eui: devEui,
        name: data.name,
        deviceType: data.deviceType,
        intervalMinutes: data.intervalMinutes || 15,
        roomId: data.roomId,
        gatewayId: data.gatewayId,
      },
    });
  } catch (err) {
    throw mapPrismaError(err);
  }

  if (device.eui) {
    try {
      await ensureCsDeviceRegistered(device.eui, {
        name: device.name,
        description: device.deviceType || "",
        updateIfExists: false,
      });
    } catch (err) {
      await prisma.device.delete({ where: { id: device.id } });
      throw err;
    }

    await pushReportInterval(device.eui, device.intervalMinutes);
  }

  emitDeviceCreated(device);
  return device;
}

/**
 * Ngedit device: sinkronin nama/devEUI ke ChirpStack, simpen ke DB, kirim
 * ulang interval kalo interval atau devEUI-nya ganti, terus ngirim event
 * device:updated.
 *
 * Dipake di: device.controller.js → update (PUT /api/devices/:id).
 */
async function updateDevice(id, data) {
  const existing = await prisma.device.findUnique({ where: { id } });
  if (!existing) throw httpError("Device tidak ditemukan", 404);

  const nextDevEui = normalizeDevEui(data.eui);
  const targetDevEui = nextDevEui === undefined ? existing.eui : nextDevEui;
  const nextName = data.name ?? existing.name;
  const nextDeviceType =
    data.deviceType === undefined ? existing.deviceType : data.deviceType;

  if (targetDevEui) {
    await ensureCsDeviceRegistered(targetDevEui, {
      name: nextName,
      description: nextDeviceType || "",
    });
  }

  const devEuiChanged = !sameDevEui(existing.eui, targetDevEui);

  if (existing.eui && devEuiChanged) {
    logger.info(
      `[Device] ${id}: devEUI ${existing.eui} dilepas dari EMS. ` +
        "Device tetap ada di ChirpStack, hapus manual bila memang tidak dipakai.",
    );
  }

  const device = await prisma.device.update({
    where: { id },
    data: {
      name: data.name,
      eui: nextDevEui,
      deviceType: data.deviceType,
      intervalMinutes: data.intervalMinutes,
      roomId: data.roomId,
      gatewayId: data.gatewayId,
    },
  });

  const intervalChanged =
    data.intervalMinutes !== undefined &&
    Number(data.intervalMinutes) !== existing.intervalMinutes;

  if (device.eui && (intervalChanged || devEuiChanged)) {
    await pushReportInterval(device.eui, device.intervalMinutes);
  }

  emitDeviceUpdated(device);
  return device;
}

/**
 * Hapus device dari ChirpStack dulu, baru dari DB dalam satu transaksi:
 * reading dihapus, CommandLog & Schedule dilepas dari device-nya. Terus ngirim
 * event device:deleted.
 *
 * Dipake di: device.controller.js → destroy (DELETE /api/devices/:id).
 */
async function deleteDevice(id) {
  const existing = await prisma.device.findUnique({
    where: { id },
    select: { id: true, eui: true, name: true },
  });

  if (!existing) throw httpError("Device tidak ditemukan", 404);

  if (isDevEui(existing.eui)) {
    await removeCsDevice(existing.eui);
  }

  return deleteDeviceLocally(id);
}

/**
 * Riwayat perintah cuma dilepas kaitannya (bukan dihapus) biar catatannya
 * nggak ilang. Schedule sekarang level room, jadi hapus device gak nyentuh
 * tabel schedule sama sekali.
 *
 * Dipake di: deleteDevice, syncDevicesFromChirpstack (file ini).
 */
async function deleteDeviceLocally(id) {
  const deleted = await prisma.$transaction(async (tx) => {
    await tx.energyReading.deleteMany({ where: { deviceId: id } });
    await tx.commandLog.updateMany({
      where: { deviceId: id },
      data: { deviceId: null },
    });

    return tx.device.delete({ where: { id } });
  });

  emitDeviceDeleted(deleted.id);
  return deleted;
}

/**
 * Daftarin ke EMS device yang ada di ChirpStack tapi belom ada di database.
 * Cuma nyatet, nggak ngirim apa-apa ke meter. Device masuk ke room "Belum
 * Dialokasikan" tanpa gateway; room & gateway-nya diisi nanti lewat menu edit.
 *
 * Dipake di: syncDevicesFromChirpstack (file ini).
 */
async function createMissingDevicesFromChirpstack(csDevices, knownEuis) {
  const missing = [...csDevices].filter(
    ([eui]) => isDevEui(eui) && !knownEuis.has(eui),
  );
  if (!missing.length) return 0;

  let created = 0;

  for (const [eui, cs] of missing) {
    try {
      const device = await prisma.device.create({
        data: {
          eui,
          name: cs.name || eui,
        },
        include: { room: true, gateway: true },
      });
      emitDeviceCreated(device);
      created += 1;
      logger.info(
        `[Device] "${device.name}" (${eui}) didaftarkan otomatis oleh sistem`,
      );
    } catch (err) {
      if (err.code === "P2002") continue;
      logger.warn(`[Device] Gagal didaftarkan ${eui}: ${err.message}`);
    }
  }

  return created;
}

/**
 * Samain daftar device EMS sama ChirpStack: device yang devEUI-nya udah nggak
 * ada di ChirpStack ikut dihapus dari EMS.
 *
 * Pengamannya: kalo middleware nggak bisa dihubungi atau daftarnya kosong,
 * nggak ada yang dihapus (takutnya middleware lagi error). Device yang belom
 * punya devEUI juga dilewat, soalnya emang cuma ada di EMS.
 *
 * Dipake di: gatewaySyncJob.js (tiap menit).
 */
async function syncDevicesFromChirpstack() {
  const csDevices = await fetchChirpstackDevices();
  if (!csDevices || !csDevices.size)
    return { checked: 0, deleted: 0, created: 0 };

  const devices = await prisma.device.findMany({
    where: { eui: { not: "" } },
  });
  const knownEuis = new Set(
    devices.map((d) => String(d.eui).toLocaleLowerCase()),
  );

  let deleted = 0;
  let created = 0;

  for (const device of devices) {
    if (!isDevEui(device.eui)) continue;
    if (csDevices.has(String(device.eui).toLowerCase())) continue;

    if (!config.chirpstack.syncDelete) {
      logger.warn(
        `[Device] "${device.name}" (${device.eui}) udah nggak ada di ChirpStack, tapi penghapusan otomatis dimatiin`,
      );
      continue;
    }

    await deleteDeviceLocally(device.id);
    deleted += 1;
    logger.info(
      `[Device] "${device.name}" (${device.eui}) dihapus dari EMS karena udah nggak ada di ChirpStack`,
    );
  }

  if (config.chirpstack.syncCreate) {
    created = await createMissingDevicesFromChirpstack(csDevices, knownEuis);
  }

  return { checked: devices.length, deleted, created };
}

/**
 * Nunggu selama ms milidetik.
 *
 * Dipake di: processRelayCommand (jeda antar-retry & nunggu kunci device).
 */
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Ngitung batas waktu perintah relay: waktu request + 30 menit.
 *
 * Dipake di: toPendingCommand, toCommandEvent, attemptRelayCommand,
 *   processRelayCommand (file ini).
 */
function commandDeadline(command) {
  return new Date(command.executedAt.getTime() + RELAY_COMMAND_DEADLINE_MS);
}

const relayAttemptByCommand = new Map();

/**
 * Simpen progres percobaan downlink satu perintah. state null artinya
 * perintahnya udah kelar (sukses/gagal/digantikan).
 *
 * Dipake di: processRelayCommand (file ini).
 */
function setRelayAttempt(commandId, state) {
  if (state) relayAttemptByCommand.set(commandId, state);
  else relayAttemptByCommand.delete(commandId);
}

/**
 * Bentuk progres percobaan downlink buat frontend. maxAttempts null soalnya
 * perintah relay dicoba terus sampai batas 30 menit, bukan sekian kali.
 *
 * Dipake di: toPendingCommand, toCommandEvent (file ini).
 */
function toRelayAttempt(commandId) {
  const state = relayAttemptByCommand.get(commandId);
  if (!state) return null;

  return {
    attempt: state.attempt,
    maxAttempts: null,
    nextRetryAt: state.nextRetryAt ? state.nextRetryAt.toISOString() : null,
  };
}

/**
 * Bikin data ringkes perintah pending (id, action, notes, requestedAt,
 * deadline, progres percobaan) buat response API.
 *
 * Dipake di: getPendingCommandsByDevice (file ini).
 */
function toPendingCommand(command) {
  return {
    id: command.id,
    action: command.action,
    notes: command.notes,
    requestedAt: command.executedAt,
    deadline: commandDeadline(command),
    resync: toRelayAttempt(command.id),
  };
}

/**
 * Bikin payload event socket device:command, sekalian dipake jadi response API
 * perintah power.
 *
 * Dipake di: requestRelayCommand, updatePendingCommand
 *   (file ini).
 */
function toCommandEvent(command, deviceName = null) {
  return {
    commandId: command.id,
    deviceId: command.deviceId,
    deviceName,
    roomId: command.roomId,
    action: command.action,
    status: command.status,
    notes: command.notes,
    requestedAt: command.executedAt.toISOString(),
    deadline: commandDeadline(command).toISOString(),
    resync: toRelayAttempt(command.id),
    timestamp: new Date().toISOString(),
  };
}

/**
 * Ngambil perintah relay yang masih pending buat sekumpulan device, hasilnya
 * Map deviceId → perintah terbaru.
 *
 * Dipake di:
 * - listDevicesPaginated, getDeviceById (file ini)
 * - room.usecase.js → listRoomsPaginated, getRoomById, listDevicesInRoom.
 */
async function getPendingCommandsByDevice(deviceIds) {
  if (!deviceIds.length) return new Map();

  const commands = await prisma.commandLog.findMany({
    where: { deviceId: { in: deviceIds }, status: "pending" },
    orderBy: { executedAt: "asc" },
  });

  return new Map(commands.map((c) => [c.deviceId, toPendingCommand(c)]));
}

/**
 * Ubah status/notes CommandLog cuma kalo masih pending (biar nggak tabrakan
 * sama pembatalan), terus ngirim event device:command. Balikin true kalo ada
 * yang keubah.
 *
 * Dipake di: requestRelayCommand, completeRelayCommand,
 *   attemptRelayCommand, processRelayCommand, failRelayCommand (file ini).
 */
async function updatePendingCommand(command, data, deviceName) {
  const { count } = await prisma.commandLog.updateMany({
    where: { id: command.id, status: "pending" },
    data,
  });
  if (count > 0) {
    emitDeviceCommand(toCommandEvent({ ...command, ...data }, deviceName));
  }
  return count > 0;
}

/**
 * Bikin perintah ON/OFF: batalin perintah pending sebelumnya, simpen
 * CommandLog pending, kirim event, terus masukin ke antrean BullMQ. Device
 * yang belom punya devEUI langsung dicatet gagal.
 *
 * Perintah dengan aksi yang sama yang masih pending dipake ulang (dari user)
 * atau dicatet "skipped" (dari scheduler), biar downlink nggak dobel.
 *
 * Dipake di:
 * - powerDevice (file ini)
 * - room.usecase.js → powerRoom.
 */
async function requestRelayCommand(device, action, options = {}) {
  const { userId = null, scheduleId = null, skipIfOffline = false } = options;
  const base = {
    roomId: device.roomId,
    deviceId: device.id,
    action,
    triggerType: scheduleId ? "scheduled" : "manual",
    triggeredByUserId: userId,
    scheduleId,
  };

  if (!isDeviceOnline(device)) {
    if (!skipIfOffline) {
      throw httpError(
        "Device sedang offline (belum ada laporan dari meter), perintah tidak dikirim",
        409,
      );
    }

    const skipped = await prisma.commandLog.create({
      data: {
        ...base,
        status: "skipped",
        notes:
          "Device offline (belum ada laporan dari meter), perintah tidak dikirim",
      },
    });
    const skippedEvent = toCommandEvent(skipped, device.name);
    emitDeviceCommand(skippedEvent);
    return skippedEvent;
  }

  if (!isDevEui(device.eui)) {
    const failed = await prisma.commandLog.create({
      data: {
        ...base,
        status: "failed",
        notes: "Device belum terhubung ke ChirpStack (devEUI kosong)",
      },
    });
    const event = toCommandEvent(failed, device.name);
    emitDeviceCommand(event);
    return event;
  }

  const previous = await prisma.commandLog.findMany({
    where: { deviceId: device.id, status: "pending" },
    orderBy: { executedAt: "asc" },
  });

  const sameAction = previous.find((command) => command.action === action);
  if (sameAction) {
    if (!scheduleId) return toCommandEvent(sameAction, device.name);

    const skipped = await prisma.commandLog.create({
      data: {
        ...base,
        status: "skipped",
        notes: `Perintah ${action.toUpperCase()} yang sama masih berjalan, downlink nggak dikirim ulang`,
      },
    });
    const skippedEvent = toCommandEvent(skipped, device.name);
    emitDeviceCommand(skippedEvent);
    return skippedEvent;
  }

  for (const command of previous) {
    await updatePendingCommand(
      command,
      {
        status: "cancelled",
        notes: `Digantikan perintah ${action.toUpperCase()} yang lebih baru`,
      },
      device.name,
    );
  }

  const command = await prisma.commandLog.create({
    data: {
      ...base,
      status: "pending",
      notes: "Menunggu meter bangun untuk menerima perintah",
    },
  });
  emitDeviceCommand(toCommandEvent(command, device.name));

  try {
    await enqueueRelayCommand(command.id);
  } catch (err) {
    logger.error(`[Relay] Gagal enqueue command ${command.id}: ${err.message}`);
    const data = {
      status: "failed",
      notes: `Gagal memasukkan perintah ke antrean: ${err.message}`,
    };
    await updatePendingCommand(command, data, device.name);
    return toCommandEvent({ ...command, ...data }, device.name);
  }

  return toCommandEvent(command, device.name);
}

/**
 * Pintu masuk perintah ON/OFF satu device: pastiin device-nya ada & udah
 * nyambung ChirpStack, baru bikin perintahnya.
 *
 * Dipake di:
 * - device.controller.js → power (POST /api/devices/:id/power)
 * - scheduleWorker.js → processMinute (pas schedule jalan).
 */
async function powerDevice(deviceId, action, options = {}) {
  const device = await getLinkedDevice(deviceId);
  return requestRelayCommand(device, action, options);
}

/**
 * Nandain perintah sukses: update status device, kirim event device:status,
 * terus set CommandLog jadi success. Status device tetep di-update walaupun
 * perintahnya sempet dibatalin, soalnya relai fisiknya emang udah pindah.
 *
 * Dipake di: attemptRelayCommand (file ini).
 */
async function completeRelayCommand(command, device, notes) {
  const updated = await prisma.device.update({
    where: { id: device.id },
    data: { status: command.action },
  });
  emitDeviceStatus({
    deviceId: updated.id,
    eui: updated.eui,
    roomId: updated.roomId,
    status: updated.status,
    source: "command",
    timestamp: new Date().toISOString(),
  });
  await updatePendingCommand(
    command,
    { status: "success", notes },
    device.name,
  );
}

/**
 * Baca status relai yang asli dari telemetry meter. Balikin null kalo gagal.
 *
 * Dipake di: attemptRelayCommand (buat verifikasi pas konfirmasi relay nggak
 *   nyampe).
 */
async function readRelayStateViaTelemetry(device) {
  try {
    const { telemetry } = await runTelemetryFetch(device, {
      timeout: RELAY_VERIFY_TIMEOUT_MS,
    });
    return telemetry.relayStatus;
  } catch (err) {
    logger.warn(
      `[Relay] Verifikasi telemetry ${device.eui} gagal: ${err.message}`,
    );
    return null;
  }
}

/**
 * Ngecek error-nya 408 gara-gara meter nggak bangun (artinya perintah belom
 * nyampe ke meter).
 *
 * Dipake di: attemptRelayCommand (buat nentuin perlu cek telemetry dulu atau
 *   langsung retry).
 */
function isWakeTimeout(err) {
  return err.status === 408 && /wake/i.test(err.message);
}

/**
 * Satu kali nyoba kirim relay: skip kalo relai udah sesuai, kirim wake + relay
 * ke ChirpStack, cek lewat telemetry kalo konfirmasinya ilang, dan catet
 * progresnya. Balikin true kalo perintahnya udah beres.
 *
 * Dipake di: processRelayCommand (file ini).
 */
async function attemptRelayCommand(command, device, attempt) {
  if (await isRelayAlreadyInState(device, command.action, command.id)) {
    await completeRelayCommand(
      command,
      device,
      "Relai sudah dalam keadaan yang diminta, downlink dilewati",
    );
    return true;
  }

  await updatePendingCommand(
    command,
    {
      notes:
        attempt === 1
          ? "Mengirim perintah, menunggu meter bangun"
          : `Percobaan ke-${attempt}: menunggu meter bangun`,
    },
    device.name,
  );

  const remainingMs = commandDeadline(command).getTime() - Date.now();
  let reason;
  let mayHaveReachedMeter = true;

  try {
    const raw = await setRelay(device.eui, command.action === "on", {
      wakeTimeout: Math.max(
        10000,
        Math.min(RELAY_WAKE_TIMEOUT_MS, remainingMs),
      ),
      relayTimeout: RELAY_CONFIRM_WAIT_MS,
    });
    if (parseRelayResponse(raw).confirmed) {
      await completeRelayCommand(
        command,
        device,
        attempt > 1 ? `Berhasil pada percobaan ke-${attempt}` : null,
      );
      return true;
    }
    reason = "relay belum terkonfirmasi oleh meter";
  } catch (err) {
    reason = err.message;
    mayHaveReachedMeter = !isWakeTimeout(err);
  }

  if (mayHaveReachedMeter) {
    const actual = await readRelayStateViaTelemetry(device);
    if (actual === command.action) {
      await completeRelayCommand(
        command,
        device,
        "Terkonfirmasi lewat telemetry",
      );
      return true;
    }
  }

  const latest = await prisma.device.findUnique({ where: { id: device.id } });
  const noUplinkSinceCommand =
    !latest ||
    !latest.lastSeenAt ||
    latest.lastSeenAt.getTime() <= command.executedAt.getTime();
  if (attempt >= RELAY_OFFLINE_AFTER_ATTEMPTS && noUplinkSinceCommand) {
    await prisma.device.update({
      where: { id: device.id },
      data: { commFailedAt: new Date() },
    });
    emitDeviceStatus({
      deviceId: device.id,
      eui: device.eui,
      roomId: device.roomId,
      status: device.status,
      online: false,
      source: "command",
      timestamp: new Date().toISOString(),
    });
  }

  logger.warn(
    `[Relay] ${device.eui} ${command.action.toUpperCase()} percobaan ke-${attempt} gagal: ${reason}`,
  );
  await updatePendingCommand(
    command,
    {
      notes: `Percobaan ke-${attempt} belum berhasil (${reason}), mencoba lagi`,
    },
    device.name,
  );
  return false;
}

/**
 * Ngerjain satu perintah dari antrean: coba terus sampe berhasil,
 * dibatalin/diganti perintah baru, atau lewat batas 30 menit. Kalo device lagi
 * dipake telemetry, nunggu giliran dulu.
 *
 * Dipake di: app.js → startRelayCommandWorker(processRelayCommand) (worker
 *   BullMQ relay-command).
 */
async function processRelayCommand(commandId) {
  let attempt = 0;

  try {
    await runRelayCommandLoop(commandId, () => (attempt += 1));
  } finally {
    setRelayAttempt(commandId, null);
  }
}

/**
 * Isi loop perintah relay: ambil perintah, cek deadline, rebut kunci device,
 * coba kirim downlink, ulangi sampai berhasil atau kelewat batas waktu.
 *
 * Dipake di: processRelayCommand (file ini).
 */
async function runRelayCommandLoop(commandId, nextAttempt) {
  for (;;) {
    const command = await prisma.commandLog.findUnique({
      where: { id: commandId },
    });
    if (!command || command.status !== "pending") return;

    const device = command.deviceId
      ? await prisma.device.findUnique({ where: { id: command.deviceId } })
      : null;
    if (!device || !isDevEui(device.eui)) {
      await updatePendingCommand(
        command,
        {
          status: "failed",
          notes: device
            ? "Device belum terhubung ke ChirpStack (devEUI kosong)"
            : "Device sudah dihapus",
        },
        device?.name,
      );
      return;
    }

    if (!isDeviceOnline(device)) {
      await updatePendingCommand(
        command,
        {
          status: "failed",
          notes:
            "Device offline (meter berhenti melapor), perintah dihentikan. " +
            "Coba lagi setelah meter kembali online.",
        },
        device.name,
      );
      return;
    }

    if (Date.now() >= commandDeadline(command).getTime()) {
      await updatePendingCommand(
        command,
        {
          status: "failed",
          notes:
            `Meter tidak merespons selama ${RELAY_COMMAND_DEADLINE_MS / 60000} menit. ` +
            "Cek daya meter dan jangkauan gateway di lapangan.",
        },
        device.name,
      );
      return;
    }

    if (!acquireDeviceLock(device.id)) {
      await sleep(LOCK_WAIT_POLL_MS);
      continue;
    }

    let done;
    const attempt = nextAttempt();
    try {
      setRelayAttempt(commandId, { attempt, nextRetryAt: null });
      done = await attemptRelayCommand(command, device, attempt);
    } finally {
      releaseDeviceLock(device.id);
    }
    if (done) return;

    setRelayAttempt(commandId, {
      attempt,
      nextRetryAt: new Date(Date.now() + RELAY_RETRY_DELAY_MS),
    });
    emitDeviceCommand(
      toCommandEvent({ ...command, notes: command.notes }, device.name),
    );
    await sleep(RELAY_RETRY_DELAY_MS);
  }
}

/**
 * Nandain perintah gagal kalo job antrean error terus sampe attempt terakhir
 * (misal database lagi down).
 *
 * Dipake di: app.js → callback onFailed di startRelayCommandWorker.
 */
async function failRelayCommand(commandId, err) {
  const command = await prisma.commandLog.findUnique({
    where: { id: commandId },
  });
  if (!command) return;
  await updatePendingCommand(command, {
    status: "failed",
    notes: `Proses perintah error: ${err.message}`,
  });
}

/**
 * Masukin lagi semua perintah pending ke antrean abis backend restart.
 *
 * Dipake di: app.js → bootstrap.
 */
async function recoverPendingRelayCommands() {
  const pending = await prisma.commandLog.findMany({
    where: { status: "pending" },
    select: { id: true },
  });
  for (const { id } of pending) {
    await enqueueRelayCommand(id);
  }
  if (pending.length) {
    logger.info(
      `[RelayCommand] ${pending.length} perintah pending dimasukkan ulang ke antrean`,
    );
  }
}

/**
 * Ngambil telemetry meter dengan ngunci device dulu (409 kalo lagi sibuk).
 *
 * Dipake di:
 * - pingDevice (file ini)
 * - telemetryPollerJob.js → pollDevice.
 */
async function fetchAndStoreTelemetry(device, options = {}) {
  return withDeviceLock(device.id, () => runTelemetryFetch(device, options));
}

/**
 * Inti ngambil telemetry tanpa kunci: ping meter, update lastSeenAt & status
 * relai, simpen reading energi, terus kirim event device:status.
 *
 * Dipake di: fetchAndStoreTelemetry, readRelayStateViaTelemetry (file ini).
 */
async function runTelemetryFetch(device, { timeout = PING_TIMEOUT_MS } = {}) {
  const raw = await pingTelemetry(device.eui, { timeout });
  const parsed = parseTelemetryResponse(raw);

  const updated = await prisma.device.update({
    where: { id: device.id },
    data: {
      lastSeenAt: new Date(),
      commFailedAt: null,
      ...(parsed.relayStatus && parsed.relayStatus !== device.status
        ? { status: parsed.relayStatus }
        : {}),
    },
  });

  if (parsed.usageKwh !== null || parsed.powerWatt !== null) {
    await prisma.energyReading.create({
      data: {
        deviceId: device.id,
        powerWatt: parsed.powerWatt,
        usageKwh: parsed.usageKwh,
      },
    });
  }

  emitDeviceStatus({
    deviceId: device.id,
    eui: device.eui,
    roomId: device.roomId,
    status: updated.status,
    online: true,
    powerWatt: parsed.powerWatt,
    usageKwh: parsed.usageKwh,
    source: "telemetry",
    timestamp: new Date().toISOString(),
  });

  return { device: updated, telemetry: parsed, raw };
}

/**
 * Minta telemetry terbaru satu device terus balikin ringkasan status,
 * telemetry, sama response mentahnya.
 *
 * Dipake di: device.controller.js → ping (POST /api/devices/:id/telemetry).
 */
async function pingDevice(deviceId, { timeout } = {}) {
  const device = await getLinkedDevice(deviceId);
  const {
    device: updated,
    telemetry,
    raw,
  } = await fetchAndStoreTelemetry(device, { timeout });

  return {
    deviceId: updated.id,
    devEui: updated.eui,
    status: updated.status,
    lastSeenAt: updated.lastSeenAt,
    telemetry,
    raw,
  };
}

/**
 * Kirim interval laporan baru ke meter, catet CommandLog set_interval, dan
 * simpen interval ke DB kalo berhasil.
 *
 * Dipake di: device.controller.js → interval (POST /api/devices/:id/interval).
 */
async function setDeviceInterval(deviceId, options = {}) {
  const { intervalMinutes, userId = null } = options;
  const device = await getLinkedDevice(deviceId);
  const intervalSeconds = Number(intervalMinutes) * 60;

  let status = "success";
  let notes = null;
  let raw = null;

  try {
    raw = await setReportInterval(device.eui, intervalSeconds);
  } catch (err) {
    status = "failed";
    notes = err.message;
  }

  await prisma.commandLog.create({
    data: {
      roomId: device.roomId,
      deviceId: device.id,
      action: `set_interval:${intervalMinutes}m`,
      triggerType: "manual",
      triggeredByUserId: userId,
      status,
      notes,
    },
  });

  if (status === "success") {
    const updated = await prisma.device.update({
      where: { id: device.id },
      data: { intervalMinutes: Number(intervalMinutes) },
    });
    emitDeviceUpdated(updated);
  }

  return {
    deviceId: device.id,
    devEui: device.eui,
    intervalMinutes: Number(intervalMinutes),
    intervalSeconds,
    status,
    notes,
    raw,
  };
}

/**
 * Ngecek param from/to riwayat telemetry (wajib diisi, tanggal valid, from ≤
 * to, maks 90 hari) terus diubah jadi timestamp.
 *
 * Dipake di: getDeviceTelemetryHistory (file ini).
 */
function parseHistoryRange(from, to) {
  if (!from || !to) {
    throw httpError("Parameter 'from' dan 'to' wajib diisi (ISO date)", 400);
  }
  const startTs = new Date(from).getTime();
  const endTs = new Date(to).getTime();

  if (Number.isNaN(startTs) || Number.isNaN(endTs)) {
    throw httpError("Format 'from'/'to' tidak valid", 400);
  }
  if (startTs > endTs) {
    throw httpError("'from' tidak boleh lebih besar dari 'to'", 400);
  }
  const rangeDays = (endTs - startTs) / (1000 * 60 * 60 * 24);
  if (rangeDays > MAX_HISTORY_RANGE_DAYS) {
    throw httpError(
      `Rentang maksimal ${MAX_HISTORY_RANGE_DAYS} hari (diminta: ${Math.round(rangeDays)} hari)`,
      400,
    );
  }
  return { startTs, endTs };
}

/**
 * Ngambil data device dari ChirpStack pake devEUI device EMS.
 *
 * Dipake di: device.controller.js → chirpstackMetadata (GET
 *   /api/devices/:id/chirpstack-metadata).
 */
async function getDeviceChirpstackMetadata(deviceId) {
  const device = await getLinkedDevice(deviceId);
  const csDevice = await getCsDevice(device.eui);
  return {
    deviceId: device.id,
    devEui: device.eui,
    attributes: csDevice.data,
  };
}

/**
 * Ngambil reading energi device di rentang waktu tertentu, diurutin dari yang
 * paling lama.
 *
 * Dipake di: device.controller.js → telemetryHistory (GET
 *   /api/devices/:id/telemetry-history).
 */
async function getDeviceTelemetryHistory(deviceId, { from, to, limit = 1000 }) {
  const device = await prisma.device.findUnique({ where: { id: deviceId } });
  if (!device) throw httpError("Device tidak ditemukan", 404);

  const { startTs, endTs } = parseHistoryRange(from, to);

  const readings = await prisma.energyReading.findMany({
    where: {
      deviceId,
      recordedAt: { gte: new Date(startTs), lte: new Date(endTs) },
    },
    orderBy: { recordedAt: "asc" },
    take: Number(limit),
  });

  return {
    deviceId: device.id,
    from: new Date(startTs).toISOString(),
    to: new Date(endTs).toISOString(),
    points: readings.map((r) => ({
      ts: r.recordedAt.getTime(),
      powerWatt: r.powerWatt,
      usageKwh: r.usageKwh,
    })),
  };
}

/**
 * Ngegabungin list device ChirpStack sama device EMS buat nandain mana yang
 * udah dipasangin.
 *
 * Dipake di: device.controller.js → chirpstackCandidates (GET
 *   /api/devices/chirpstack-candidates).
 */
async function listChirpstackDeviceCandidates() {
  const csResult = await listCsDevices();
  const devEuis = csResult.data.result.map((d) => d.devEui);

  const mappedDevices = devEuis.length
    ? await prisma.device.findMany({
        where: { eui: { in: devEuis } },
        select: { id: true, name: true, eui: true },
      })
    : [];
  const mappedByEui = new Map(mappedDevices.map((d) => [d.eui, d]));

  return {
    data: csResult.data.result.map((d) => ({
      devEui: d.devEui,
      name: d.name,
      type: null,
      isMapped: mappedByEui.has(d.devEui),
      mappedTo: mappedByEui.get(d.devEui) || null,
    })),
    page: 0,
    totalElements: csResult.data.totalCount,
    hasNext: false,
  };
}

module.exports = {
  listDevicesPaginated,
  getDeviceById,
  createDevice,
  updateDevice,
  deleteDevice,
  powerDevice,
  requestRelayCommand,
  processRelayCommand,
  failRelayCommand,
  recoverPendingRelayCommands,
  getPendingCommandsByDevice,
  syncDevicesFromChirpstack,
  pingDevice,
  setDeviceInterval,
  fetchAndStoreTelemetry,
  isDeviceBusy,
  getDeviceChirpstackMetadata,
  getDeviceTelemetryHistory,
  listChirpstackDeviceCandidates,
};
