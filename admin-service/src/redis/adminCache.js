import { getRedis } from './redisClient.js';
import config from '../config/variables.config.js';

const TTL = config.REDIS.TTL;

export const adminCacheOps = {
  async getDashboardStats() {
    const val = await getRedis().get('admin:dashboard:stats');
    return val ? JSON.parse(val) : null;
  },

  async setDashboardStats(data) {
    return getRedis().setex('admin:dashboard:stats', TTL.DASHBOARD_STATS, JSON.stringify(data));
  },

  async invalidateDashboardStats() {
    return getRedis().del('admin:dashboard:stats');
  },
};
