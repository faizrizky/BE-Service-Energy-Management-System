const MINUTES_PER_DAY = 24 * 60;
const WEEK_LENGTH_DAYS = 7;

function timeToMinutes(time) {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

function invertAction(action) {
  return action === "on" ? "off" : "on";
}

function toDateOnly(date) {
  const d = new Date(date);
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()),
  );
}

function toDateKey(date) {
  return toDateOnly(date).toISOString().slice(0, 10);
}

function addDays(date, amount) {
  const result = toDateOnly(date);
  result.setUTCDate(result.getUTCDate() + amount);
  return result;
}

/**
 * Schedule dianggep "cross-midnight" kalau endTime-nya <= startTime,
 * artinya rentang waktunya nyebrang lewat jam 00:00 (mis. 23:00 -> 01:00).
 */
function isCrossMidnight(schedule) {
  if (!schedule.endTime) return false;
  return timeToMinutes(schedule.endTime) <= timeToMinutes(schedule.startTime);
}

/**
 * Tanggal kalender yang dipake sama schedule repeatType 'none',
 * termasuk hari berikutnya kalo rentang jamnya cross-midnight.
 */
function getOccupiedDates(schedule) {
  const base = toDateOnly(schedule.scheduledDate);
  if (!isCrossMidnight(schedule)) return [base];
  return [base, addDays(base, 1)];
}

/**
 * Tanggal mulai berlakunya sebuah schedule. `scheduledDate`
 */
function getScheduleStartDate(schedule) {
  return toDateOnly(schedule.scheduledDate);
}

/**
 * Single source of truth: apakah `schedule` occur (mulai berlaku) tepat di tanggal `date`.
 */
function isOccurringOnDate(schedule, date) {
  const day = toDateOnly(date);

  if (schedule.repeatType === "none") {
    const key = toDateKey(day);
    return getOccupiedDates(schedule).some((d) => toDateKey(d) === key);
  }

  const start = getScheduleStartDate(schedule);
  if (day < start) return false;

  if (schedule.repeatType === "daily") return true;

  if (schedule.repeatType === "weekly") {
    const days = Array.isArray(schedule.repeatDays) ? schedule.repeatDays : [];
    return days.includes(day.getUTCDay());
  }

  return false;
}

/**
 * Cek apakah dua schedule bakal pernah jalan di tanggal yang sama.
 * - Kalau salah satunya 'none' (cuma jalan di tanggal tertentu), tinggal cek
 *   tanggal itu ketemu ga sama pola schedule satunya. Jadi ga perlu ribet.
 * - Kalau dua-duanya recurring (daily/weekly), polanya bakal muter terus tiap 7 hari.
 *   Jadi cukup cek 1 minggu dari tanggal mulai yang paling akhir dari keduanya.
 *   ga perlu ngecek tanggal satu-satu sampai selamanya.
 */
function occurrenceDatesOverlap(a, b) {
  if (a.repeatType === "none" || b.repeatType === "none") {
    const bounded = a.repeatType === "none" ? a : b;
    const other = bounded === a ? b : a;
    return getOccupiedDates(bounded).some((d) => isOccurringOnDate(other, d));
  }

  const windowStart = new Date(
    Math.max(getScheduleStartDate(a), getScheduleStartDate(b)),
  );
  for (let i = 0; i < WEEK_LENGTH_DAYS; i += 1) {
    const day = addDays(windowStart, i);
    if (isOccurringOnDate(a, day) && isOccurringOnDate(b, day)) return true;
  }
  return false;
}

/**
 * Ubah satu rentang waktu jadi daftar interval menit [start, end] dalam 1 hari (0-1440).
 * Rentang yang cross-midnight dipecah jadi 2 interval: [start,1440] dan [0,end].
 * Rentang tanpa endTime dianggap event sesaat (point-in-time).
 */
function toDailyIntervals(startTime, endTime) {
  const start = timeToMinutes(startTime);
  const end = endTime ? timeToMinutes(endTime) : start;

  if (endTime && end <= start) {
    return [
      [start, MINUTES_PER_DAY],
      [0, end],
    ];
  }
  return [[start, end]];
}

function intervalsOverlap([aStart, aEnd], [bStart, bEnd]) {
  return aStart <= bEnd && bStart <= aEnd;
}

/**
 * Cek apakah dua rentang jam (dalam sehari) saling beririsan.
 * Sudah menangani rentang yang cross-midnight di salah satu/kedua sisi.
 */
function timeRangesOverlap(aStart, aEnd, bStart, bEnd) {
  const aIntervals = toDailyIntervals(aStart, aEnd);
  const bIntervals = toDailyIntervals(bStart, bEnd);
  return aIntervals.some((a) => bIntervals.some((b) => intervalsOverlap(a, b)));
}

/**
 * Apakah `now` adalah momen START trigger schedule ini.
 */
function isStartDue(schedule, now) {
  const currentTime = now.toTimeString().slice(0, 5);
  return schedule.startTime === currentTime && isOccurringOnDate(schedule, now);
}

/**
 * Apakah `now` adalah momen END trigger schedule ini.
 * Kalau cross-midnight, "hari mulai" rentang ini adalah KEMARIN (H-1)
 * relatif ke `now`, karena rentangnya nyebrang lewat jam 00:00.
 */
function isEndDue(schedule, now) {
  if (!schedule.endTime) return false;

  const currentTime = now.toTimeString().slice(0, 5);
  if (schedule.endTime !== currentTime) return false;

  const startReferenceDate = isCrossMidnight(schedule) ? addDays(now, -1) : now;
  return isOccurringOnDate(schedule, startReferenceDate);
}

module.exports = {
  timeToMinutes,
  invertAction,
  toDateOnly,
  toDateKey,
  addDays,
  isCrossMidnight,
  getOccupiedDates,
  getScheduleStartDate,
  isOccurringOnDate,
  occurrenceDatesOverlap,
  timeRangesOverlap,
  isStartDue,
  isEndDue,
};
