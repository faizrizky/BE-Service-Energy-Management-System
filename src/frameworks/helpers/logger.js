/**
 * Logger untuk informasi log dari setiap fungsi yang dijalankan
 */

/**
 * Waktu sekarang format ISO buat awalan log.
 *
 * Dipake di: logger.info, logger.warn, logger.debug, logger.error (file ini).
 */
function timestamp() {
  return new Date().toISOString();
}

const isDebug = () => process.env.LOG_LEVEL === "debug";

const logger = {
  debug: (...args) => {
    if (isDebug()) console.log(`[${timestamp()}] [DEBUG]`, ...args);
  },
  info: (...args) => console.log(`[${timestamp()}] [INFO]`, ...args),
  warn: (...args) => console.warn(`[${timestamp()}] [WARN]`, ...args),
  error: (...args) => console.error(`[${timestamp()}] [ERROR]`, ...args),
};

module.exports = logger;
