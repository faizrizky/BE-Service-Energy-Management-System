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
const logger = require("../../../frameworks/helpers/logger");

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

const LOCK_WAIT_POLL_MS = 2000;

const PING_TIMEOUT_MS = 120000;

const DEFAULT_TOPUP_FPORT = 112;

const DEVICE_BUSY_MESSAGE =
  "Device sedang memproses perintah lain (relay/telemetry), coba lagi sebentar";

const busyDevices = new Set();

function isDeviceBusy(deviceId) {
  return busyDevices.has(deviceId);
}

function acquireDeviceLock(deviceId) {
  if (busyDevices.has(deviceId)) return false;
  busyDevices.add(deviceId);
  return true;
}

function releaseDeviceLock(deviceId) {
  busyDevices.delete(deviceId);
}

async function withDeviceLock(deviceId, fn) {
  if (busyDevices.has(deviceId)) throw httpError(DEVICE_BUSY_MESSAGE, 409);
  busyDevices.add(deviceId);
  try {
    return await fn();
  } finally {
    busyDevices.delete(deviceId);
  }
}

async function getLinkedDevice(deviceId) {
  const device = await prisma.device.findUnique({ where: { id: deviceId } });
  if (!device) throw httpError("Device tidak ditemukan", 404);
  if (!device.tbDeviceId) {
    throw httpError(
      "Device belum terhubung ke ChirpStack (devEUI kosong)",
      409,
    );
  }
  return device;
}

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
  eui: "EUI",
  tbDeviceId: "devEUI ChirpStack",
};

function mapPrismaError(err) {
  if (err.code !== "P2002") return err;

  const target = err.meta?.target;
  const fields = Array.isArray(target) ? target : [target].filter(Boolean);
  const label = fields.map((f) => UNIQUE_FIELD_LABEL[f] || f).join(", ");

  return httpError(`${label || "Nilai unik"} sudah dipakai device lain`, 409);
}

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
        { tbDeviceId: { contains: search, mode: "insensitive" } },
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

  const pendingByDevice = await getPendingCommandsByDevice(
    devices.map((d) => d.id),
  );

  return {
    data: devices.map((d) => ({
      ...d,
      pendingCommand: pendingByDevice.get(d.id) ?? null,
    })),
    page,
    rowsPerPage,
    totalRows,
    totalPages: Math.max(1, Math.ceil(totalRows / rowsPerPage)),
  };
}

async function getDeviceById(id) {
  const device = await prisma.device.findUnique({
    where: { id },
    include: { room: true, gateway: true },
  });
  if (!device) return null;

  const pendingByDevice = await getPendingCommandsByDevice([id]);
  return { ...device, pendingCommand: pendingByDevice.get(id) ?? null };
}

