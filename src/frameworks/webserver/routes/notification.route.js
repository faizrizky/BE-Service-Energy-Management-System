const express = require("express");
const router = express.Router();

const validate = require("../middlewares/validate");
const authMiddleware = require("../middlewares/authMiddleware");
const checkPermission = require("../middlewares/rbacMiddleware");
const {
  createNotificationSchema,
  findNotificationSchema,
  patchReadAtNotification,
} = require("../../../application/validators/notification.validator");
const controller = require("../../../adapters/controllers/notification.controller");

router.use(authMiddleware);

router.post(
  "/",
  checkPermission("notification", "manage"),
  validate(createNotificationSchema),
  controller.store,
);
router.get(
  "/",
  checkPermission("notification", "view"),
  validate(findNotificationSchema, "query"),
  controller.index,
);
router.patch(
  "/reads",
  checkPermission("notification", "view"),
  validate(patchReadAtNotification),
  controller.patchMultipleReadAt,
);
router.get("/:id", checkPermission("notification", "view"), controller.show);
router.patch(
  "/:id",
  checkPermission("notification", "view"),
  validate(patchReadAtNotification),
  controller.patch,
);
router.put(
  "/:id",
  checkPermission("notification", "manage"),
  controller.update,
);
router.delete(
  "/:id",
  checkPermission("notification", "manage"),
  controller.destroy,
);

module.exports = router;
