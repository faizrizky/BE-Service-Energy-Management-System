/**
 * Bikin Error yang bawa status HTTP (default 500) biar errorHandler bales
 * status yang pas.
 *
 * Dipake di: device.usecase.js, room.usecase.js, chirpstack/contract.js,
 *   chirpstack/deviceSync.js.
 */
function httpError(message, status = 500) {
  const err = new Error(message);
  err.status = status;
  return err;
}

module.exports = { httpError };
