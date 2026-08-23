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

module.exports = router;
