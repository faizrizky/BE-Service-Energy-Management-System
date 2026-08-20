const express = require('express');
const cors = require('cors');

const { healthCheck } = require('../../adapters/controllers/health.controller');
const { errorHandler, notFoundHandler } = require('./errorHandler');

const authRoutes = require('./routes/auth.routes');
const userRoutes = require('./routes/user.routes');
const roleRoutes = require('./routes/role.routes');

// TODO: import & pasang router per module di sini seiring development
// (authentication, user, role, room, device, gateway, schedule, report)

function createServer() {
  const app = express();

  app.use(cors());
  app.use(express.json());

  app.get('/health', healthCheck);

  app.use('/api/auth', authRoutes);
  app.use('/api/users', userRoutes);
  app.use('/api/roles', roleRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

module.exports = { createServer };