async function createDevice(data) {
  const devEui = normalizeDevEui(data.tbDeviceId) ?? null;

  let device;
  try {
    device = await prisma.device.create({
      data: {
        eui: data.eui,
        tbDeviceId: devEui,
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

  if (device.tbDeviceId) {
    try {
      await ensureCsDeviceRegistered(device.tbDeviceId, {
        name: device.name,
        description: device.deviceType || "",
        updateIfExists: false,
      });
    } catch (err) {
      await prisma.device.delete({ where: { id: device.id } });
      throw err;
    }

    await pushReportInterval(device.tbDeviceId, device.intervalMinutes);
  }

  emitDeviceCreated(device);
  return device;
}

async function updateDevice(id, data) {
  const existing = await prisma.device.findUnique({ where: { id } });
  if (!existing) throw httpError("Device tidak ditemukan", 404);

  const nextDevEui = normalizeDevEui(data.tbDeviceId);
  const targetDevEui =
    nextDevEui === undefined ? existing.tbDeviceId : nextDevEui;
  const nextName = data.name ?? existing.name;
  const nextDeviceType =
    data.deviceType === undefined ? existing.deviceType : data.deviceType;

  if (targetDevEui) {
    await ensureCsDeviceRegistered(targetDevEui, {
      name: nextName,
      description: nextDeviceType || "",
    });
  }

  const devEuiChanged = !sameDevEui(existing.tbDeviceId, targetDevEui);

  if (existing.tbDeviceId && devEuiChanged) {
    logger.info(
      `[Device] ${id}: devEUI ${existing.tbDeviceId} dilepas dari EMS. ` +
        "Device tetap ada di ChirpStack, hapus manual bila memang tidak dipakai.",
    );
  }

  const device = await prisma.device.update({
    where: { id },
    data: {
      name: data.name,
      tbDeviceId: nextDevEui,
      deviceType: data.deviceType,
      intervalMinutes: data.intervalMinutes,
      roomId: data.roomId,
      gatewayId: data.gatewayId,
    },
  });

  const intervalChanged =
    data.intervalMinutes !== undefined &&
    Number(data.intervalMinutes) !== existing.intervalMinutes;

  if (device.tbDeviceId && (intervalChanged || devEuiChanged)) {
    await pushReportInterval(device.tbDeviceId, device.intervalMinutes);
  }

  emitDeviceUpdated(device);
  return device;
}

async function deleteDevice(id) {
  const existing = await prisma.device.findUnique({
    where: { id },
    select: { id: true, tbDeviceId: true, name: true },
  });

  if (!existing) throw httpError("Device tidak ditemukan", 404);

  if (existing.tbDeviceId) {
    await removeCsDevice(existing.tbDeviceId);
  }

  const deleted = await prisma.$transaction(async (tx) => {
    await tx.energyReading.deleteMany({ where: { deviceId: id } });
    await tx.commandLog.updateMany({
      where: { deviceId: id },
      data: { deviceId: null },
    });
    await tx.schedule.updateMany({
      where: { deviceId: id },
      data: { deviceId: null },
    });

    return tx.device.delete({ where: { id } });
  });

  emitDeviceDeleted(deleted.id);
  return deleted;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function commandDeadline(command) {
  return new Date(command.executedAt.getTime() + RELAY_COMMAND_DEADLINE_MS);
}

function toPendingCommand(command) {
  return {
    id: command.id,
    action: command.action,
    notes: command.notes,
    requestedAt: command.executedAt,
    deadline: commandDeadline(command),
  };
}

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
    timestamp: new Date().toISOString(),
  };
}

async function getPendingCommandsByDevice(deviceIds) {
  if (!deviceIds.length) return new Map();

  const commands = await prisma.commandLog.findMany({
    where: { deviceId: { in: deviceIds }, status: "pending" },
    orderBy: { executedAt: "asc" },
  });

  return new Map(commands.map((c) => [c.deviceId, toPendingCommand(c)]));
}

/**
 * Ubah status/notes command hanya kalau masih pending, supaya pembatalan
 * dan hasil dari proses lain tidak saling menimpa.
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

async function requestRelayCommand(device, action, options = {}) {
  const { userId = null, scheduleId = null } = options;
  const base = {
    roomId: device.roomId,
    deviceId: device.id,
    action,
    triggerType: scheduleId ? "scheduled" : "manual",
    triggeredByUserId: userId,
    scheduleId,
  };

  if (!device.tbDeviceId) {
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
  });
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

async function powerDevice(deviceId, action, options = {}) {
  const device = await getLinkedDevice(deviceId);
  return requestRelayCommand(device, action, options);
}

async function cancelRelayCommand(deviceId) {
  const device = await prisma.device.findUnique({ where: { id: deviceId } });
  if (!device) throw httpError("Device tidak ditemukan", 404);

  const pending = await prisma.commandLog.findMany({
    where: { deviceId, status: "pending" },
  });
  if (!pending.length) {
    throw httpError(
      "Tidak ada perintah yang sedang berjalan untuk device ini",
      404,
    );
  }

  const data = {
    status: "cancelled",
    notes:
      "Dibatalkan pengguna. Kalau perintah sudah terlanjur sampai ke meter, " +
      "status relai diselaraskan lewat telemetry berikutnya.",
  };
  const events = [];
  for (const command of pending) {
    if (await updatePendingCommand(command, data, device.name)) {
      events.push(toCommandEvent({ ...command, ...data }, device.name));
    }
  }
  return { deviceId, status: device.status, cancelled: events };
}

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
    timestamp: new Date().toISOString(),
  });
  await updatePendingCommand(
    command,
    { status: "success", notes },
    device.name,
  );
}

async function readRelayStateViaTelemetry(device) {
  try {
    const { telemetry } = await runTelemetryFetch(device, {
      timeout: RELAY_VERIFY_TIMEOUT_MS,
    });
    return telemetry.relayStatus;
  } catch (err) {
    logger.warn(
      `[Relay] Verifikasi telemetry ${device.tbDeviceId} gagal: ${err.message}`,
    );
    return null;
  }
}

function isWakeTimeout(err) {
  return err.status === 408 && /wake/i.test(err.message);
}

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
    const raw = await setRelay(device.tbDeviceId, command.action === "on", {
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

  logger.warn(
    `[Relay] ${device.tbDeviceId} ${command.action.toUpperCase()} percobaan ke-${attempt} gagal: ${reason}`,
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
 * Dijalankan worker BullMQ. Retry sampai relai berpindah, command dibatalkan/
 * digantikan, atau batas waktu RELAY_COMMAND_DEADLINE_MS habis.
 */
async function processRelayCommand(commandId) {
  let attempt = 0;

  for (;;) {
    const command = await prisma.commandLog.findUnique({
      where: { id: commandId },
    });
    if (!command || command.status !== "pending") return;

    const device = command.deviceId
      ? await prisma.device.findUnique({ where: { id: command.deviceId } })
      : null;
    if (!device || !device.tbDeviceId) {
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
    try {
      attempt += 1;
      done = await attemptRelayCommand(command, device, attempt);
    } finally {
      releaseDeviceLock(device.id);
    }
    if (done) return;

    await sleep(RELAY_RETRY_DELAY_MS);
  }
}

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

/** Masukkan ulang command pending ke antrean setelah backend restart. */
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

async function fetchAndStoreTelemetry(device, options = {}) {
  return withDeviceLock(device.id, () => runTelemetryFetch(device, options));
}

async function runTelemetryFetch(device, { timeout = PING_TIMEOUT_MS } = {}) {
  const raw = await pingTelemetry(device.tbDeviceId, { timeout });
  const parsed = parseTelemetryResponse(raw);

  const updated = await prisma.device.update({
    where: { id: device.id },
    data: {
      lastSeenAt: new Date(),
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
    powerWatt: parsed.powerWatt,
    usageKwh: parsed.usageKwh,
    timestamp: new Date().toISOString(),
  });

  return { device: updated, telemetry: parsed, raw };
}

async function pingDevice(deviceId, { timeout } = {}) {
  const device = await getLinkedDevice(deviceId);
  const {
    device: updated,
    telemetry,
    raw,
  } = await fetchAndStoreTelemetry(device, { timeout });

  return {
    deviceId: updated.id,
    devEui: updated.tbDeviceId,
    status: updated.status,
    lastSeenAt: updated.lastSeenAt,
    telemetry,
    raw,
  };
}

async function setDeviceInterval(deviceId, options = {}) {
  const { intervalMinutes, userId = null } = options;
  const device = await getLinkedDevice(deviceId);
  const intervalSeconds = Number(intervalMinutes) * 60;

  let status = "success";
  let notes = null;
  let raw = null;

  try {
    raw = await setReportInterval(device.tbDeviceId, intervalSeconds);
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
    devEui: device.tbDeviceId,
    intervalMinutes: Number(intervalMinutes),
    intervalSeconds,
    status,
    notes,
    raw,
  };
}

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

async function getDeviceChirpstackMetadata(deviceId) {
  const device = await getLinkedDevice(deviceId);
  const csDevice = await getCsDevice(device.tbDeviceId);
  return {
    deviceId: device.id,
    devEui: device.tbDeviceId,
    attributes: csDevice.data,
  };
}

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

async function listChirpstackDeviceCandidates() {
  const csResult = await listCsDevices();
  const devEuis = csResult.data.result.map((d) => d.devEui);

  const mappedDevices = devEuis.length
    ? await prisma.device.findMany({
        where: { tbDeviceId: { in: devEuis } },
        select: { id: true, name: true, tbDeviceId: true },
      })
    : [];
  const mappedByEui = new Map(mappedDevices.map((d) => [d.tbDeviceId, d]));

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
  cancelRelayCommand,
  processRelayCommand,
  failRelayCommand,
  recoverPendingRelayCommands,
  getPendingCommandsByDevice,
  pingDevice,
  setDeviceInterval,
  fetchAndStoreTelemetry,
  isDeviceBusy,
  getDeviceChirpstackMetadata,
  getDeviceTelemetryHistory,
  listChirpstackDeviceCandidates,
};
