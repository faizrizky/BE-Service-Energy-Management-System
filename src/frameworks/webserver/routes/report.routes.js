const express = require("express");
const router = express.Router();

const controller = require("../../../adapters/controllers/report.controller");
const authMiddleware = require("../middlewares/authMiddleware");
const checkPermission = require("../middlewares/rbacMiddleware");

router.use(authMiddleware);

router.get(
  "/rooms/:id/usage",
  checkPermission("report", "view"),
  controller.roomUsage,
);
router.get(
  "/devices/:id/usage",
  checkPermission("report", "view"),
  controller.deviceUsage,
);
router.get(
  "/export",
  checkPermission("report", "export"),
  controller.exportEnergy,
);

module.exports = router;
