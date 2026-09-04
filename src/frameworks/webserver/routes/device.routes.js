const express = require("express");
const router = express.Router();

const controller = require("../../../adapters/controllers/device.controller");
const authMiddleware = require("../middlewares/authMiddleware");
const checkPermission = require("../middlewares/rbacMiddleware");
const validate = require("../middlewares/validate");
const { powerLimiter } = require("../middlewares/rateLimiter");
const {
  createDeviceSchema,
  updateDeviceSchema,
  powerActionSchema,
} = require("../../../application/validators/device.validator");

router.use(authMiddleware);
router.get(
  "/tb-candidates",
  checkPermission("device", "view"),
  controller.tbCandidates,
);
router.get("/", checkPermission("device", "view"), controller.index);
router.get("/:id", checkPermission("device", "view"), controller.show);
router.post(
  "/",
  checkPermission("device", "create"),
  validate(createDeviceSchema),
  controller.store,
);
router.put(
  "/:id",
  checkPermission("device", "edit"),
  validate(updateDeviceSchema),
  controller.update,
);
router.delete("/:id", checkPermission("device", "delete"), controller.destroy);
router.post(
  "/:id/power",
  checkPermission("device", "power_control"),
  powerLimiter,
  validate(powerActionSchema),
  controller.power,
);
router.get(
  "/:id/tb-metadata",
  checkPermission("device", "view"),
  controller.tbMetadata,
);
router.get(
  "/:id/telemetry-history",
  checkPermission("device", "view"),
  controller.telemetryHistory,
);

module.exports = router;
