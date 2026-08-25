const express = require("express");
const router = express.Router();

const controller = require("../../../adapters/controllers/room.controller");
const authMiddleware = require("../middlewares/authMiddleware");
const checkPermission = require("../middlewares/rbacMiddleware");

router.use(authMiddleware);

router.get("/summary", checkPermission("room", "view"), controller.summary);
router.get("/stats", checkPermission("room", "view"), controller.stats);

router.get("/", checkPermission("room", "view"), controller.index);
router.get("/:id", checkPermission("room", "view"), controller.show);
router.get("/:id/devices", checkPermission("room", "view"), controller.devices);
router.post("/", checkPermission("room", "create"), controller.store);
router.put("/:id", checkPermission("room", "edit"), controller.update);
router.patch("/:id", checkPermission("room", "edit"), controller.update);
router.delete("/:id", checkPermission("room", "delete"), controller.destroy);
router.post(
  "/:id/power",
  checkPermission("room", "power_control"),
  controller.power,
);

module.exports = router;
