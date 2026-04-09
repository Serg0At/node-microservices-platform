import "dotenv/config";
import { startGrpc } from "./bin/server.js";
import { initRabbitConsumer } from "./rabbit/consumer.js";
import { initRedis } from "./redis/redisClient.js";
import { initEmailService } from "./services/email.service.js";
import { startArchiver } from "./jobs/archiver.js";
import logger from "./utils/logger.util.js";

process.removeAllListeners('warning');
process.on('warning', (w) => { if (w.name !== 'TimeoutNegativeWarning') console.warn(w); });

(async () => {
  try {
    await initRedis();
    await initEmailService();
    await initRabbitConsumer();
    await startGrpc();
    startArchiver();
    logger.info("========== NOTIFICATION SERVICE IS READY ==========");
  } catch (err) {
    logger.error("Notification service start failed", { error: err.message, stack: err.stack });
    process.exit(1);
  }
})();
