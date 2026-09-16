const { prisma } = require("../../../frameworks/database/prismaClient");
const {
  emitGatewayCreated,
  emitGatewayUpdated,
  emitGatewayDeleted,
} = require("../../../frameworks/webserver/socket-events");
const { listGateways } = require("../../../frameworks/chirpstack/client");
const { config } = require("../../../config/config");
const logger = require("../../../frameworks/helpers/logger");

const CS_GATEWAY_STATE_ONLINE = 1;

/**
 * Gabungin data gateway EMS sama data ChirpStack: status & lastSeenAt diambil
 * dari ChirpStack kalo EUI-nya ketemu. Kalo middleware lagi mati, pake nilai
 * terakhir yang tersimpan di database (hasil sinkron sebelumnya).
 *
 * Dipake di: listGatewaysPaginated, getGatewayById (file ini).
 */
function mergeChirpstackGateway(gateway, csGateways) {
  if (!csGateways) {
    return { ...gateway, chirpstack: null };
  }

  const cs = csGateways.get(String(gateway.eui || "").toLowerCase());
  if (!cs) {
    return {
      ...gateway,
      status: "offline",
      chirpstack: { registered: false, name: null, lastSeenAt: null },
    };
  }

  return {
    ...gateway,
    status: cs.online ? "online" : "offline",
    lastSeenAt: cs.lastSeenAt,
    chirpstack: {
      registered: true,
      name: cs.name,
      lastSeenAt: cs.lastSeenAt,
    },
  };
}

/**
 * Ambil daftar gateway dari ChirpStack lewat middleware, terus rapihin jadi Map
 * EUI (huruf kecil) → { name, lastSeenAt, online }. Balikin Map kosong kalo
 * middleware-nya lagi nggak bisa dihubungi, biar halaman tetep kebuka.
 *
 * Dipake di: syncGatewaysFromChirpstack (file ini).
 */
async function fetchChirpstackGateways() {
  try {
    const raw = await listGateways({ limit: 200 });
    const rows = raw?.data?.result ?? [];

    return new Map(
      rows.map((row) => [
        String(row.gatewayId || "").toLowerCase(),
        {
          name: row.name ?? null,
          description: row.description ?? null,
          lastSeenAt: row.lastSeenAt ? new Date(row.lastSeenAt) : null,
          online: row.state === CS_GATEWAY_STATE_ONLINE,
        },
      ]),
    );
  } catch (err) {
    logger.warn(
      `[Gateway] Gagal ambil data gateway dari ChirpStack: ${err.message}`,
    );
    return null;
  }
}

/**
 * Samain gateway EMS sama data ChirpStack: yang udah ada di-update status &
 * lastSeenAt-nya, yang belum ada di EMS langsung dibikinin (nama & EUI ngikut
 * ChirpStack). Perubahannya dikabarin lewat socket gateway:created /
 * gateway:updated.
 *
 * Dipake di: gatewaySyncJob.js (tiap menit), app.js → bootstrap.
 */
async function syncGatewaysFromChirpstack() {
  const csGateways = await fetchChirpstackGateways();
  if (!csGateways || !csGateways.size) {
    return { checked: 0, updated: 0, created: 0, removed: 0 };
  }

  const gateways = await prisma.gateway.findMany();
  const knownEuis = new Set(
    gateways.map((gateway) => String(gateway.eui || "").toLowerCase()),
  );
  let updated = 0;
  let created = 0;

  for (const gateway of gateways) {
    const cs = csGateways.get(String(gateway.eui || "").toLowerCase());
    if (!cs) continue;

    const status = cs.online ? "online" : "offline";
    const lastSeenChanged =
      (cs.lastSeenAt?.getTime() ?? null) !==
      (gateway.lastSeenAt?.getTime() ?? null);
    if (gateway.status === status && !lastSeenChanged) continue;

    const saved = await prisma.gateway.update({
      where: { id: gateway.id },
      data: { status, lastSeenAt: cs.lastSeenAt },
    });
    emitGatewayUpdated(saved);
    updated += 1;
  }

  for (const [eui, cs] of csGateways) {
    if (knownEuis.has(eui)) continue;

    const saved = await prisma.gateway.create({
      data: {
        eui,
        name: cs.name || eui,
        description: cs.description || null,
        status: cs.online ? "online" : "offline",
        lastSeenAt: cs.lastSeenAt,
      },
    });
    emitGatewayCreated(saved);
    created += 1;
    logger.info(`[Gateway] Gateway baru dari ChirpStack didaftarkan: ${eui}`);
  }

  let removed = 0;
  for (const gateway of gateways) {
    if (csGateways.has(String(gateway.eui || "").toLowerCase())) continue;
    if (!config.chirpstack.syncDelete) continue;

    const deviceCount = await prisma.device.count({
      where: { gatewayId: gateway.id },
    });
    if (deviceCount > 0) {
      logger.warn(
        `[Gateway] "${gateway.name}" (${gateway.eui}) udah nggak ada di ChirpStack tapi masih punya ${deviceCount} device, belum dihapus`,
      );
      continue;
    }

    await prisma.gateway.delete({ where: { id: gateway.id } });
    emitGatewayDeleted(gateway.id);
    removed += 1;
    logger.info(
      `[Gateway] "${gateway.name}" (${gateway.eui}) dihapus dari EMS karena udah nggak ada di ChirpStack`,
    );
  }

  if (updated) {
    logger.info(
      `[Gateway] ${updated} gateway disamakan dengan data ChirpStack`,
    );
  }
  return { checked: gateways.length, updated, created, removed };
}

