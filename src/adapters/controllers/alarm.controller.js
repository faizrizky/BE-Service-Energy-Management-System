const alarmUseCase = require("../../application/use_cases/alarm/alarm.usecase");

async function index(req, res, next) {
  try {
    const { pageSize = 20, page = 0 } = req.query;
    const result = await alarmUseCase.listActiveAlarms({
      pageSize: Number(pageSize),
      page: Number(page),
    });
    res.json({ data: result });
  } catch (err) {
    next(err);
  }
}

async function ack(req, res, next) {
  try {
    const result = await alarmUseCase.acknowledgeAlarm(req.params.alarmId);
    res.json({ data: result });
  } catch (err) {
    next(err);
  }
}

async function clear(req, res, next) {
  try {
    const result = await alarmUseCase.clearActiveAlarm(req.params.alarmId);
    res.json({ data: result });
  } catch (err) {
    next(err);
  }
}

module.exports = { index, ack, clear };
