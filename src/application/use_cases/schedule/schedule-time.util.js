const { config } = require("../../../config/config");

const MINUTES_PER_DAY = 24 * 60;
const WEEK_LENGTH_DAYS = 7;

/**
 * Ngubah jam "HH:mm" jadi jumlah menit dari jam 00:00.
 *
 * Dipake di: isCrossMidnight, toDailyIntervals (file ini).
 */
function timeToMinutes(time) {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

/**
 * Ngebalik action: on jadi off, off jadi on. Dipake pas endTime schedule udah
 * nyampe.
 *
 * Dipake di: scheduleWorker.js → processMinute.
 */
function invertAction(action) {
  return action === "on" ? "off" : "on";
}

/**
 * Buang jam dari tanggal, hasilnya jam 00:00 UTC di tanggal (UTC) itu. Sengaja
 * pake UTC karena scheduledDate disimpen dari "YYYY-MM-DD" (= 00:00 UTC), jadi
 * hasilnya sama aja mau zona waktu server apa pun.
 *
 * Dipake di: toDateKey, addDays, getOccupiedDates, getScheduleStartDate,
 *   isOccurringOnDate (file ini).
 */
function toDateOnly(date) {
  const d = new Date(date);
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()),
  );
}

/**
 * Bikin kunci tanggal "YYYY-MM-DD" (tanggal UTC, lihat toDateOnly) buat
 * bandingin hari.
 *
 * Dipake di: isOccurringOnDate (file ini).
 */
