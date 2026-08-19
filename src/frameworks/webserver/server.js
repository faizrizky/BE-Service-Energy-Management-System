const express = require('express');
const cors = require('cors');

const { healthCheck } = require('../../adapters/controllers/health.controller');
const { errorHandler, notFoundHandler } = require('./errorHandler');

// TODO: import & pasang router per module di sini seiring development
// (authentication, user, role, room, device, gateway, schedule, report)

function createServer() {
  const app = express();

  app.use(cors());
  app.use(express.json());

  app.get('/health', healthCheck);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

module.exports = { createServer };
