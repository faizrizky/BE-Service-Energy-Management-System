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

module.exports = { formatDateTime };
