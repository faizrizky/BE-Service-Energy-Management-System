const ONLINE_THRESHOLD_MULTIPLIER = 2;

function isDeviceOnline(device, now = new Date()) {
  if (!device.lastSeenAt) return false;
  const thresholdMs =
    device.intervalMinutes * ONLINE_THRESHOLD_MULTIPLIER * 60 * 1000;
  return now.getTime() - device.lastSeenAt.getTime() <= thresholdMs;
}

module.exports = { isDeviceOnline };
