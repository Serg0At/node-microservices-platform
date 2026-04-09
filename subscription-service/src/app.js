import "dotenv/config";
import { startGrpc } from "./bin/server.js";
import { initRabbitConsumer } from "./rabbit/consumer.js";
import { initRabbitPublisher } from "./rabbit/publisher.js";
import { initRedis } from "./redis/redisClient.js";
import { startExpiryWorker } from "./workers/expiry.worker.js";
import logger from "./utils/logger.util.js";

process.removeAllListeners('warning');
process.on('warning', (w) => { if (w.name !== 'TimeoutNegativeWarning') console.warn(w); });

(async () => {
  try {
    await initRedis();
    await initRabbitPublisher();
    await initRabbitConsumer();
    await startGrpc();
    startExpiryWorker();
    logger.info("========== SUBSCRIPTION SERVICE IS READY ==========");
  } catch (err) {
    logger.error("Subscription service start failed", { error: err.message, stack: err.stack });
    process.exit(1);
  }
})();
