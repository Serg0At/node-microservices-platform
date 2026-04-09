import Redis from "ioredis";
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
    client.on("connect", () => { logger.info("Redis connected"); });
    client.on("error", () => { logger.error("Redis connection failed"); });
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
