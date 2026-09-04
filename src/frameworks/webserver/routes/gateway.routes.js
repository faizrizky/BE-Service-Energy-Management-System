const express = require("express");
const router = express.Router();

const controller = require("../../../adapters/controllers/gateway.controller");
const authMiddleware = require("../middlewares/authMiddleware");
const checkPermission = require("../middlewares/rbacMiddleware");
const validate = require("../middlewares/validate");
const {
  createGatewaySchema,
  updateGatewaySchema,
} = require("../../../application/validators/gateway.validator");

router.use(authMiddleware);

router.get("/", checkPermission("gateway", "view"), controller.index);
router.get("/:id", checkPermission("gateway", "view"), controller.show);
router.post(
  "/",
  checkPermission("gateway", "create"),
  validate(createGatewaySchema),
  controller.store,
);
router.put(
  "/:id",
  checkPermission("gateway", "edit"),
  validate(updateGatewaySchema),
  controller.update,
);
router.delete("/:id", checkPermission("gateway", "delete"), controller.destroy);

module.exports = router;
