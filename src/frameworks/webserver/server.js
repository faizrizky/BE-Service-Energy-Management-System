const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const hpp = require("hpp");

const { healthCheck } = require("../../adapters/controllers/health.controller");
const { errorHandler, notFoundHandler } = require("./errorHandler");
const { apiLimiter } = require("./middlewares/rateLimiter");
const { config } = require("../../config/config");

const authRoutes = require("./routes/auth.routes");
const userRoutes = require("./routes/user.routes");
const roleRoutes = require("./routes/role.routes");
const gatewayRoutes = require("./routes/gateway.routes");
const deviceRoutes = require("./routes/device.routes");
const roomRoutes = require("./routes/room.routes");
const scheduleRoutes = require("./routes/schedule.routes");
const thingsboardRoutes = require("./routes/thingsboard.routes");
const dashboardRoutes = require("./routes/dashboard.routes");
const reportRoutes = require("./routes/report.routes");
const alarmRoutes = require("./routes/alarm.routes");

function forceHttps(req, res, next) {
  if (!config.app.forceHttps) return next();
  if (req.headers["x-forwarded-proto"] === "https") return next();
  return res.redirect(301, `https://${req.headers.host}${req.originalUrl}`);
}

function createServer() {
  const app = express();

  app.set("trust proxy", 1);

  app.use(forceHttps);

  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: "cross-origin" },
    }),
  );

  app.use(
    cors({
      origin(origin, callback) {
        const { allowedOrigins } = config.cors;
        if (
          !origin ||
          allowedOrigins.length === 0 ||
          allowedOrigins.includes(origin)
        ) {
          return callback(null, true);
        }
        callback(new Error("Origin tidak diizinkan oleh CORS"));
      },
      credentials: true,
    }),
  );

  app.use(express.json({ limit: "1mb" }));
  app.use(hpp());
  app.use(apiLimiter);

  app.get("/health", healthCheck);

  app.use("/api/auth", authRoutes);
  app.use("/api/users", userRoutes);
  app.use("/api/roles", roleRoutes);
  app.use("/api/gateways", gatewayRoutes);
  app.use("/api/devices", deviceRoutes);
  app.use("/api/rooms", roomRoutes);
  app.use("/api/schedules", scheduleRoutes);
  app.use("/api/thingsboard", thingsboardRoutes);
  app.use("/api/dashboard", dashboardRoutes);
  app.use("/api/reports", reportRoutes);
  app.use("/api/alarms", alarmRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

module.exports = { createServer };
