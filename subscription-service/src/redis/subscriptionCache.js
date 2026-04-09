import { getRedis } from './redisClient.js';
import config from '../config/variables.config.js';

const { TTL } = config.REDIS;

export const subscriptionCacheOps = {
  /**
   * Get cached subscription for a user.
   * Returns parsed object on hit, null on miss.
   */
  getSubscription: async (userId) => {
    const client = getRedis();
    const key = `sub:user:${userId}`;
    const data = await client.get(key);
    return data ? JSON.parse(data) : null;
  },

  /**
   * Cache a subscription object for a user.
   */
  setSubscription: async (userId, subscription) => {
    const client = getRedis();
    const key = `sub:user:${userId}`;
    await client.set(key, JSON.stringify(subscription), 'EX', TTL.SUBSCRIPTION);
  },

  /**
   * Invalidate cached subscription for a user.
   */
  invalidateSubscription: async (userId) => {
    const client = getRedis();
    const key = `sub:user:${userId}`;
    await client.del(key);
  },

  /**
   * Get cached subscription stats.
   */
  getStats: async () => {
    const client = getRedis();
    const data = await client.get('sub:stats');
    return data ? JSON.parse(data) : null;
  },

  /**
   * Cache subscription stats.
   */
  setStats: async (stats) => {
    const client = getRedis();
    await client.set('sub:stats', JSON.stringify(stats), 'EX', TTL.STATS);
  },

  /**
   * Invalidate cached stats.
   */
  invalidateStats: async () => {
    const client = getRedis();
    await client.del('sub:stats');
  },
};