/**
 * List gateway pake paginasi, bisa search (nama, EUI, model, simcard, sumber
 * daya) & filter tanggal, plus status online/offline.
 *
 * Dipake di: gateway.controller.js → index (GET /api/gateways).
 */
async function listGatewaysPaginated({
  page = 1,
  rowsPerPage = 10,
  search,
  createdFrom,
  createdTo,
} = {}) {
  const andConditions = [];

  if (search) {
    andConditions.push({
      OR: [
        { name: { contains: search, mode: "insensitive" } },
        { eui: { contains: search, mode: "insensitive" } },
        { modelUnit: { contains: search, mode: "insensitive" } },
        { simcard: { contains: search, mode: "insensitive" } },
        { powerSource: { contains: search, mode: "insensitive" } },
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

  const [totalRows, gateways] = await Promise.all([
    prisma.gateway.count({ where }),
    prisma.gateway.findMany({
      where,
      include: {
        installedBy: { select: { id: true, fullName: true } },
        devices: { select: { lastSeenAt: true, intervalMinutes: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * rowsPerPage,
      take: rowsPerPage,
    }),
  ]);

  const csGateways = await fetchChirpstackGateways();
  const data = gateways.map(({ devices, ...gateway }) =>
    mergeChirpstackGateway(gateway, csGateways),
  );

  return {
    data,
    page,
    rowsPerPage,
    totalRows,
    totalPages: Math.max(1, Math.ceil(totalRows / rowsPerPage)),
  };
}

/**
 * Detail gateway plus device, installer, sama status-nya. Balikin null kalo
 * nggak ketemu.
 *
 * Dipake di: gateway.controller.js → show (GET /api/gateways/:id).
 */
async function getGatewayById(id) {
  const gateway = await prisma.gateway.findUnique({
    where: { id },
    include: {
      devices: true,
      installedBy: { select: { id: true, fullName: true, username: true } },
    },
  });
  if (!gateway) return null;

  const csGateways = await fetchChirpstackGateways();
  return mergeChirpstackGateway(gateway, csGateways);
}

/**
 * Nyimpen gateway baru (tanggal instalasi diubah ke Date) terus ngirim event
 * gateway:created dengan status offline.
 *
 * Dipake di: gateway.controller.js → store (POST /api/gateways).
 */
async function createGateway(data) {
  const gateway = await prisma.gateway.create({
    data: {
      eui: data.eui,
      name: data.name,
      description: data.description,
      simcard: data.simcard,
      powerSource: data.powerSource,
      modelUnit: data.modelUnit,
      installationDate: data.installationDate
        ? new Date(data.installationDate)
        : undefined,
      installedById: data.installedById || null,
    },
    include: { installedBy: { select: { id: true, fullName: true } } },
  });
  emitGatewayCreated({ ...gateway, status: "offline" });
  return gateway;
}

/**
 * Ngedit gateway. installedById string kosong artinya installer-nya dilepas.
 * Terus ngirim event gateway:updated.
 *
 * Dipake di: gateway.controller.js → update (PUT /api/gateways/:id).
 */
async function updateGateway(id, data) {
  const gateway = await prisma.gateway.update({
    where: { id },
    data: {
      name: data.name,
      description: data.description,
      simcard: data.simcard,
      powerSource: data.powerSource,
      modelUnit: data.modelUnit,
      installationDate: data.installationDate
        ? new Date(data.installationDate)
        : undefined,
      installedById:
        data.installedById !== undefined
          ? data.installedById || null
          : undefined,
    },
    include: { installedBy: { select: { id: true, fullName: true } } },
  });
  emitGatewayUpdated(gateway);
  return gateway;
}

/**
 * Hapus gateway kalo udah nggak punya device (409 kalo masih ada), terus
 * ngirim event gateway:deleted.
 *
 * Dipake di: gateway.controller.js → destroy (DELETE /api/gateways/:id).
 */
async function deleteGateway(id) {
  const deviceCount = await prisma.device.count({ where: { gatewayId: id } });
  if (deviceCount > 0) {
    const err = new Error(
      `Gateway tidak bisa dihapus karena masih memiliki ${deviceCount} device. Pindahkan atau hapus device tersebut terlebih dahulu.`,
    );
    err.status = 409;
    throw err;
  }

  const deleted = await prisma.gateway.delete({ where: { id } });
  emitGatewayDeleted(deleted.id);
  return deleted;
}

module.exports = {
  syncGatewaysFromChirpstack,
  listGatewaysPaginated,
  getGatewayById,
  createGateway,
  updateGateway,
  deleteGateway,
};
