const validate = require("../middlewares/validate");
const { createNotificationSchema, findNotificationSchema } = require("../../../application/validators/notification.validator")

const express = require("express");
const router = express.Router();

const controller = require("../../../adapters/controllers/notification.controller");
router.post("/", validate(createNotificationSchema), controller.store);

const authMiddleware = require("../middlewares/authMiddleware");

router.use(authMiddleware);
router.get("/", validate(findNotificationSchema, "query"), controller.index);
router.get("/:id", controller.show);
router.put("/:id", controller.update);
router.delete("/:id", controller.destroy)

module.exports = router;
