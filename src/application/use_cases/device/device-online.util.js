const { config } = require("../../../config/config");

/**
 * Batas waktu device masih dianggep online: satu interval laporan + masa
 * tenggang kecil (DEVICE_ONLINE_GRACE_SECONDS). Sengaja sempit, dulu 2×
 * interval jadi device mati baru ketahuan sejam kemudian.
 *
 * Dipake di: getOnlineUntil, isDeviceOnline (file ini).
 */
function getOnlineWindowMs(device) {
  const intervalMs = (device.intervalMinutes || 0) * 60 * 1000;
  return intervalMs + config.deviceOnline.graceMs;
}

/**
 * Sampe kapan device masih dianggep online (Date), atau null kalo belom pernah
 * ngirim uplink. Dikirim ke frontend biar UI bisa nandain offline sendiri tanpa
 * nanya server lagi.
 *
 * Dipake di: device.usecase.js → listDevicesPaginated, getDeviceById;
 *   room.usecase.js → listDevicesInRoom, getRoomById.
 */
function getOnlineUntil(device) {
  if (!device.lastSeenAt) return null;
  return new Date(device.lastSeenAt.getTime() + getOnlineWindowMs(device));
}

/**
 * Device online kalo uplink terakhirnya belom lewat batas di atas DAN perintah
 * terakhir ke meter nggak gagal nyampe. Belom pernah kirim uplink = offline.
 *
 * Dipake di: device.usecase.js (list & guard perintah relay), room.usecase.js,
 *   report.usecase.js, gateway.usecase.js, telemetryPollerJob.js.
 */
function isDeviceOnline(device, now = new Date()) {
  if (!device.lastSeenAt) return false;

  // Perintah terakhir gagal nyampe ke meter dan sejak itu belom ada uplink:
  // dianggep offline walau jendela waktunya belom abis. Ini yang bikin device
  // mati lampu ketahuan sekarang juga, nggak nunggu satu interval penuh.
  if (
    device.commFailedAt &&
    device.commFailedAt.getTime() > device.lastSeenAt.getTime()
  ) {
    return false;
  }

  return now.getTime() - device.lastSeenAt.getTime() <= getOnlineWindowMs(device);
}

module.exports = { getOnlineWindowMs, getOnlineUntil, isDeviceOnline };
