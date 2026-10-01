const { config } = require("../../config/config");

/**
 * Format tanggal + jam buat ditampilin ke user, pakai zona waktu aplikasi
 * (SCHEDULE_TIMEZONE, default Asia/Jakarta), bukan zona server (staging =
 * UTC). Contoh hasil: "1 Okt 2026, 11.50".
 *
 * Dipake di: login.usecase.js → lockedError.
 */
function formatDateTime(date) {
  return date.toLocaleString("id-ID", {
    timeZone: config.schedule.timezone,
    dateStyle: "medium",
    timeStyle: "short",
  });
}
/**
 * Pecah tanggal jadi bagian-bagian (tahun, bulan, hari, jam, menit) di zona
 * waktu aplikasi.
 *
 * Dipake di: formatDateKey, formatTimeHm (file ini).
 */
function zonedParts(date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: config.schedule.timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(date));
  return Object.fromEntries(parts.map((p) => [p.type, p.value]));
}

/**
 * Tanggal YYYY-MM-DD di zona waktu aplikasi.
 *
 * Dipake di: room.usecase.js → getDeviceLogs.
 */
function formatDateKey(date) {
  const p = zonedParts(date);
  return `${p.year}-${p.month}-${p.day}`;
}

/**
 * Jam HH:mm di zona waktu aplikasi.
 *
 * Dipake di: room.usecase.js → getDeviceLogs.
 */
function formatTimeHm(date) {
  const p = zonedParts(date);
  return `${p.hour}:${p.minute}`;
}

module.exports = { formatDateTime, formatDateKey, formatTimeHm };
