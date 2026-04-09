import "dotenv/config";
import { startGrpc } from "./bin/server.js";
import { startHttp } from "./bin/http.js";
import { initRabbit } from "./rabbit/publisher.js";
import { initRedis } from "./redis/redisClient.js";
import logger from "./utils/logger.util.js";

process.removeAllListeners('warning');
process.on('warning', (w) => { if (w.name !== 'TimeoutNegativeWarning') console.warn(w); });

(async () => {
  try {
    await initRedis();
    await initRabbit();
    await startGrpc();
    await startHttp();
    logger.info("========== PAYMENT SERVICE IS READY ==========");
  } catch (err) {
    logger.error("Payment service start failed", { error: err.message, stack: err.stack });
    process.exit(1);
  }
})();
