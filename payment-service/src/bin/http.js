import express from 'express';
import logger from '../utils/logger.util.js';
import { WebhookController } from '../controllers/index.js';

export const startHttp = async () => {
  const app = express();
  const port = process.env.WEBHOOK_HTTP_PORT || 3001;

  // Parse JSON bodies
  app.use(express.json());

  // Webhook routes
  app.post('/webhook/cryptomus', WebhookController.handleCryptomus);
  app.post('/webhook/fondy', WebhookController.handleFondy);

  // Health check
  app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok', service: 'payment-service' });
  });

  const server = await new Promise((resolve, reject) => {
    const srv = app.listen(port, (err) => {
      if (err) return reject(err);
      logger.info(`HTTP webhook server started on ${port}`);
      resolve(srv);
    });
  });

  const shutdown = () => {
    logger.info('HTTP shutdown signal received');
    server.close((err) => {
      if (err) {
        logger.error('HTTP shutdown error', { error: err.message });
      } else {
        logger.info('HTTP graceful shutdown completed');
      }
    });
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  return server;
};
