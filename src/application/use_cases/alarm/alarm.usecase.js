const { prisma } = require("../../../frameworks/database/prismaClient");
const {
  getActiveAlarms,
  ackAlarm,
  clearAlarm,
} = require("../../../frameworks/thingsboard/client");

/**
 * Alarm sumber datanya dari ThingsBoard langsung
 */
async function listActiveAlarms({ pageSize = 20, page = 0 } = {}) {
  const tbResult = await getActiveAlarms({ pageSize, page });

  const originatorIds = tbResult.data.map((a) => a.originator.id);
  const devices = originatorIds.length
    ? await prisma.device.findMany({
        where: { tbDeviceId: { in: originatorIds } },
        include: { room: true },
      })
    : [];
  const byTbId = new Map(devices.map((d) => [d.tbDeviceId, d]));

  const data = tbResult.data.map((alarm) => {
    const device = byTbId.get(alarm.originator.id);
    return {
      id: alarm.id.id,
      type: alarm.type,
      severity: alarm.severity,
      status: alarm.status,
      createdTime: alarm.createdTime,
      ackTime: alarm.ackTs || null,
      clearTime: alarm.clearTs || null,
      deviceId: device?.id ?? null,
      deviceName: device?.name ?? alarm.originatorName ?? "Unknown device",
      roomId: device?.roomId ?? null,
      roomName: device?.room?.name ?? "-",
      isMapped: Boolean(device),
    };
  });

  return {
    data,
    page: tbResult.page ?? page,
    totalPages: tbResult.totalPages ?? 1,
    totalElements: tbResult.totalElements ?? data.length,
    hasNext: tbResult.hasNext ?? false,
  };
}

async function acknowledgeAlarm(alarmId) {
  if (!alarmId) {
    const err = new Error("alarmId wajib diisi");
    err.status = 400;
    throw err;
  }
  await ackAlarm(alarmId);
  return { alarmId, status: "acknowledged" };
}

async function clearActiveAlarm(alarmId) {
  if (!alarmId) {
    const err = new Error("alarmId wajib diisi");
    err.status = 400;
    throw err;
  }
  await clearAlarm(alarmId);
  return { alarmId, status: "cleared" };
}

module.exports = { listActiveAlarms, acknowledgeAlarm, clearActiveAlarm };