function toDateKey(date) {
  const d = toDateOnly(date);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Nambah/ngurangin beberapa hari dari tanggal (hasilnya tanpa jam).
 *
 * Dipake di: getOccupiedDates, occurrenceDatesOverlap, isEndDue (file ini).
 */
function addDays(date, amount) {
  const result = toDateOnly(date);
  result.setUTCDate(result.getUTCDate() + amount);
  return result;
}

const zonedFormatters = new Map();

/**
 * Ambil (atau bikin sekali terus disimpen) formatter Intl buat zona waktu
 * tertentu, biar nggak bikin ulang tiap menit.
 *
 * Dipake di: getZonedParts (file ini).
 */
function getZonedFormatter(timeZone) {
  if (!zonedFormatters.has(timeZone)) {
    zonedFormatters.set(
      timeZone,
      new Intl.DateTimeFormat("en-US", {
        timeZone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
      }),
    );
  }
  return zonedFormatters.get(timeZone);
}

/**
 * Pecah waktu jadi tanggal & jam menurut zona waktu schedule (bukan zona waktu
 * server). Balikin { date, dateKey, time } — date itu tanggalnya dalam format
 * toDateOnly (00:00 UTC), time format "HH:mm".
 *
 * Dipake di: getTodayInScheduleZone, isStartDue, isEndDue (file ini),
 *   scheduleWorker.js → processMinute.
 */
function getZonedParts(date, timeZone = config.schedule.timezone) {
  const parts = Object.fromEntries(
    getZonedFormatter(timeZone)
      .formatToParts(date)
      .map(({ type, value }) => [type, value]),
  );
  const dateKey = `${parts.year}-${parts.month}-${parts.day}`;
  return {
    date: new Date(`${dateKey}T00:00:00.000Z`),
    dateKey,
    time: `${parts.hour}:${parts.minute}`,
  };
}

/**
 * Tanggal hari ini menurut zona waktu schedule (format toDateOnly), buat
 * misahin schedule yang udah jalan sama yang upcoming.
 *
 * Dipake di: schedule.usecase.js → buildStatusWhere, report.usecase.js →
 *   getActiveSchedules.
 */
function getTodayInScheduleZone(now = new Date()) {
  return getZonedParts(now).date;
}

/**
 * Nentuin tanggal mulai schedule kalo client nggak ngirim scheduledDate,
 * dihitung di zona waktu schedule (SCHEDULE_TIMEZONE), bukan zona waktu
 * browser/server.
 * - berulang: mulai dari hari ini.
 * - sekali jalan: kemunculan berikutnya jam startTime. Kalo startTime masih di
 *   depan jam sekarang berarti hari ini, kalo sama atau udah lewat berarti
 *   besok (menit yang lagi jalan udah diproses scheduler, jadi nggak bakal
 *   kepicu).
 *
 * Dipake di: schedule.usecase.js → createSchedule, updateSchedule.
 */
function resolveScheduledDate(
  { startTime, repeatType },
  now = new Date(),
  timeZone = config.schedule.timezone,
) {
  const { date, time } = getZonedParts(now, timeZone);
  if (repeatType && repeatType !== "none") return date;
  return startTime > time ? date : addDays(date, 1);
}

/**
 * Schedule dianggep nyebrang tengah malem kalo endTime ≤ startTime (misal
 * 23:00 → 01:00).
 *
 * Dipake di: getOccupiedDates, isEndDue (file ini).
 */
function isCrossMidnight(schedule) {
  if (!schedule.endTime) return false;
  return timeToMinutes(schedule.endTime) <= timeToMinutes(schedule.startTime);
}

/**
 * Schedule sekali-jalan dianggep expired kalo hari terakhir dia mungkin masih
 * bisa kepicu (scheduledDate, +1 hari kalo cross-midnight) udah kelewat hari
 * ini. Dipake buat nyapu schedule yang kelewat catch-up scheduler (misal
 * server mati pas jamnya) biar nggak nyangkut "active" selamanya.
 *
 * Dipake di: scheduleWorker.js → expireMissedSchedules.
 */
function isScheduleExpired(schedule, today) {
  if (schedule.repeatType !== "none") return false;
  const lastPossibleDay = isCrossMidnight(schedule)
    ? addDays(toDateOnly(schedule.scheduledDate), 1)
    : toDateOnly(schedule.scheduledDate);
  return lastPossibleDay < today;
}

/**
 * Tanggal yang kepake sama schedule sekali jalan (repeatType none), termasuk
 * besoknya kalo nyebrang tengah malem.
 *
 * Dipake di: isOccurringOnDate, occurrenceDatesOverlap (file ini).
 */
function getOccupiedDates(schedule) {
  const base = toDateOnly(schedule.scheduledDate);
  if (!isCrossMidnight(schedule)) return [base];
  return [base, addDays(base, 1)];
}

/**
 * Tanggal mulai berlakunya schedule (scheduledDate tanpa jam).
 *
 * Dipake di: isOccurringOnDate, occurrenceDatesOverlap (file ini).
 */
function getScheduleStartDate(schedule) {
  return toDateOnly(schedule.scheduledDate);
}

/**
 * Patokan utama buat nentuin schedule jalan di tanggal tertentu apa nggak:
 * none (tanggal yang kepake), daily (mulai dari tanggal mulai), weekly (hari
 * yang dipilih).
 *
 * Dipake di: occurrenceDatesOverlap, isStartDue, isEndDue (file ini).
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
 * Ngecek dua schedule bakal pernah jalan di tanggal yang sama apa nggak. Kalo
 * salah satunya sekali jalan, cukup cek tanggal itu; kalo dua-duanya berulang,
 * cukup cek 7 hari dari tanggal mulai yang paling belakang.
 *
 * Dipake di: schedule.usecase.js → assertNoScheduleConflict.
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
 * Ngubah rentang jam jadi interval menit dalam sehari. Yang nyebrang tengah
 * malem dipecah dua, yang nggak ada endTime dianggep satu titik waktu.
 *
 * Dipake di: timeRangesOverlap (file ini).
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

/**
 * Ngecek dua interval menit [start, end] tabrakan apa nggak (yang cuma nempel
 * ujungnya juga dihitung tabrakan).
 *
 * Dipake di: timeRangesOverlap (file ini).
 */
function intervalsOverlap([aStart, aEnd], [bStart, bEnd]) {
  return aStart <= bEnd && bStart <= aEnd;
}

/**
 * Ngecek dua rentang jam dalam sehari tabrakan apa nggak, termasuk yang
 * nyebrang tengah malem.
 *
 * Dipake di: schedule.usecase.js → assertNoScheduleConflict.
 */
function timeRangesOverlap(aStart, aEnd, bStart, bEnd) {
  const aIntervals = toDailyIntervals(aStart, aEnd);
  const bIntervals = toDailyIntervals(bStart, bEnd);
  return aIntervals.some((a) => bIntervals.some((b) => intervalsOverlap(a, b)));
}

/**
 * Ngecek menit ini pas sama startTime schedule dan schedule-nya berlaku hari
 * ini. Jam & tanggal "sekarang" diitung di zona waktu schedule
 * (SCHEDULE_TIMEZONE), bukan zona waktu server.
 *
 * Dipake di: scheduleWorker.js → processMinute.
 */
function isStartDue(schedule, now, timeZone = config.schedule.timezone) {
  const { date, time } = getZonedParts(now, timeZone);
  return schedule.startTime === time && isOccurringOnDate(schedule, date);
}

/**
 * Ngecek menit ini pas sama endTime schedule (di zona waktu schedule). Kalo
 * schedule-nya nyebrang tengah malem, hari mulainya dianggep kemarin.
 *
 * Dipake di: scheduleWorker.js → processMinute.
 */
function isEndDue(schedule, now, timeZone = config.schedule.timezone) {
  if (!schedule.endTime) return false;

  const { date, time } = getZonedParts(now, timeZone);
  if (schedule.endTime !== time) return false;

  const startReferenceDate = isCrossMidnight(schedule)
    ? addDays(date, -1)
    : date;
  return isOccurringOnDate(schedule, startReferenceDate);
}

/**
 * Aksi schedule di awal & akhir: start = action-nya sendiri, end = kebalikan
 * yang kepicu pas endTime (null kalo gak ada endTime). Aturannya sama persis
 * sama yang dipake scheduleWorker pas eksekusi.
 *
 * Dipake di: schedule.usecase.js → withActivity, report.usecase.js →
 *   getActiveSchedules.
 */
function getScheduleActivity(schedule) {
  return {
    start: schedule.action,
    end: schedule.endTime ? invertAction(schedule.action) : null,
  };
}

module.exports = {
  timeToMinutes,
  invertAction,
  toDateOnly,
  toDateKey,
  addDays,
  getZonedParts,
  getTodayInScheduleZone,
  isCrossMidnight,
  getOccupiedDates,
  getScheduleStartDate,
  isOccurringOnDate,
  occurrenceDatesOverlap,
  timeRangesOverlap,
  isStartDue,
  isEndDue,
  resolveScheduledDate,
  isScheduleExpired,
  getScheduleActivity,
};
