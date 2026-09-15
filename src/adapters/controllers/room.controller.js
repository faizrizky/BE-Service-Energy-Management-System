const roomUseCase = require("../../application/use_cases/room/room.usecase");

/**
 * Handler list room pake paginasi: status power, device online/offline,
 * pemakaian 24 jam, sama jumlah perintah yang masih pending.
 *
 * Dipake di:
 * - room.routes.js → GET /api/rooms
 * - Frontend: roomsApi.list (halaman Rooms & dropdown di Device),
 *   roomsApi.listSummary (dropdown di Schedule), roomsClientApi.list
 *   (rooms/client.tsx → loadRooms).
 */
async function index(req, res, next) {
  try {
    const {
      page = 1,
      rowsPerPage = 10,
      search,
      createdFrom,
      createdTo,
    } = req.query;

    const result = await roomUseCase.listRoomsPaginated({
      search,
      createdFrom,
      createdTo,
      page: Number(page),
      rowsPerPage: Number(rowsPerPage),
    });

    res.json({ data: result });
  } catch (err) {
    next(err);
  }
}

/**
 * Handler detail room plus ringkasan pemakaian & list device-nya. Kalo nggak
 * ketemu bales 404.
 *
 * Dipake di:
 * - room.routes.js → GET /api/rooms/:id
 * - Frontend: roomsApi.getById (halaman Room detail), roomsClientApi.getById
 *   (modal edit di halaman Rooms).
 */
async function show(req, res, next) {
  try {
    const {
      page = 1,
      rowsPerPage = 10,
      search,
      createdFrom,
      createdTo,
    } = req.query;
    const room = await roomUseCase.getRoomById(req.params.id, {
      search,
      createdFrom,
      createdTo,
      page: Number(page),
      rowsPerPage: Number(rowsPerPage),
    });
    if (!room) return res.status(404).json({ message: "Room tidak ditemukan" });
    res.json({ data: room });
  } catch (err) {
    next(err);
  }
}

/**
 * Handler list device di satu room (paginasi, search & tanggal). Kalo room-nya
 * nggak ada bales 404.
 *
 * Dipake di:
 * - room.routes.js → GET /api/rooms/:id/devices
 * - Frontend: roomsApi.listDevices & roomsClientApi.listDevices (halaman
 *   Room detail).
 */
async function devices(req, res, next) {
  try {
    const {
      page = 1,
      rowsPerPage = 10,
      search,
      createdFrom,
      createdTo,
    } = req.query;

    const room = await roomUseCase.getRoomById(req.params.id);

    if (!room) {
      return res.status(404).json({ message: "Room tidak ditemukan" });
    }

    const roomDevices = await roomUseCase.listDevicesInRoom(req.params.id, {
      page: Number(page),
      rowsPerPage: Number(rowsPerPage),
      search,
      createdFrom,
      createdTo,
    });

    res.json({
      data: roomDevices,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Handler ringkasan semua room tanpa paginasi (status, gateway, pemakaian 24
 * jam).
 *
 * Dipake di:
 * - room.routes.js → GET /api/rooms/summary
 * - Frontend: belom dipanggil.
 */
async function summary(req, res, next) {
  try {
    const { search } = req.query;
    const rooms = await roomUseCase.listRoomsSummary({ search });
    res.json({ data: rooms });
  } catch (err) {
    next(err);
  }
}

/**
 * Handler ringkasan pemakaian energi 24 jam satu room.
 *
 * Dipake di:
 * - room.routes.js → GET /api/rooms/:id/usage-summary
 * - Frontend: roomsClientApi.getUsageSummary (kartu usage di Room detail).
 */
async function usageSummary(req, res, next) {
  try {
    const usage = await roomUseCase.getRoomUsageSummary(req.params.id);
    res.json({ data: usage });
  } catch (err) {
    next(err);
  }
}

/**
 * Handler statistik total room, gateway, sama device plus online/offline-nya.
 *
 * Dipake di:
 * - room.routes.js → GET /api/rooms/stats
 * - Frontend: roomsApi.getSummary (kartu statistik di halaman Rooms).
 */
async function stats(req, res, next) {
  try {
    const data = await roomUseCase.getRoomStats();
    res.json({ data });
  } catch (err) {
    next(err);
  }
}

/**
 * Handler nambah room, bales 201.
 *
 * Dipake di:
 * - room.routes.js → POST /api/rooms
 * - Frontend: roomsClientApi.create (modal tambah room).
 */
async function store(req, res, next) {
  try {
    const room = await roomUseCase.createRoom(req.body);
    res.status(201).json({ data: room });
  } catch (err) {
    next(err);
  }
}

/**
 * Handler ngedit room.
 *
 * Dipake di:
 * - room.routes.js → PUT /api/rooms/:id dan PATCH /api/rooms/:id
 * - Frontend: roomsClientApi.update (PATCH, modal edit room).
 */
async function update(req, res, next) {
  try {
    const room = await roomUseCase.updateRoom(req.params.id, req.body);
    res.json({ data: room });
  } catch (err) {
    next(err);
  }
}

/**
 * Handler hapus room (ditolak 409 kalo masih ada device-nya), bales 204.
 *
 * Dipake di:
 * - room.routes.js → DELETE /api/rooms/:id
 * - Frontend: roomsClientApi.remove (halaman Rooms).
 */
async function destroy(req, res, next) {
  try {
    await roomUseCase.deleteRoom(req.params.id);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

/**
 * Handler ON/OFF semua device di satu room lewat antrean. Bales 202 kalo ada
 * yang masih pending.
 *
 * Dipake di:
 * - room.routes.js → POST /api/rooms/:id/power
 * - Frontend: roomsClientApi.setPower (switch di halaman Rooms).
 */
async function power(req, res, next) {
  try {
    const { action } = req.body;
    if (!["on", "off"].includes(action)) {
      return res.status(400).json({ message: 'action harus "on" atau "off"' });
    }
    const result = await roomUseCase.powerRoom(req.params.id, action, {
      userId: req.user.id,
    });
    res.status(result.summary.pending > 0 ? 202 : 200).json({ data: result });
  } catch (err) {
    next(err);
  }
}

/**
 * Handler riwayat perintah (CommandLog) satu device di room tertentu.
 *
 * Dipake di:
 * - room.routes.js → GET /api/rooms/:id/devices/:deviceId/logs
 * - Frontend: roomsClientApi.getDeviceLog (modal log di Room detail).
 */
async function deviceLogs(req, res, next) {
  try {
    const { id: roomId, deviceId } = req.params;
    const logs = await roomUseCase.getDeviceLogs(roomId, deviceId);
    res.json({ data: logs });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  index,
  summary,
  stats,
  show,
  store,
  update,
  destroy,
  devices,
  power,
  deviceLogs,
  usageSummary,
};
