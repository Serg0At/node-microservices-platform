import Redis from "ioredis";
import crypto from "crypto";
import "dotenv/config";
import config from '../config/variables.config.js';
import logger from '../utils/logger.util.js';

let client;
let initPromise;

export const initRedis = async () => {
  if (initPromise) return initPromise;
  if (client) return client;

  initPromise = (async () => {
    if (!config.REDIS.URL) {
      throw new Error("REDIS_URL environment variable is not defined");
    }
    client = new Redis(config.REDIS.URL, { retryStrategy: () => null, enableReadyCheck: false, enableOfflineQueue: false });
    client.on("connect", () => {logger.info("Redis connected")});
    client.on("error", () => {logger.error("Redis connection failed ")});
    return client;
  })();

  client = await initPromise;
  initPromise = null;
  return client;
};

export const getRedis = () => {
  if (!client) throw new Error("Redis not initialized");
  return client;
};

/**
 * Helper to hash email for privacy-safe Redis keys
 */
const hashEmail = (email) => crypto.createHash('sha256').update(email.toLowerCase()).digest('hex');

export const redisOps = {
  addUserSession: async (userId, uaHash) => {
    const key = `user_sessions:${userId}`;
    await client.sadd(key, uaHash);
    await client.expire(key, config.REDIS.TTL.USER_SESSIONS);
  },

  isSessionActive: async (userId, uaHash) => {
    const key = `user_sessions:${userId}`;
    return await client.sismember(key, uaHash);
  },

  /**
   * Saves a verification/reset code with a hashed email key
   * reset_codes:sha256(email) -> { code, userId }
   */
  saveVerificationCode: async (email, code, userId) => {
    const key = `reset_codes:${hashEmail(email)}`;
    const data = JSON.stringify({ 
      code, 
      userId, 
      exp: Math.floor(Date.now() / 1000) + config.REDIS.TTL.RESET_CODE
    });
    return await client.set(key, data, 'EX', config.REDIS.TTL.RESET_CODE);
  },

  /**
   * Retrieves the code data for a specific email
   */
  getVerificationCode: async (email) => {
    const key = `reset_codes:${hashEmail(email)}`;
    const data = await client.get(key);
    return data ? JSON.parse(data) : null;
  },

  /**
   * Deletes code after successful use
   */
  deleteVerificationCode: async (email) => await client.del(`reset_codes:${hashEmail(email)}`),

  /**
   * Caches user profile data
   * user_cache:id -> { email, subscription }
   */
  cacheUserProfile: async (userId, profileData) => {
    const key = `user_cache:${userId}`;
    return await client.set(
      key, 
      JSON.stringify(profileData), 
      'EX', 
      config.REDIS.TTL.USER_CACHE || 300
    );
  },

  /**
   * Gets cached user profile
   */
  getUserCache: async (userId) => {
    const key = `user_cache:${userId}`;
    const data = await client.get(key);
    return data ? JSON.parse(data) : null;
  },

  /**
   * Saves refresh token + reverse index for device cleanup
   * refresh:{token} → { user_id, device, expires_at }
   * device_token:{userId}:{uaHash} → token
   */
  saveRefreshToken: async (token, userId, device) => {
    const ttl = config.REDIS.TTL.REFRESH_TOKEN || 2592000;
    const data = JSON.stringify({ user_id: userId, device, expires_at: Date.now() + ttl * 1000 });
    await client.set(`refresh:${token}`, data, 'EX', ttl);
    await client.set(`device_token:${userId}:${device}`, token, 'EX', ttl);
  },

  getRefreshToken: async (token) => {
    const data = await client.get(`refresh:${token}`);
    return data ? JSON.parse(data) : null;
  },

  deleteRefreshToken: async (token) => {
    await client.del(`refresh:${token}`);
  },

  /**
   * Revokes old refresh token for a specific device before issuing a new one
   */
  revokeDeviceToken: async (userId, device) => {
    const key = `device_token:${userId}:${device}`;
    const oldToken = await client.get(key);
    if (oldToken) {
      await client.del(`refresh:${oldToken}`, key);
    }
  },

  /**
   * Saves a change-password token
   * change_password:{token} → { userId }
   */
  saveChangePasswordToken: async (token, userId) => {
    const key = `change_password:${token}`;
    const data = JSON.stringify({ userId });
    return await client.set(key, data, 'EX', config.REDIS.TTL.CHANGE_PASSWORD_TOKEN);
  },

  getChangePasswordToken: async (token) => {
    const key = `change_password:${token}`;
    const data = await client.get(key);
    return data ? JSON.parse(data) : null;
  },

  deleteChangePasswordToken: async (token) => {
    await client.del(`change_password:${token}`);
  },

  /**
   * Get/set user subscription type for JWT inclusion
   * user_sub:{userId} → sub_type (int)
   */
  getUserSubType: async (userId) => {
    const val = await client.get(`user_sub:${userId}`);
    return val !== null ? Number(val) : 0;
  },

  setUserSubType: async (userId, subType) => {
    await client.set(`user_sub:${userId}`, subType.toString());
  },

  /**
   * Revokes ALL sessions and refresh tokens for a user.
   * 1. SMEMBERS user_sessions:{userId} → get all uaHashes
   * 2. For each uaHash: GET device_token → DEL refresh:{token} + DEL device_token
   * 3. DEL user_sessions:{userId}
   */
  revokeAllSessions: async (userId) => {
    const sessionsKey = `user_sessions:${userId}`;
    const uaHashes = await client.smembers(sessionsKey);

    const keysToDelete = [sessionsKey];

    for (const uaHash of uaHashes) {
      const deviceKey = `device_token:${userId}:${uaHash}`;
      const refreshToken = await client.get(deviceKey);
      if (refreshToken) {
        keysToDelete.push(`refresh:${refreshToken}`);
      }
      keysToDelete.push(deviceKey);
    }

    if (keysToDelete.length > 0) {
      await client.del(...keysToDelete);
    }
  },
};