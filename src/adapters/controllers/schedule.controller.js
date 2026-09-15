const scheduleUseCase = require("../../application/use_cases/schedule/schedule.usecase");

/**
 * Handler list schedule pake paginasi, bisa filter room, status
 * (active/upcoming), tanggal, sama search.
 *
 * Dipake di:
 * - schedule.routes.js → GET /api/schedules
 * - Frontend: scheduleApi.list (halaman Schedule & Dashboard),
 *   scheduleClientApi.list (schedule/client.tsx).
 */
async function index(req, res, next) {
  try {
    const {
      roomId,
      page = 1,
      rowsPerPage = 10,
      search,
      status,
      scheduledFrom,
      scheduledTo,
    } = req.query;
    const result = await scheduleUseCase.listSchedulesPaginated({
      roomId,
      page: Number(page),
      rowsPerPage: Number(rowsPerPage),
      search,
      status,
      scheduledFrom,
      scheduledTo,
    });
    res.json({ data: result });
  } catch (err) {
    next(err);
  }
}

/**
 * Handler detail schedule. Kalo nggak ketemu bales 404.
 *
 * Dipake di:
 * - schedule.routes.js → GET /api/schedules/:id
 * - Frontend: scheduleClientApi.getById (detail di halaman Schedule).
 */
async function show(req, res, next) {
  try {
    const schedule = await scheduleUseCase.getScheduleById(req.params.id);
    if (!schedule)
      return res.status(404).json({ message: "Schedule tidak ditemukan" });
    res.json({ data: schedule });
  } catch (err) {
    next(err);
  }
}

/**
 * Handler nambah schedule, pembuatnya diambil dari user yang login. Kalo
 * bentrok sama jadwal lain bales 409.
 *
 * Dipake di:
 * - schedule.routes.js → POST /api/schedules
 * - Frontend: scheduleClientApi.create (modal tambah schedule).
 */
async function store(req, res, next) {
  try {
    const schedule = await scheduleUseCase.createSchedule(
      req.body,
      req.user.id,
    );
    res.status(201).json({ data: schedule });
  } catch (err) {
    next(err);
  }
}

/**
 * Handler ngedit schedule, sambil dicek bentrok lagi.
 *
 * Dipake di:
 * - schedule.routes.js → PUT /api/schedules/:id
 * - Frontend: scheduleClientApi.update (modal edit schedule).
 */
async function update(req, res, next) {
  try {
    const schedule = await scheduleUseCase.updateSchedule(
      req.params.id,
      req.body,
    );
    res.json({ data: schedule });
  } catch (err) {
    next(err);
  }
}

/**
 * Handler hapus schedule, bales 204.
 *
 * Dipake di:
 * - schedule.routes.js → DELETE /api/schedules/:id
 * - Frontend: scheduleClientApi.remove (halaman Schedule).
 */
async function destroy(req, res, next) {
  try {
    await scheduleUseCase.deleteSchedule(req.params.id);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

module.exports = { index, show, store, update, destroy };
