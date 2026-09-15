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
 * Buang jam dari tanggal (jadi jam 00:00 waktu lokal).
 *
 * Dipake di: toDateKey, addDays, getOccupiedDates, getScheduleStartDate,
 *   isOccurringOnDate (file ini).
 */
function toDateOnly(date) {
  const d = new Date(date);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/**
 * Bikin kunci tanggal "YYYY-MM-DD" (waktu lokal) buat bandingin hari.
 *
 * Dipake di: isOccurringOnDate (file ini).
 */
function toDateKey(date) {
  const d = toDateOnly(date);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Nambah/ngurangin beberapa hari dari tanggal (hasilnya tanpa jam).
 *
 * Dipake di: getOccupiedDates, occurrenceDatesOverlap, isEndDue (file ini).
 */
function addDays(date, amount) {
  const result = toDateOnly(date);
  result.setDate(result.getDate() + amount);
  return result;
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
    return days.includes(day.getDay());
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
 * ini.
 *
 * Dipake di: scheduleWorker.js → processMinute.
 */
function isStartDue(schedule, now) {
  const currentTime = now.toTimeString().slice(0, 5);
  return schedule.startTime === currentTime && isOccurringOnDate(schedule, now);
}

/**
 * Ngecek menit ini pas sama endTime schedule. Kalo schedule-nya nyebrang
 * tengah malem, hari mulainya dianggep kemarin.
 *
 * Dipake di: scheduleWorker.js → processMinute.
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
