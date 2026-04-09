import { getRedis } from './redisClient.js';
import config from '../config/variables.config.js';
import logger from '../utils/logger.util.js';

const PREFIX = 'payment:idempotency:';
const TTL = config.REDIS.TTL.IDEMPOTENCY;

/**
 * Check if a webhook for a given provider_order_id has already been processed.
 * Returns true if the key already exists (duplicate), false otherwise.
 * Sets the key with TTL if it does not exist.
 */
export const checkAndSetIdempotency = async (providerOrderId) => {
  const redis = getRedis();
  const key = `${PREFIX}${providerOrderId}`;

  // SET NX returns 'OK' if set, null if already exists
  const result = await redis.set(key, '1', 'EX', TTL, 'NX');

  if (result === null) {
    logger.warn('Duplicate webhook detected, skipping', { providerOrderId });
    return true; // duplicate
  }

  return false; // not duplicate, key was set
};

/**
 * Remove idempotency key (e.g. if processing failed and we want to allow retry).
 */
export const removeIdempotency = async (providerOrderId) => {
  const redis = getRedis();
  const key = `${PREFIX}${providerOrderId}`;
  await redis.del(key);
};
