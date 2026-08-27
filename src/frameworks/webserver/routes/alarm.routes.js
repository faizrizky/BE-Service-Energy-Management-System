const express = require("express");
const router = express.Router();

const controller = require("../../../adapters/controllers/alarm.controller");
const authMiddleware = require("../middlewares/authMiddleware");
const checkPermission = require("../middlewares/rbacMiddleware");

router.use(authMiddleware);

router.get("/", checkPermission("alarm", "view"), controller.index);
router.post("/:alarmId/ack", checkPermission("alarm", "ack"), controller.ack);
router.post(
  "/:alarmId/clear",
  checkPermission("alarm", "ack"),
  controller.clear,
);

module.exports = router;
