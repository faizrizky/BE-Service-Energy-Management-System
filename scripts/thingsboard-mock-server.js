const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env.mock") });
const express = require("express");
const crypto = require("crypto");
const {
  parseRelayRpcPayload,
  buildWebhookBody,
} = require("../src/frameworks/thingsboard/contract");

/**
 * ====================================================================
 * MOCK THINGSBOARD SERVER - buat testing
 * ====================================================================
 * Server ini cuma buat simulasiin komunikasi dua arah antara backend sama "ThingsBoard":
 *
 *   1. Backend -> "ThingsBoard": RPC one-way buat ngontrol relay
 *      (endpoint POST /api/rpc/oneway/:deviceId, dipanggil dari
 *      src/frameworks/thingsboard/client.js#sendRelayCommand)
 *
 *   2. "ThingsBoard" -> Backend: webhook yang dikirim tiap ada perubahan
 *      telemetry/status (anggap aja ini simulasi Rule Engine "REST API Call"
 *      node, yang targetnya endpoint POST /api/thingsboard/device-update
 *      di backend)
 *
 * Bentuk request/response (nama RPC method, body webhook, dll) ada di src/frameworks/thingsboard/
 * contract.js, yang juga dipakai bareng sama client.js dan webhook controller.
 *
 * Jadi nanti kalau tim infra udah kasih kontrak ThingsBoard yang asli,
 * cukup ubah contract.js aja. Tiga file ini bakal otomatis ngikutin.
 * ====================================================================
 */

const MOCK_PORT = parseInt(process.env.TB_MOCK_PORT, 10) || 8082;
const BACKEND_WEBHOOK_URL =
  process.env.BACKEND_WEBHOOK_URL ||
  "http://localhost:4000/api/thingsboard/device-update";
const WEBHOOK_SECRET = process.env.TB_WEBHOOK_SECRET;
const UPLINK_INTERVAL_MS =
  parseInt(process.env.TB_MOCK_UPLINK_INTERVAL_MS, 10) || 10_000;

if (!WEBHOOK_SECRET) {
  console.error(
    "[Mock TB] TB_WEBHOOK_SECRET wajib diisi di .env, harus sama persis dengan punya backend",
  );
  process.exit(1);
}

/**
 * Daftar device simulasi. tbDeviceId di sini yang harus kamu isi manual
 * ke kolom Device.tbDeviceId di database backend (lewat PUT /api/devices/:id)
 * supaya backend tahu device mana yang dipetakan ke simulasi mana.
 */
const SIMULATED_DEVICES = [
  { tbDeviceId: crypto.randomUUID(), name: "AC Command Center" },
  { tbDeviceId: crypto.randomUUID(), name: "Lampu Ruang Server" },
];

const deviceState = new Map(
  SIMULATED_DEVICES.map((d) => [
    d.tbDeviceId,
    { name: d.name, relayStatus: "off", usageKwh: 0 },
  ]),
);

function randomWatt() {
  return Math.round(80 + Math.random() * 170);
}

// --------------------------------------------------------------------
// 1. REST API mock (arah: backend -> ThingsBoard)
// --------------------------------------------------------------------

const app = express();
app.use(express.json());

// Dipakai backend buat health check (lihat health.controller.js).
// Mock ini tidak validasi API key sama sekali - fokusnya cuma tes alur
// RPC & webhook, bukan tes security ThingsBoard asli.
app.get("/api/auth/user", (req, res) => {
  res.json({
    id: { id: "mock-user" },
    authority: "TENANT_ADMIN",
    email: "mock@local",
  });
});

app.get("/api/tenant/devices", (req, res) => {
  res.json({
    data: SIMULATED_DEVICES.map((d) => ({
      id: { id: d.tbDeviceId },
      name: d.name,
      type: "smart-meter",
    })),
    totalPages: 1,
    totalElements: SIMULATED_DEVICES.length,
    hasNext: false,
  });
});

