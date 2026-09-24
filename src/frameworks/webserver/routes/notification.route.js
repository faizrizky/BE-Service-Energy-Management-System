const express = require("express");
const router = express.Router();

const controller = require("../../../adapters/controllers/notification.controller");
const authMiddleware = require("../middlewares/authMiddleware");

router.use(authMiddleware);
router.get("/", controller.index);
router.get("/:id", controller.show);
router.post("/", controller.store);
router.put("/:id", controller.update);
router.delete("/:id", controller.destroy)

module.exports = router;
