const roomUseCase = require('../../application/use_cases/room/room.usecase');

async function index(req, res, next) {
  try {
    const rooms = await roomUseCase.listRooms();
    res.json({ data: rooms });
  } catch (err) {
    next(err);
  }
}

async function show(req, res, next) {
  try {
    const room = await roomUseCase.getRoomById(req.params.id);
    if (!room) return res.status(404).json({ message: 'Room tidak ditemukan' });
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
    if (!room) return res.status(404).json({ message: 'Room tidak ditemukan' });

    const roomDevices = await roomUseCase.listDevicesInRoom(req.params.id);
    res.json({ data: roomDevices });
  } catch (err) {
    next(err);
  }
}

module.exports = { index, show, store, update, destroy, devices };