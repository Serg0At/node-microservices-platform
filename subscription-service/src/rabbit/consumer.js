import amqp from 'amqplib';
import 'dotenv/config';
import config from '../config/variables.config.js';
import logger from '../utils/logger.util.js';
import handlers from './handlers/index.js';

const { AUTH_EXCHANGE, PAYMENT_EXCHANGE, AUTH_QUEUE, PAYMENT_QUEUE, PREFETCH, RETRY } = config.RABBITMQ;

let connection = null;
let channel = null;
let reconnecting = false;

export const initRabbitConsumer = async () => {
  if (channel) return channel;

  connection = await amqp.connect(process.env.RABBIT_URL);
  channel = await connection.createChannel();

  await channel.prefetch(PREFETCH);

  // Assert exchanges
  await channel.assertExchange(AUTH_EXCHANGE.NAME, AUTH_EXCHANGE.TYPE, { durable: true });
  await channel.assertExchange(PAYMENT_EXCHANGE.NAME, PAYMENT_EXCHANGE.TYPE, { durable: true });

  // Assert queues
  await channel.assertQueue(AUTH_QUEUE.NAME, { durable: true });
  await channel.assertQueue(PAYMENT_QUEUE.NAME, { durable: true });

  // Bind queues
  await channel.bindQueue(AUTH_QUEUE.NAME, AUTH_EXCHANGE.NAME, AUTH_QUEUE.BIND_PATTERN);
  await channel.bindQueue(PAYMENT_QUEUE.NAME, PAYMENT_EXCHANGE.NAME, PAYMENT_QUEUE.BIND_PATTERN);

  // Consume from auth queue
  channel.consume(AUTH_QUEUE.NAME, async (msg) => {
    if (!msg) return;
    await processMessage(msg, AUTH_QUEUE.NAME);
  });

  // Consume from payment queue
  channel.consume(PAYMENT_QUEUE.NAME, async (msg) => {
    if (!msg) return;
    await processMessage(msg, PAYMENT_QUEUE.NAME);
  });

  // Connection recovery
  connection.on('error', (err) => {
    logger.error('RabbitMQ consumer connection error', { error: err.message });
  });

  connection.on('close', () => {
    logger.warn('RabbitMQ consumer connection closed, scheduling reconnect');
    channel = null;
    connection = null;
    scheduleReconnect();
  });

  logger.info('RabbitMQ consumer connected, listening for events', {
    authExchange: AUTH_EXCHANGE.NAME,
    authQueue: AUTH_QUEUE.NAME,
    paymentExchange: PAYMENT_EXCHANGE.NAME,
    paymentQueue: PAYMENT_QUEUE.NAME,
  });
  return channel;
};

const processMessage = async (msg, queueName) => {
  const routingKey = msg.fields.routingKey;

  try {
    const payload = JSON.parse(msg.content.toString());
    const handler = handlers[routingKey];

    if (!handler) {
      logger.warn('No handler for routing key, acking to discard', { routingKey });
      channel.ack(msg);
      return;
    }

    logger.info('Processing event', { routingKey, userId: payload.user_id });

    await handler(payload);

    logger.info('Event processed successfully', { routingKey, userId: payload.user_id });
    channel.ack(msg);
  } catch (err) {
    logger.error('Failed to process event', { routingKey, error: err.message, stack: err.stack });

    const retryCount = (msg.properties.headers?.['x-retry-count'] || 0) + 1;
    if (retryCount <= RETRY.MAX_RETRIES) {
      logger.warn(`Retrying ${routingKey} (attempt ${retryCount}/${RETRY.MAX_RETRIES})`);
      setTimeout(() => {
        channel.publish('', queueName, msg.content, {
          ...msg.properties,
          headers: { ...msg.properties.headers, 'x-retry-count': retryCount },
        });
        channel.ack(msg);
      }, RETRY.RETRY_DELAY);
    } else {
      logger.error(`Max retries exceeded for ${routingKey}, nacking`, { routingKey });
      channel.nack(msg, false, false);
    }
  }
};

const scheduleReconnect = () => {
  if (reconnecting) return;
  reconnecting = true;

  const attempt = (retries) => {
    setTimeout(async () => {
      try {
        await initRabbitConsumer();
        reconnecting = false;
        logger.info('RabbitMQ consumer reconnected');
      } catch (err) {
        const nextRetries = retries + 1;
        const delay = Math.min(RETRY.RECONNECT_INTERVAL * nextRetries, 30000);
        logger.warn(`RabbitMQ consumer reconnect failed, retry #${nextRetries} in ${delay}ms`, { error: err.message });
        attempt(nextRetries);
      }
    }, RETRY.RECONNECT_INTERVAL * retries || RETRY.RECONNECT_INTERVAL);
  };

  attempt(1);
};
