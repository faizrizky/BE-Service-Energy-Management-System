const deviceUseCase = require('../../application/use_cases/device/device.usecase');

async function index(req, res, next) {
  try {
    const { roomId, gatewayId } = req.query;
    const devices = await deviceUseCase.listDevices({ roomId, gatewayId });
    res.json({ data: devices });
  } catch (err) {
    next(err);
  }
}

async function show(req, res, next) {
  try {
    const device = await deviceUseCase.getDeviceById(req.params.id);
    if (!device) return res.status(404).json({ message: 'Device tidak ditemukan' });
    res.json({ data: device });
  } catch (err) {
    next(err);
  }
}

async function store(req, res, next) {
  try {
    const device = await deviceUseCase.createDevice(req.body);
    res.status(201).json({ data: device });
  } catch (err) {
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const device = await deviceUseCase.updateDevice(req.params.id, req.body);
    res.json({ data: device });
  } catch (err) {
    next(err);
  }
}

async function destroy(req, res, next) {
  try {
    await deviceUseCase.deleteDevice(req.params.id);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

async function power(req, res, next) {
  try {
    const { action } = req.body;
    if (!['on', 'off'].includes(action)) {
      return res.status(400).json({ message: 'action harus "on" atau "off"' });
    }
    const result = await deviceUseCase.powerDevice(req.params.id, action, req.user.id);
    res.json({ data: result });
  } catch (err) {
    next(err);
  }
}
module.exports = { index, show, store, update, destroy, power };