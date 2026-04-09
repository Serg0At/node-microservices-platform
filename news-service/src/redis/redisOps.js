import { getRedis } from './redisClient.js';
import config from '../config/variables.config.js';
import crypto from 'crypto';

const { TTL } = config.REDIS;

export const redisOps = {
  // ── Single article cache ────────────────────────
  cacheArticle: async (articleId, data) => {
    const key = `news:article:${articleId}`;
    await getRedis().set(key, JSON.stringify(data), 'EX', TTL.ARTICLE_CACHE);
  },

  getCachedArticle: async (articleId) => {
    const data = await getRedis().get(`news:article:${articleId}`);
    return data ? JSON.parse(data) : null;
  },

  invalidateArticle: async (articleId) => {
    await getRedis().del(`news:article:${articleId}`);
  },

  // ── Latest articles list cache ──────────────────
  cacheLatestList: async (page, limit, data) => {
    const key = `news:latest:${page}:${limit}`;
    await getRedis().set(key, JSON.stringify(data), 'EX', TTL.LATEST_LIST);
  },

  getCachedLatestList: async (page, limit) => {
    const data = await getRedis().get(`news:latest:${page}:${limit}`);
    return data ? JSON.parse(data) : null;
  },

  // ── Search cache ────────────────────────────────
  cacheSearch: async (query, page, limit, data) => {
    const hash = crypto.createHash('md5').update(`${query}:${page}:${limit}`).digest('hex');
    const key = `news:search:${hash}`;
    await getRedis().set(key, JSON.stringify(data), 'EX', TTL.SEARCH_CACHE);
  },

  getCachedSearch: async (query, page, limit) => {
    const hash = crypto.createHash('md5').update(`${query}:${page}:${limit}`).digest('hex');
    const data = await getRedis().get(`news:search:${hash}`);
    return data ? JSON.parse(data) : null;
  },

  // ── Invalidation: clear all list/search caches ──
  invalidateListCaches: async () => {
    const redis = getRedis();
    const patterns = ['news:latest:*', 'news:search:*'];
    for (const pattern of patterns) {
      const keys = await redis.keys(pattern);
      if (keys.length > 0) await redis.del(...keys);
    }
  },
};