app.post("/api/rpc/oneway/:deviceId", (req, res) => {
  const { deviceId } = req.params;

  const state = deviceState.get(deviceId);
  if (!state) {
    console.warn(`[Mock TB] RPC ke device tidak dikenal: ${deviceId}`);
    return res
      .status(404)
      .json({ message: "Device tidak ditemukan di simulasi" });
  }

  const action = parseRelayRpcPayload(req.body);
  if (action === null) {
    console.warn(
      `[Mock TB] RPC payload tidak dikenal: ${JSON.stringify(req.body)}`,
    );
    return res.status(400).json({
      message: "RPC payload tidak sesuai kontrak yang dikenali mock ini",
    });
  }

  state.relayStatus = action;

  console.log(
    `[Mock TB] RPC diterima: "${state.name}" (${deviceId}) -> relay ${action}`,
  );

  res.status(200).json({});

  // Begitu relay berubah, langsung kirim satu event webhook (di luar siklus
  // interval reguler) supaya perubahan status terasa "real-time" saat dites
  pushWebhookEvent(deviceId, state).catch((err) => {
    console.error(`[Mock TB] Gagal kirim webhook setelah RPC:`, err.message);
  });
});

app.get(
  "/api/plugins/telemetry/DEVICE/:deviceId/values/timeseries",
  (req, res) => {
    const { deviceId } = req.params;
    const state = deviceState.get(deviceId);
    if (!state)
      return res
        .status(404)
        .json({ message: "Device tidak ditemukan di simulasi" });

    const now = Date.now();
    res.json({
      powerWatt: [
        {
          ts: now,
          value: String(state.relayStatus === "on" ? randomWatt() : 0),
        },
      ],
      usageKwh: [{ ts: now, value: String(state.usageKwh.toFixed(3)) }],
    });
  },
);

app.listen(MOCK_PORT, () => {
  console.log(`[Mock TB] REST API jalan di http://localhost:${MOCK_PORT}`);
  console.log(`[Mock TB] Webhook target ke backend: ${BACKEND_WEBHOOK_URL}`);
  console.log(
    "[Mock TB] Device simulasi (isi tbDeviceId ini ke kolom Device.tbDeviceId di backend):",
  );
  SIMULATED_DEVICES.forEach((d) =>
    console.log(`  - ${d.name}: ${d.tbDeviceId}`),
  );
});

// --------------------------------------------------------------------
// 2. Webhook pusher (arah: ThingsBoard -> backend)
// --------------------------------------------------------------------

async function pushWebhookEvent(tbDeviceId, state) {
  const powerWatt = state.relayStatus === "on" ? randomWatt() : 0;

  if (state.relayStatus === "on") {
    const deltaKwh = (powerWatt * (UPLINK_INTERVAL_MS / 1000 / 3600)) / 1000;
    state.usageKwh += deltaKwh;
  }

  const body = buildWebhookBody({
    tbDeviceId,
    relayStatus: state.relayStatus,
    powerWatt,
    usageKwh: Number(state.usageKwh.toFixed(4)),
  });

  const response = await fetch(BACKEND_WEBHOOK_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Webhook-Secret": WEBHOOK_SECRET,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(5000),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Backend HTTP ${response.status}: ${text}`);
  }

  console.log(
    `[Mock TB] Webhook terkirim: "${state.name}" -> ${JSON.stringify(body)}`,
  );
}

// Uplink berkala, meniru interval data logging meter fisik (default tiap
// 10 detik biar gampang dites; sesuaikan lewat TB_MOCK_UPLINK_INTERVAL_MS).
setInterval(() => {
  deviceState.forEach((state, tbDeviceId) => {
    if (state.relayStatus !== "on") return;
    pushWebhookEvent(tbDeviceId, state).catch((err) => {
      console.error(
        `[Mock TB] Gagal kirim webhook berkala untuk "${state.name}":`,
        err.message,
      );
    });
  });
}, UPLINK_INTERVAL_MS);
