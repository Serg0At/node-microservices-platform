import "dotenv/config";
import { startGrpc } from "./bin/server.js";
import { initRedis } from "./redis/redisClient.js";
import logger from "./utils/logger.util.js";

process.removeAllListeners('warning');
process.on('warning', (w) => { if (w.name !== 'TimeoutNegativeWarning') console.warn(w); });

(async () => {
  try {
    await initRedis();
    await startGrpc();
    logger.info("========== ADMIN SERVICE IS READY ==========");
  } catch (err) {
    logger.error("Admin service start failed", { error: err.message, stack: err.stack });
    process.exit(1);
  }
})();
