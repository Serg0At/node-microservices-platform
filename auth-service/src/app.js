import "dotenv/config";
import { startGrpc } from "./bin/server.js";
import { initKafka } from "./kafka/producer.js";
import { initRabbit } from "./rabbit/publisher.js";
import { initRabbitConsumer } from "./rabbit/consumer.js";
import { initRedis } from "./redis/redisClient.js";
import logger from "./utils/logger.util.js";

process.removeAllListeners('warning');
process.on('warning', (w) => { if (w.name !== 'TimeoutNegativeWarning') console.warn(w); });

(async () => {
  try {
    await initRedis();
    // await initKafka();
    await initRabbit();
    await initRabbitConsumer();
    await startGrpc();
    logger.info("========== AUTH SERVICE IS READY ==========");
  } catch (err) {
    logger.error("Auth service start failed", { error: err.message, stack: err.stack });
    process.exit(1);
  }
})();
