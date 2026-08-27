const express = require("express");
const cors = require("cors");

const { healthCheck } = require("../../adapters/controllers/health.controller");
const { errorHandler, notFoundHandler } = require("./errorHandler");

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

function createServer() {
  const app = express();

  app.use(cors());
  app.use(express.json());

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
