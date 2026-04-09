import 'dotenv/config';
import { startGrpc } from './bin/server.js';
import { initRabbit } from './rabbit/publisher.js';
import { initRedis } from './redis/redisClient.js';
import { initS3 } from './s3/s3Client.js';
import logger from './utils/logger.util.js';

process.removeAllListeners('warning');
process.on('warning', (w) => { if (w.name !== 'TimeoutNegativeWarning') console.warn(w); });

(async () => {
  try {
    await initRedis();
    await initRabbit();
    initS3();
    await startGrpc();
    logger.info('========== NEWS SERVICE IS READY ==========');
  } catch (err) {
    logger.error('News service start failed', { error: err.message, stack: err.stack });
    process.exit(1);
  }
})();
