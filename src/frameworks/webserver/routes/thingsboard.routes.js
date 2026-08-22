const express = require("express");
const router = express.Router();

const {
  handleDeviceUpdate,
} = require("../../../adapters/controllers/thingsboard-webhook.controller");

router.post("/device-update", handleDeviceUpdate);

module.exports = router;
