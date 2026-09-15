const { getIO } = require("./socket");
const logger = require("../helpers/logger");

/**
 * Kirim event Socket.IO ke semua client. Kalo socket belom siap, cuma dicatet
 * sebagai error.
 *
 * Dipake di: Semua helper emit* di file ini.
 */
function emit(event, payload) {
  try {
    getIO().emit(event, payload);
  } catch (err) {
    logger.error(`[Socket] Gagal emit "${event}":`, err.message);
  }
}

module.exports = {
  /**
   * Event device:created abis device dibikin.
   *
   * Dipake di:
   * - device.usecase.js → createDevice
   * - Frontend: halaman Device.
   */
  emitDeviceCreated: (device) => emit("device:created", { device }),

  /**
   * Event device:updated abis data atau interval device berubah.
   *
   * Dipake di:
   * - device.usecase.js → updateDevice, setDeviceInterval
   * - Frontend: halaman Device.
   */
  emitDeviceUpdated: (device) => emit("device:updated", { device }),

  /**
   * Event device:deleted abis device dihapus.
   *
   * Dipake di:
   * - device.usecase.js → deleteDevice
   * - Frontend: halaman Device.
   */
  emitDeviceDeleted: (deviceId) => emit("device:deleted", { deviceId }),

  /**
   * Event device:status pas status relai atau reading energi device berubah.
   *
   * Dipake di:
   * - device.usecase.js → completeRelayCommand, runTelemetryFetch
   * - Frontend: Device, Room detail, Rooms, Dashboard, Report, Gateway.
   */
  emitDeviceStatus: (payload) => emit("device:status", payload),

  /**
   * Event device:command buat progres perintah ON/OFF (pending, success,
   * failed, cancelled).
   *
   * Dipake di:
   * - device.usecase.js → requestRelayCommand, updatePendingCommand
   * - Frontend: hooks/use-device-commands.ts (Device, Room detail, Rooms).
   */
  emitDeviceCommand: (payload) => emit("device:command", payload),

  /**
   * Event room:created abis room dibikin.
   *
   * Dipake di:
   * - room.usecase.js → createRoom
   * - Frontend: halaman Rooms.
   */
  emitRoomCreated: (room) => emit("room:created", { room }),

  /**
   * Event room:updated abis room diedit.
   *
   * Dipake di:
   * - room.usecase.js → updateRoom
   * - Frontend: halaman Rooms & Dashboard.
   */
  emitRoomUpdated: (room) => emit("room:updated", { room }),

  /**
   * Event room:deleted abis room dihapus.
   *
   * Dipake di:
   * - room.usecase.js → deleteRoom
   * - Frontend: halaman Rooms.
   */
  emitRoomDeleted: (roomId) => emit("room:deleted", { roomId }),

  /**
   * Event room:power isinya hasil perintah ON/OFF satu room.
   *
   * Dipake di:
   * - room.usecase.js → powerRoom
   * - Frontend: halaman Rooms & Dashboard.
   */
  emitRoomPower: (roomId, results) => emit("room:power", { roomId, results }),

  /**
   * Event gateway:created abis gateway dibikin.
   *
   * Dipake di:
   * - gateway.usecase.js → createGateway
   * - Frontend: halaman Gateway.
   */
  emitGatewayCreated: (gateway) => emit("gateway:created", { gateway }),

  /**
   * Event gateway:updated abis gateway diedit.
   *
   * Dipake di:
   * - gateway.usecase.js → updateGateway
   * - Frontend: halaman Gateway.
   */
  emitGatewayUpdated: (gateway) => emit("gateway:updated", { gateway }),

  /**
   * Event gateway:deleted abis gateway dihapus.
   *
   * Dipake di:
   * - gateway.usecase.js → deleteGateway
   * - Frontend: halaman Gateway.
   */
  emitGatewayDeleted: (gatewayId) => emit("gateway:deleted", { gatewayId }),

  /**
   * Event schedule:created abis schedule dibikin.
   *
   * Dipake di:
   * - schedule.usecase.js → createSchedule
   * - Frontend: halaman Schedule & Dashboard.
   */
  emitScheduleCreated: (schedule) => emit("schedule:created", { schedule }),

  /**
   * Event schedule:updated abis schedule diedit.
   *
   * Dipake di:
   * - schedule.usecase.js → updateSchedule
   * - Frontend: halaman Schedule & Dashboard.
   */
  emitScheduleUpdated: (schedule) => emit("schedule:updated", { schedule }),

  /**
   * Event schedule:deleted abis schedule dihapus.
   *
   * Dipake di:
   * - schedule.usecase.js → deleteSchedule
   * - Frontend: halaman Schedule & Dashboard.
   */
  emitScheduleDeleted: (scheduleId) => emit("schedule:deleted", { scheduleId }),
};
