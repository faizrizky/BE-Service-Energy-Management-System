const { getIO } = require("./socket");
const logger = require("../helpers/logger");

function emit(event, payload) {
  try {
    getIO().emit(event, payload);
  } catch (err) {
    logger.error(`[Socket] Gagal emit "${event}":`, err.message);
  }
}

module.exports = {
  emitDeviceCreated: (device) => emit("device:created", { device }),
  emitDeviceUpdated: (device) => emit("device:updated", { device }),
  emitDeviceDeleted: (deviceId) => emit("device:deleted", { deviceId }),
  emitDeviceStatus: (payload) => emit("device:status", payload),

  emitRoomCreated: (room) => emit("room:created", { room }),
  emitRoomUpdated: (room) => emit("room:updated", { room }),
  emitRoomDeleted: (roomId) => emit("room:deleted", { roomId }),
  emitRoomPower: (roomId, results) => emit("room:power", { roomId, results }),

  emitGatewayCreated: (gateway) => emit("gateway:created", { gateway }),
  emitGatewayUpdated: (gateway) => emit("gateway:updated", { gateway }),
  emitGatewayDeleted: (gatewayId) => emit("gateway:deleted", { gatewayId }),

  emitScheduleCreated: (schedule) => emit("schedule:created", { schedule }),
  emitScheduleUpdated: (schedule) => emit("schedule:updated", { schedule }),
  emitScheduleDeleted: (scheduleId) => emit("schedule:deleted", { scheduleId }),
};
