const notificationCreateUseCase = require("../../application/use_cases/notification/create.usecase");
const notificationPatchUseCase = require("../../application/use_cases/notification/patch.usecase");
const findAllNotifications = require("../../application/use_cases/notification/find.usecase");
/**
 * 
 * Blueprint Index
 *
*/
async function index(req, res, next) {
  try {
    const { page = 1, rowsPerPage = 10, search, orderBy, readAt,} = req.query;

    const notif = await findAllNotifications.findNotification(
      page, rowsPerPage, search, orderBy, readAt
    );    

    res.json({data: notif});
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
 * Blueprint Patch
 *
*/
async function patch(req, res, next) {
  try {
    const notif = await notificationPatchUseCase.patchReadAtNotification(req.params.id, req.body);
    res.status(200).json({ data: notif });
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
    "messages": "update"
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

module.exports = { index, show, store, patch, update, destroy };
