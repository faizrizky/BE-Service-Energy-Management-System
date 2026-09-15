const { Queue, Worker } = require("bullmq");
const { config } = require("../../config/config");
const logger = require("../helpers/logger");

const connection = {
  host: config.redis.host,
  port: config.redis.port,
  password: config.redis.password,
};

const QUEUE_NAME = "relay-command";

const relayCommandQueue = new Queue(QUEUE_NAME, { connection });

/**
 * Satu job per CommandLog. jobId = commandId supaya perintah yang sama tidak
 * masuk antrean dua kali (misal saat recovery setelah restart).
 */
function enqueueRelayCommand(commandId) {
  return relayCommandQueue.add(
    "execute",
    { commandId },
    {
      jobId: commandId,
      attempts: 3,
      backoff: { type: "fixed", delay: 10000 },
      removeOnComplete: true,
      removeOnFail: true,
    },
  );
}

/**
 * processor(commandId) menjalankan retry sampai berhasil/batas waktu.
 * onFailed dipanggil kalau processor sendiri error di semua attempt (misal DB down).
 */
function startRelayCommandWorker(processor, { onFailed } = {}) {
  const worker = new Worker(
    QUEUE_NAME,
    (job) => processor(job.data.commandId),
    {
      connection,
      concurrency: 50,
      maxStalledCount: 10,
    },
  );

  worker.on("failed", (job, err) => {
    logger.error(`[RelayCommand] Job ${job?.id} error: ${err.message}`);
    const attempts = job?.opts?.attempts ?? 1;
    if (job && job.attemptsMade >= attempts && onFailed) {
      onFailed(job.data.commandId, err);
    }
  });

  logger.info("[RelayCommand] Worker jalan, siap eksekusi perintah relay");

  return worker;
}

module.exports = {
  relayCommandQueue,
  enqueueRelayCommand,
  startRelayCommandWorker,
};
