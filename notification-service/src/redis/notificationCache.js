import { getRedis } from './redisClient.js';
import config from '../config/variables.config.js';

const { TTL, } = config.REDIS;
const MAX_RECENT = config.NOTIFICATION.RECENT_MAX;

export const notificationCacheOps = {
  /**
   * Get unread notification count for a user (from Redis cache).
   * Returns null on cache miss.
   */
  getUnreadCount: async (userId) => {
    const client = getRedis();
    const key = `notification:unread_count:${userId}`;
    const count = await client.get(key);
    return count !== null ? Number(count) : null;
  },

  /**
   * Set unread count in cache (called after DB query on cache miss).
   */
  setUnreadCount: async (userId, count) => {
    const client = getRedis();
    const key = `notification:unread_count:${userId}`;
    await client.set(key, count, 'EX', TTL.UNREAD_COUNT);
  },

  /**
   * Increment unread count (called when new notification is created).
   */
  incrementUnread: async (userId) => {
    const client = getRedis();
    const key = `notification:unread_count:${userId}`;
    const exists = await client.exists(key);
    if (exists) {
      await client.incr(key);
      await client.expire(key, TTL.UNREAD_COUNT);
    }
  },

  /**
   * Decrement unread count (called when notification is marked as read).
   */
  decrementUnread: async (userId) => {
    const client = getRedis();
    const key = `notification:unread_count:${userId}`;
    const exists = await client.exists(key);
    if (exists) {
      const current = await client.get(key);
      if (Number(current) > 0) {
        await client.decr(key);
        await client.expire(key, TTL.UNREAD_COUNT);
      }
    }
  },

  /**
   * Reset unread count to 0 (called on markAllAsRead).
   */
  resetUnreadCount: async (userId) => {
    const client = getRedis();
    const key = `notification:unread_count:${userId}`;
    await client.set(key, 0, 'EX', TTL.UNREAD_COUNT);
  },

  /**
   * Add a notification ID to the user's recent notifications sorted set.
   * Score = Unix timestamp for chronological ordering.
   */
  addToRecent: async (userId, notificationId, timestamp) => {
    const client = getRedis();
    const key = `notification:recent:${userId}`;
    await client.zadd(key, timestamp, String(notificationId));
    // Trim to max recent
    await client.zremrangebyrank(key, 0, -(MAX_RECENT + 1));
    await client.expire(key, TTL.RECENT_NOTIFICATIONS);
  },

  /**
   * Remove a notification from the recent set (on delete).
   */
  removeFromRecent: async (userId, notificationId) => {
    const client = getRedis();
    const key = `notification:recent:${userId}`;
    await client.zrem(key, String(notificationId));
  },

  /**
   * Get recent notification IDs for a user, newest first.
   */
  getRecentIds: async (userId, limit = MAX_RECENT) => {
    const client = getRedis();
    const key = `notification:recent:${userId}`;
    const ids = await client.zrevrange(key, 0, limit - 1);
    return ids.map(Number);
  },
};
