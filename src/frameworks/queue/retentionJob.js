const logger = require("../helpers/logger");
const { config } = require("../../config/config");
const {
  pruneOldReadings,
} = require("../../application/use_cases/report/report.usecase");

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

async function runPrune() {
  try {
    const { deletedCount, cutoff } = await pruneOldReadings();
    if (deletedCount > 0) {
      logger.info(
        `[Retention] Hapus ${deletedCount} energy_readings sebelum ${cutoff.toISOString()}`,
      );
    }
  } catch (err) {
    logger.error("[Retention] Gagal jalanin pruning:", err.message);
  }
}

function startRetentionJob() {
  runPrune();
  setInterval(runPrune, ONE_DAY_MS);

  logger.info(
    `[Retention] Job retensi energy_readings aktif (retensi ${config.energyRetention.days} hari)`,
  );
}

module.exports = { startRetentionJob };
