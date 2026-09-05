const express = require("express");
const router = express.Router();

const controller = require("../../../adapters/controllers/room.controller");
const authMiddleware = require("../middlewares/authMiddleware");
const checkPermission = require("../middlewares/rbacMiddleware");
const validate = require("../middlewares/validate");
const { powerLimiter } = require("../middlewares/rateLimiter");
const {
  createRoomSchema,
  updateRoomSchema,
  powerActionSchema,
} = require("../../../application/validators/room.validator");

router.use(authMiddleware);

router.get("/summary", checkPermission("room", "view"), controller.summary);
router.get("/stats", checkPermission("room", "view"), controller.stats);

router.get("/", checkPermission("room", "view"), controller.index);
router.get("/:id", checkPermission("room", "view"), controller.show);
router.get("/:id/devices", checkPermission("room", "view"), controller.devices);
router.post(
  "/",
  checkPermission("room", "create"),
  validate(createRoomSchema),
  controller.store,
);
router.put(
  "/:id",
  checkPermission("room", "edit"),
  validate(updateRoomSchema),
  controller.update,
);
router.patch(
  "/:id",
  checkPermission("room", "edit"),
  validate(updateRoomSchema),
  controller.update,
);
router.delete("/:id", checkPermission("room", "delete"), controller.destroy);
router.post(
  "/:id/power",
  checkPermission("room", "power_control"),
  powerLimiter,
  validate(powerActionSchema),
  controller.power,
);
router.get(
  "/:id/devices/:deviceId/logs",
  checkPermission("room", "view"),
  controller.deviceLogs,
);
router.get(
  "/:id/usage-summary",
  checkPermission("room", "view"),
  controller.usageSummary,
);

module.exports = router;
