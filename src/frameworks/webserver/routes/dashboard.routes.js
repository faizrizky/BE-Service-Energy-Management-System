const express = require("express");
const router = express.Router();

const controller = require("../../../adapters/controllers/report.controller");
const authMiddleware = require("../middlewares/authMiddleware");
const checkPermission = require("../middlewares/rbacMiddleware");

router.use(authMiddleware);

router.get(
  "/summary",
  checkPermission("dashboard", "view"),
  controller.dashboardSummary,
);
router.get(
  "/energy-usage-timeline",
  checkPermission("dashboard", "view"),
  controller.energyUsageTimeline,
);
router.get(
  "/top-risky-rooms",
  checkPermission("dashboard", "view"),
  controller.topRiskyRooms,
);
router.get(
  "/schedules",
  checkPermission("dashboard", "view"),
  controller.activeSchedules,
);

module.exports = router;
