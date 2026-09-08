const express = require("express");
const router = express.Router();

const {
  loginController,
  meController,
  refreshController,
  logoutController,
} = require("../../../adapters/controllers/auth.controller");
const authMiddleware = require("../middlewares/authMiddleware");
const validate = require("../middlewares/validate");
const requireCaptcha = require("../middlewares/requireCaptcha");
const { authLimiter, meLimiter } = require("../middlewares/rateLimiter");
const {
  loginSchema,
  refreshSchema,
} = require("../../../application/validators/auth.validator");

router.post(
  "/login",
  authLimiter,
  validate(loginSchema),
  requireCaptcha,
  loginController,
);
router.post(
  "/refresh",
  authLimiter,
  validate(refreshSchema),
  refreshController,
);
router.post("/logout", validate(refreshSchema), logoutController);
router.get("/me", authMiddleware, meLimiter, meController);

module.exports = router;
