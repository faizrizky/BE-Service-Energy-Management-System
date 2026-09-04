const express = require("express");
const router = express.Router();

const controller = require("../../../adapters/controllers/role.controller");
const authMiddleware = require("../middlewares/authMiddleware");
const checkPermission = require("../middlewares/rbacMiddleware");
const validate = require("../middlewares/validate");
const {
  createRoleSchema,
  updateRoleSchema,
} = require("../../../application/validators/role.validator");

router.use(authMiddleware);

router.get(
  "/permissions",
  checkPermission("role", "view"),
  controller.permissionsList,
);
router.get("/", checkPermission("role", "view"), controller.index);
router.get("/:id", checkPermission("role", "view"), controller.show);
router.post(
  "/",
  checkPermission("role", "create"),
  validate(createRoleSchema),
  controller.store,
);
router.put(
  "/:id",
  checkPermission("role", "edit"),
  validate(updateRoleSchema),
  controller.update,
);
router.delete("/:id", checkPermission("role", "delete"), controller.destroy);

module.exports = router;
