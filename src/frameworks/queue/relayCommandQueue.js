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
 * Masukin satu CommandLog ke antrean relay-command. jobId = commandId biar
 * perintah yang sama nggak masuk dua kali; job di-retry 3 kali kalo
 * processor-nya error.
 *
 * Dipake di: device.usecase.js → requestRelayCommand,
 *   recoverPendingRelayCommands.
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
 * Nyalain worker BullMQ relay-command (50 job barengan, job yang keputus
 * diambil ulang) dan manggil onFailed kalo attempt terakhir tetep gagal.
 *
 * Dipake di: app.js → bootstrap (processor-nya device.usecase.js →
 *   processRelayCommand).
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
