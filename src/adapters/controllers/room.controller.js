const roomUseCase = require("../../application/use_cases/room/room.usecase");

/**
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */

async function index(req, res, next) {
  try {
    const rooms = await roomUseCase.listRooms();
    res.json({ data: rooms });
  } catch (err) {
    next(err);
  }
}

async function summary(req, res, next) {
  try {
    const { search } = req.query;
    const rooms = await roomUseCase.listRoomsSummary({ search });
    res.json({ data: rooms });
  } catch (err) {
    next(err);
  }
}

async function stats(req, res, next) {
  try {
    const data = await roomUseCase.getRoomStats();
    res.json({ data });
  } catch (err) {
    next(err);
  }
}

async function show(req, res, next) {
  try {
    const room = await roomUseCase.getRoomById(req.params.id);
    if (!room) return res.status(404).json({ message: "Room tidak ditemukan" });
    res.json({ data: room });
  } catch (err) {
    next(err);
  }
}

async function store(req, res, next) {
  try {
    const room = await roomUseCase.createRoom(req.body);
    res.status(201).json({ data: room });
  } catch (err) {
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const room = await roomUseCase.updateRoom(req.params.id, req.body);
    res.json({ data: room });
  } catch (err) {
    next(err);
  }
}

async function destroy(req, res, next) {
  try {
    await roomUseCase.deleteRoom(req.params.id);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

async function devices(req, res, next) {
  try {
    const room = await roomUseCase.getRoomById(req.params.id);
    if (!room) return res.status(404).json({ message: "Room tidak ditemukan" });

    const roomDevices = await roomUseCase.listDevicesInRoom(req.params.id);
    res.json({ data: roomDevices });
  } catch (err) {
    next(err);
  }
}

async function power(req, res, next) {
  try {
    const { action } = req.body;
    if (!["on", "off"].includes(action)) {
      return res.status(400).json({ message: 'action harus "on" atau "off"' });
    }
    const result = await roomUseCase.powerRoom(req.params.id, action, {
      userId: req.user.id,
    });
    res.json({ data: result });
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
};
