/**
 * Escape karakter wildcard LIKE (% dan _) plus backslash di kata pencarian,
 * soalnya `contains` di Prisma nggak nge-escape sendiri. Tanpa ini nyari
 * "%" atau "_" malah ngebalikin semua data.
 *
 * Dipake di: semua list*Paginated, getRoomById, listDevicesInRoom,
 *   findNotification.
 */
function escapeLike(value) {
  if (typeof value !== "string") return value;
  return value.replace(/[\\%_]/g, "\\$&");
}

module.exports = { escapeLike };
