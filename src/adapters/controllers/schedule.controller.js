const scheduleUseCase = require('../../application/use_cases/schedule/schedule.usecase');

async function index(req, res, next) {
  try {
    const { roomId } = req.query;
    const schedules = await scheduleUseCase.listSchedules({ roomId });
    res.json({ data: schedules });
  } catch (err) {
    next(err);
  }
}

async function show(req, res, next) {
  try {
    const schedule = await scheduleUseCase.getScheduleById(req.params.id);
    if (!schedule) return res.status(404).json({ message: 'Schedule tidak ditemukan' });
    res.json({ data: schedule });
  } catch (err) {
    next(err);
  }
}

async function store(req, res, next) {
  try {
    const schedule = await scheduleUseCase.createSchedule(req.body, req.user.id);
    res.status(201).json({ data: schedule });
  } catch (err) {
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const schedule = await scheduleUseCase.updateSchedule(req.params.id, req.body);
    res.json({ data: schedule });
  } catch (err) {
    next(err);
  }
}

async function destroy(req, res, next) {
  try {
    await scheduleUseCase.deleteSchedule(req.params.id);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

module.exports = { index, show, store, update, destroy };