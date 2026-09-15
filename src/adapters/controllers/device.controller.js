const deviceUseCase = require("../../application/use_cases/device/device.usecase");

/**
 * Handler list device pake paginasi, bisa difilter search, room, gateway, sama
 * tanggal dibuat.
 *
 * Dipake di:
 * - device.routes.js → GET /api/devices
 * - Frontend: devicesApi.list (halaman Device & Schedule),
 *   devicesClientApi.list (device/client.tsx).
 */
async function index(req, res, next) {
  try {
    const {
      roomId,
      gatewayId,
      page = 1,
      rowsPerPage = 10,
      search,
      createdFrom,
      createdTo,
    } = req.query;
    const devices = await deviceUseCase.listDevicesPaginated({
      search,
      roomId,
      gatewayId,
      createdFrom,
      createdTo,
      page: Number(page),
      rowsPerPage: Number(rowsPerPage),
    });
    res.json({ data: devices });
  } catch (err) {
    next(err);
  }
}

/**
 * Handler detail satu device. Kalo nggak ketemu bales 404.
 *
 * Dipake di:
 * - device.routes.js → GET /api/devices/:id
 * - Frontend: devicesClientApi.getById (modal detail di halaman Device).
 */
async function show(req, res, next) {
  try {
    const device = await deviceUseCase.getDeviceById(req.params.id);
    if (!device)
      return res.status(404).json({ message: "Device tidak ditemukan" });
    res.json({ data: device });
  } catch (err) {
    next(err);
  }
}

/**
 * Handler nambah device (body udah divalidasi createDeviceSchema), bales 201.
 *
 * Dipake di:
 * - device.routes.js → POST /api/devices
 * - Frontend: devicesClientApi.create (modal tambah device).
 */
async function store(req, res, next) {
  try {
    const device = await deviceUseCase.createDevice(req.body);
    res.status(201).json({ data: device });
  } catch (err) {
    next(err);
  }
}

/**
 * Handler ngedit device, termasuk ganti devEUI sama interval.
 *
 * Dipake di:
 * - device.routes.js → PUT /api/devices/:id
 * - Frontend: devicesClientApi.update (modal edit device).
 */
async function update(req, res, next) {
  try {
    const device = await deviceUseCase.updateDevice(req.params.id, req.body);
    res.json({ data: device });
  } catch (err) {
    next(err);
  }
}

/**
 * Handler hapus device (di ChirpStack juga ikut dihapus), bales 204.
 *
 * Dipake di:
 * - device.routes.js → DELETE /api/devices/:id
 * - Frontend: devicesClientApi.remove (halaman Device & Room detail, hapus
 *   satuan/banyak).
 */
async function destroy(req, res, next) {
  try {
    await deviceUseCase.deleteDevice(req.params.id);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

/**
 * Handler perintah ON/OFF satu device. Perintahnya dimasukin antrean terus
 * diproses di belakang; bales 202 kalo masih pending, 200 kalo langsung gagal.
 *
 * Dipake di:
 * - device.routes.js → POST /api/devices/:id/power
 * - Frontend: devicesClientApi.setPower (switch power di halaman Device &
 *   Room detail).
 */
async function power(req, res, next) {
  try {
    const { action } = req.body;
    if (!["on", "off"].includes(action)) {
      return res.status(400).json({ message: 'action harus "on" atau "off"' });
    }
    const result = await deviceUseCase.powerDevice(req.params.id, action, {
      userId: req.user.id,
    });

    res.status(result.status === "pending" ? 202 : 200).json({ data: result });
  } catch (err) {
    next(err);
  }
}

/**
 * Handler buat batalin perintah ON/OFF device yang masih pending.
 *
 * Dipake di:
 * - device.routes.js → POST /api/devices/:id/power/cancel
 * - Frontend: devicesClientApi.cancelPower (tombol × di switch yang lagi
 *   pending).
 */
async function cancelPower(req, res, next) {
  try {
    const result = await deviceUseCase.cancelRelayCommand(req.params.id);
    res.json({ data: result });
  } catch (err) {
    next(err);
  }
}

/**
 * Handler minta telemetry terbaru langsung dari meter (nungguin uplink), terus
 * disimpen.
 *
 * Dipake di:
 * - device.routes.js → POST /api/devices/:id/telemetry
 * - Frontend: belom dipanggil.
 */
async function ping(req, res, next) {
  try {
    const { timeout } = req.body || {};
    const result = await deviceUseCase.pingDevice(req.params.id, {
      timeout: timeout ? Number(timeout) : undefined,
    });
    res.json({ data: result });
  } catch (err) {
    next(err);
  }
}

/**
 * Handler ganti interval laporan meter (menit) lewat downlink ChirpStack.
 *
 * Dipake di:
 * - device.routes.js → POST /api/devices/:id/interval
 * - Frontend: belom dipanggil.
 */
async function interval(req, res, next) {
  try {
    const result = await deviceUseCase.setDeviceInterval(req.params.id, {
      intervalMinutes: Number(req.body.intervalMinutes),
      userId: req.user.id,
    });
    res.json({ data: result });
  } catch (err) {
    next(err);
  }
}

/**
 * Handler ngambil data device langsung dari ChirpStack pake devEUI device EMS.
 *
 * Dipake di:
 * - device.routes.js → GET /api/devices/:id/chirpstack-metadata
 * - Frontend: belom dipanggil.
 */
async function chirpstackMetadata(req, res, next) {
  try {
    const data = await deviceUseCase.getDeviceChirpstackMetadata(req.params.id);
    res.json({ data });
  } catch (err) {
    next(err);
  }
}

/**
 * Handler riwayat reading energi device di rentang from–to (maks 90 hari).
 *
 * Dipake di:
 * - device.routes.js → GET /api/devices/:id/telemetry-history
 * - Frontend: belom dipanggil.
 */
async function telemetryHistory(req, res, next) {
  try {
    const { from, to, limit } = req.query;
    const data = await deviceUseCase.getDeviceTelemetryHistory(req.params.id, {
      from,
      to,
      limit,
    });
    res.json({ data });
  } catch (err) {
    next(err);
  }
}

/**
 * Handler list device yang ada di aplikasi ChirpStack plus tanda udah
 * dipasangin ke device EMS apa belom. Param page/pageSize dikirim tapi belom
 * dipake use case-nya.
 *
 * Dipake di:
 * - device.routes.js → GET /api/devices/chirpstack-candidates
 * - Frontend: belom dipanggil.
 */
async function chirpstackCandidates(req, res, next) {
  try {
    const { page = 0, pageSize = 50 } = req.query;
    const result = await deviceUseCase.listChirpstackDeviceCandidates({
      page: Number(page),
      pageSize: Number(pageSize),
    });
    res.json({ data: result });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  index,
  show,
  store,
  update,
  destroy,
  power,
  cancelPower,
  ping,
  interval,
  chirpstackCandidates,
  chirpstackMetadata,
  telemetryHistory,
};
