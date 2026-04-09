import 'dotenv/config';
import { startGrpc } from './bin/server.js';
import { initRabbitPublisher } from './rabbit/publisher.js';
import { initRabbitConsumer } from './rabbit/consumer.js';
import { initRedis } from './redis/redisClient.js';
import { initMinio } from './utils/minio.util.js';
import logger from './utils/logger.util.js';

process.removeAllListeners('warning');
process.on('warning', (w) => { if (w.name !== 'TimeoutNegativeWarning') console.warn(w); });

(async () => {
  try {
    await initRedis();
    await initMinio();
    await initRabbitPublisher();
    await initRabbitConsumer();
    await startGrpc();
    logger.info('========== USER SERVICE IS READY ==========');
  } catch (err) {
    logger.error('User service start failed', { error: err.message, stack: err.stack });
    process.exit(1);
  }
})();
