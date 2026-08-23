// scripts/test-scheduler.js
// Jalankan: node scripts/test-scheduler.js
// Pastikan server (npm run dev) & worker udah jalan di background.

const BASE_URL = "http://localhost:4000/api";
const ADMIN_USERNAME = "admin";
const ADMIN_PASSWORD = "changeme123";
const ROOM_ID = "e836288a-bfab-48d8-aa16-9599988ff53e";
const DEVICE_ID = "c5ca9761-fd49-4c09-aae9-728c9c11aa7b";

let token;

function pad(n) {
  return String(n).padStart(2, "0");
}
function timeStr(date) {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
function dateStr(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
function addMinutes(date, min) {
  return new Date(date.getTime() + min * 60000);
}
function addDays(date, days) {
  return new Date(date.getTime() + days * 86400000);
}
function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function api(method, path, body) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

async function login() {
  const { status, data } = await api("POST", "/auth/login", {
    username: ADMIN_USERNAME,
    password: ADMIN_PASSWORD,
  });
  if (status !== 200) throw new Error(`Login gagal: ${JSON.stringify(data)}`);
  token = data.data.token;
  console.log("✓ Login OK\n");
}

async function waitUntil(targetDate, label) {
  // Buffer 65s (bukan 3s) - kasih ruang buat 1 siklus polling penuh + drift,
  // biar gak false-negative gara-gara worker belum sempat proses.
  const ms = targetDate.getTime() - Date.now() + 65000;
  if (ms <= 0) return;
  console.log(
    `  ...nunggu sampai ${timeStr(targetDate)} + buffer 65s (${Math.round(ms / 1000)}s) - ${label}`,
  );
  await sleep(ms);
}

async function getSchedule(id) {
  const { data } = await api("GET", `/schedules/${id}`);
  return data.data;
}

async function getDevice(id) {
  const { data } = await api("GET", `/devices/${id}`);
  return data.data;
}

async function setDevicePower(id, action) {
  await api("POST", `/devices/${id}/power`, { action });
}

const results = [];
function report(name, pass, detail) {
  results.push({ name, pass });
  console.log(
    `${pass ? "✅ PASS" : "❌ FAIL"} - ${name}${detail ? " -> " + detail : ""}\n`,
  );
}

async function cleanupSchedule(id) {
  if (id) await api("DELETE", `/schedules/${id}`).catch(() => {});
}

// ------------------------------------------------------------------
// TEST 1: one-shot start+end (repeatType: none)
// ------------------------------------------------------------------
async function testOneShotWithEndTime() {
  console.log("=== TEST 1: One-shot start+end (repeatType: none) ===");
  await setDevicePower(DEVICE_ID, "off");
  await sleep(1000);

  const now = new Date();
  const start = addMinutes(now, 1);
  const end = addMinutes(now, 2);

  const { status, data } = await api("POST", "/schedules", {
    roomId: ROOM_ID,
    deviceId: DEVICE_ID,
    action: "on",
    scheduledDate: dateStr(now),
    startTime: timeStr(start),
    endTime: timeStr(end),
    repeatType: "none",
  });
  if (status !== 201)
    return report("Test 1: create schedule", false, JSON.stringify(data));
  const scheduleId = data.data.id;

  await waitUntil(start, "nunggu startTime");
  const deviceAfterStart = await getDevice(DEVICE_ID);
  const startOk = deviceAfterStart.status === "on";

  await waitUntil(end, "nunggu endTime");
  const deviceAfterEnd = await getDevice(DEVICE_ID);
  const schedAfterEnd = await getSchedule(scheduleId);
  const endOk = deviceAfterEnd.status === "off";
  const completedOk = schedAfterEnd.status === "completed";

  report(
    "Test 1: start->on, end->off (invertAction), status jadi completed",
    startOk && endOk && completedOk,
    `start:${deviceAfterStart.status} end:${deviceAfterEnd.status} scheduleStatus:${schedAfterEnd.status}`,
  );

  await cleanupSchedule(completedOk ? null : scheduleId);
}

// ------------------------------------------------------------------
// TEST 2: one-shot tanpa endTime -> langsung completed
// ------------------------------------------------------------------
async function testOneShotNoEndTime() {
  console.log("=== TEST 2: One-shot tanpa endTime ===");
  await setDevicePower(DEVICE_ID, "off");
  await sleep(1000);

  const now = new Date();
  const start = addMinutes(now, 1);

  const { status, data } = await api("POST", "/schedules", {
    roomId: ROOM_ID,
    deviceId: DEVICE_ID,
    action: "on",
    scheduledDate: dateStr(now),
    startTime: timeStr(start),
    repeatType: "none",
  });
  if (status !== 201)
    return report("Test 2: create schedule", false, JSON.stringify(data));
  const scheduleId = data.data.id;

  await waitUntil(start, "nunggu trigger");

  const sched = await getSchedule(scheduleId);
  const device = await getDevice(DEVICE_ID);
  const pass = sched.status === "completed" && device.status === "on";

  report(
    "Test 2: tanpa endTime langsung completed setelah start",
    pass,
    `scheduleStatus:${sched.status} deviceStatus:${device.status}`,
  );

  await cleanupSchedule(pass ? null : scheduleId);
}

// ------------------------------------------------------------------
// TEST 3: scheduledDate validation - snapshot state SEBELUM, bandingkan
// setelahnya. Gak lagi asumsi device mulai "off".
// ------------------------------------------------------------------
async function testScheduledDateValidation() {
  console.log(
    "=== TEST 3: scheduledDate validation (tanggal besok, jangan trigger hari ini) ===",
  );

  const deviceBefore = await getDevice(DEVICE_ID);
  const statusBefore = deviceBefore.status;

  const now = new Date();
  const start = addMinutes(now, 1);
  const tomorrow = addDays(now, 1);

  const { status, data } = await api("POST", "/schedules", {
    roomId: ROOM_ID,
    deviceId: DEVICE_ID,
    action: statusBefore === "on" ? "off" : "on", // sengaja aksi kebalikan, biar KALAU ke-trigger jelas ketauan
    scheduledDate: dateStr(tomorrow),
    startTime: timeStr(start),
    repeatType: "none",
  });
  if (status !== 201)
    return report("Test 3: create schedule", false, JSON.stringify(data));
  const scheduleId = data.data.id;

  await waitUntil(start, "nunggu lewat startTime hari ini");

  const sched = await getSchedule(scheduleId);
  const deviceAfter = await getDevice(DEVICE_ID);
  const pass = sched.status === "active" && deviceAfter.status === statusBefore;

  report(
    "Test 3: schedule TIDAK trigger hari ini (masih active, device gak berubah dari state awal)",
    pass,
    `statusBefore:${statusBefore} statusAfter:${deviceAfter.status} scheduleStatus:${sched.status}`,
  );

  await cleanupSchedule(scheduleId);
}

// ------------------------------------------------------------------
// TEST 4: repeatType daily - trigger tapi TIDAK auto-complete
// ------------------------------------------------------------------
async function testRepeatDaily() {
  console.log("=== TEST 4: repeatType daily ===");
  await setDevicePower(DEVICE_ID, "off");
  await sleep(1000);

  const now = new Date();
  const start = addMinutes(now, 1);
  const yesterday = addDays(now, -1);

  const { status, data } = await api("POST", "/schedules", {
    roomId: ROOM_ID,
    deviceId: DEVICE_ID,
    action: "on",
    scheduledDate: dateStr(yesterday),
    startTime: timeStr(start),
    repeatType: "daily",
  });
  if (status !== 201)
    return report("Test 4: create schedule", false, JSON.stringify(data));
  const scheduleId = data.data.id;

  await waitUntil(start, "nunggu trigger");

  const sched = await getSchedule(scheduleId);
  const device = await getDevice(DEVICE_ID);
  const pass = sched.status === "active" && device.status === "on";

  report(
    "Test 4: daily trigger jalan, status TETAP active (bukan completed)",
    pass,
    `scheduleStatus:${sched.status} deviceStatus:${device.status}`,
  );

  await cleanupSchedule(scheduleId);
}

// ------------------------------------------------------------------
// TEST 5: repeatType weekly - trigger hari ini kalau hari ini termasuk
// repeatDays, dicek pake getUTCDay() vs getDay() lokal (deteksi bug timezone)
// ------------------------------------------------------------------
async function testRepeatWeekly() {
  console.log("=== TEST 5: repeatType weekly ===");
  await setDevicePower(DEVICE_ID, "off");
  await sleep(1000);

  const now = new Date();
  const start = addMinutes(now, 1);
  const lastWeek = addDays(now, -7);

  const localDay = now.getDay(); // hari menurut waktu lokal server
  const utcDay = now.getUTCDay(); // hari menurut UTC

  const { status, data } = await api("POST", "/schedules", {
    roomId: ROOM_ID,
    deviceId: DEVICE_ID,
    action: "on",
    scheduledDate: dateStr(lastWeek),
    startTime: timeStr(start),
    repeatType: "weekly",
    repeatDays: [localDay],
  });
  if (status !== 201)
    return report("Test 5: create schedule", false, JSON.stringify(data));
  const scheduleId = data.data.id;

  await waitUntil(start, "nunggu trigger");

  const device = await getDevice(DEVICE_ID);
  const pass = device.status === "on";

  report(
    "Test 5: weekly trigger sesuai HARI LOKAL (bukan UTC)",
    pass,
    pass
      ? `OK, localDay:${localDay}`
      : `GAGAL trigger - localDay:${localDay} utcDay:${utcDay}. ` +
          (localDay !== utcDay
            ? "⚠️  localDay != utcDay, KEMUNGKINAN BESAR bug timezone di repeatDays (pakai getUTCDay() padahal harusnya getDay() lokal)"
            : "kebetulan localDay == utcDay hari ini, coba lagi pas hari beda kalau mau mastiin"),
  );

  await cleanupSchedule(scheduleId);
}

// ------------------------------------------------------------------
// TEST 6: conflict detection (409) - instant, gak perlu nunggu
// ------------------------------------------------------------------
async function testConflictDetection() {
  console.log("=== TEST 6: Conflict detection ===");
  const now = new Date();
  const base = addMinutes(now, 30);

  const { status: s1, data: d1 } = await api("POST", "/schedules", {
    roomId: ROOM_ID,
    deviceId: DEVICE_ID,
    action: "on",
    scheduledDate: dateStr(now),
    startTime: timeStr(base),
    endTime: timeStr(addMinutes(base, 30)),
    repeatType: "none",
  });
  if (s1 !== 201)
    return report("Test 6: create schedule A", false, JSON.stringify(d1));

  const { status: s2, data: d2 } = await api("POST", "/schedules", {
    roomId: ROOM_ID,
    deviceId: DEVICE_ID,
    action: "off",
    scheduledDate: dateStr(now),
    startTime: timeStr(addMinutes(base, 15)),
    endTime: timeStr(addMinutes(base, 45)),
    repeatType: "none",
  });

  report(
    "Test 6: overlapping schedule ditolak dengan 409",
    s2 === 409,
    `status kedua: ${s2} - ${JSON.stringify(d2)}`,
  );

  await cleanupSchedule(d1.data?.id);
  if (s2 === 201) await cleanupSchedule(d2.data?.id);
}

// ------------------------------------------------------------------
// TEST 7: update schedule yang bikin conflict baru -> tetap harus 409
// ------------------------------------------------------------------
async function testConflictOnUpdate() {
  console.log("=== TEST 7: Conflict check saat update ===");
  const now = new Date();
  const base = addMinutes(now, 40);

  const { data: d1 } = await api("POST", "/schedules", {
    roomId: ROOM_ID,
    deviceId: DEVICE_ID,
    action: "on",
    scheduledDate: dateStr(now),
    startTime: timeStr(base),
    endTime: timeStr(addMinutes(base, 20)),
    repeatType: "none",
  });

  const { data: d2 } = await api("POST", "/schedules", {
    roomId: ROOM_ID,
    deviceId: DEVICE_ID,
    action: "off",
    scheduledDate: dateStr(now),
    startTime: timeStr(addMinutes(base, 60)),
    endTime: timeStr(addMinutes(base, 80)),
    repeatType: "none",
  });

  // update d2 supaya overlap sama d1
  const { status } = await api("PUT", `/schedules/${d2.data.id}`, {
    startTime: timeStr(addMinutes(base, 10)),
    endTime: timeStr(addMinutes(base, 30)),
  });

  report(
    "Test 7: update yang bikin overlap baru tetap ditolak 409",
    status === 409,
    `status: ${status}`,
  );

  await cleanupSchedule(d1.data?.id);
  await cleanupSchedule(d2.data?.id);
}

// ------------------------------------------------------------------
async function main() {
  await login();

  await testConflictDetection();
  await testConflictOnUpdate();
  await testScheduledDateValidation();
  await testOneShotWithEndTime();
  await testOneShotNoEndTime();
  await testRepeatDaily();
  await testRepeatWeekly();

  console.log("\n========== SUMMARY ==========");
  results.forEach((r) => console.log(`${r.pass ? "✅" : "❌"} ${r.name}`));
  const failCount = results.filter((r) => !r.pass).length;
  console.log(`\nTotal: ${results.length}, Gagal: ${failCount}`);
  process.exit(failCount > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("Script error:", err);
  process.exit(1);
});
