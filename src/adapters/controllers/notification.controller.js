const notificationCreateUseCase = require("../../application/use_cases/notification/create.usecase");
const findAllNotifications = require("../../application/use_cases/notification/find.usecase");
/**
 * 
 * Blueprint Index
 *
*/
async function index(req, res, next) {
  try {
    const {
      page = 1,
      rowsPerPage = 10,
      search,
      orderBy,
    } = req.query;
    const notif = await findAllNotifications.findNotification(Number(page), Number(rowsPerPage), search, orderBy);
    res.json({ data: notif});
  } catch (err) {
      next(err);
  }
}

/**
 * 
 * Blueprint Show
 *
*/
async function show(req, res, next) {
  res.json({
    "messages": "index"
  });
}

/**
 * 
 * Blueprint Create
 *
*/
async function store(req, res, next) {
  try {
    const notif = await notificationCreateUseCase.createNotification(req.body);
    res.status(201).json({ data: notif });
  } catch (err) {
      next(err);
  }
}

/**
 * 
 * Blueprint Update
 *
*/
async function update(req, res, next) {
  res.json({
    "messages": "store"
  });
}

/**
 * 
 * Blueprint Delete
 *
*/
async function destroy(req, res, next) {
  res.json({
    "messages": "delete"
  });
}

module.exports = { 
  index, 
  show, store, update, destroy };
