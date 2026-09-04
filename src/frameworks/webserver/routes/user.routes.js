const express = require("express");
const router = express.Router();

const controller = require("../../../adapters/controllers/user.controller");
const authMiddleware = require("../middlewares/authMiddleware");
const checkPermission = require("../middlewares/rbacMiddleware");
const validate = require("../middlewares/validate");
const {
  createUserSchema,
  updateUserSchema,
  updateProfileSchema,
} = require("../../../application/validators/user.validator");

router.use(authMiddleware);

router.put("/me", validate(updateProfileSchema), controller.updateMyProfile);

router.get("/", checkPermission("user", "view"), controller.index);
router.get("/:id", checkPermission("user", "view"), controller.show);
router.post(
  "/",
  checkPermission("user", "create"),
  validate(createUserSchema),
  controller.store,
);
router.put(
  "/:id",
  checkPermission("user", "edit"),
  validate(updateUserSchema),
  controller.update,
);
router.delete("/:id", checkPermission("user", "delete"), controller.destroy);

module.exports = router;
