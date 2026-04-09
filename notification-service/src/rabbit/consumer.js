import amqp from 'amqplib';
import 'dotenv/config';
import config from '../config/variables.config.js';
import logger from '../utils/logger.util.js';
import handlers from './handlers/index.js';

const { EXCHANGE, QUEUE, SUBSCRIPTION_EXCHANGE, SUBSCRIPTION_QUEUE, NEWS_EXCHANGE, NEWS_QUEUE, PREFETCH, RETRY } = config.RABBITMQ;

let connection = null;
let channel = null;
let reconnecting = false;

export const initRabbitConsumer = async () => {
  if (channel) return channel;

  connection = await amqp.connect(process.env.RABBIT_URL);
  channel = await connection.createChannel();

  await channel.prefetch(PREFETCH);

  // Assert exchanges
  await channel.assertExchange(EXCHANGE.NAME, EXCHANGE.TYPE, { durable: true });
  await channel.assertExchange(SUBSCRIPTION_EXCHANGE.NAME, SUBSCRIPTION_EXCHANGE.TYPE, { durable: true });
  await channel.assertExchange(NEWS_EXCHANGE.NAME, NEWS_EXCHANGE.TYPE, { durable: true });

  // Assert queues
  await channel.assertQueue(QUEUE.NAME, { durable: true });
  await channel.assertQueue(SUBSCRIPTION_QUEUE.NAME, { durable: true });
  await channel.assertQueue(NEWS_QUEUE.NAME, { durable: true });

  // Bind queues
  await channel.bindQueue(QUEUE.NAME, EXCHANGE.NAME, QUEUE.BIND_PATTERN);
  await channel.bindQueue(SUBSCRIPTION_QUEUE.NAME, SUBSCRIPTION_EXCHANGE.NAME, SUBSCRIPTION_QUEUE.BIND_PATTERN);
  await channel.bindQueue(NEWS_QUEUE.NAME, NEWS_EXCHANGE.NAME, NEWS_QUEUE.BIND_PATTERN);

  const consume = (queueName) => {
    channel.consume(queueName, async (msg) => {
      if (!msg) return;

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
    });
  };

  consume(QUEUE.NAME);
  consume(SUBSCRIPTION_QUEUE.NAME);
  consume(NEWS_QUEUE.NAME);

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
    authExchange: EXCHANGE.NAME,
    authQueue: QUEUE.NAME,
    subscriptionExchange: SUBSCRIPTION_EXCHANGE.NAME,
    subscriptionQueue: SUBSCRIPTION_QUEUE.NAME,
    newsExchange: NEWS_EXCHANGE.NAME,
    newsQueue: NEWS_QUEUE.NAME,
  });
  return channel;
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
