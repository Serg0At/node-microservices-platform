import amqp from 'amqplib';
import 'dotenv/config';
import config from '../config/variables.config.js';
import logger from '../utils/logger.util.js';

const { EXCHANGE, RETRY } = config.RABBITMQ;

let connection = null;
let channel = null;
let reconnecting = false;

export const initRabbitPublisher = async () => {
  if (channel) return channel;

  connection = await amqp.connect(process.env.RABBIT_URL);
  channel = await connection.createChannel();

  await channel.assertExchange(EXCHANGE.NAME, EXCHANGE.TYPE, { durable: true });

  connection.on('error', (err) => {
    logger.error('RabbitMQ publisher connection error', { error: err.message });
  });

  connection.on('close', () => {
    logger.warn('RabbitMQ publisher connection closed, scheduling reconnect');
    channel = null;
    connection = null;
    scheduleReconnect();
  });

  logger.info('RabbitMQ publisher connected');
  return channel;
};

const scheduleReconnect = () => {
  if (reconnecting) return;
  reconnecting = true;

  const attempt = (retries) => {
    setTimeout(async () => {
      try {
        await initRabbitPublisher();
        reconnecting = false;
        logger.info('RabbitMQ publisher reconnected');
      } catch (err) {
        const nextRetries = retries + 1;
        const delay = Math.min(RETRY.RECONNECT_INTERVAL * nextRetries, 30000);
        logger.warn(`RabbitMQ publisher reconnect failed, retry #${nextRetries} in ${delay}ms`, { error: err.message });
        attempt(nextRetries);
      }
    }, RETRY.RECONNECT_INTERVAL * retries || RETRY.RECONNECT_INTERVAL);
  };

  attempt(1);
};

const buildMessage = (payload) => ({
  content: Buffer.from(JSON.stringify(payload)),
  options: {
    persistent: true,
    headers: { 'x-retry-count': 0 },
    timestamp: Math.floor(Date.now() / 1000),
  },
});

export const publishToNotification = async (routingKey, payload) => {
  if (!channel) throw new Error('Rabbit publisher channel not initialized');
  const msg = buildMessage(payload);
  channel.publish(EXCHANGE.NAME, routingKey, msg.content, msg.options);
  logger.debug('Published to notification exchange', { routingKey });
};
