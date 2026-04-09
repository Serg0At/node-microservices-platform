import db from '../config/db.js';

export default class SubscriptionModel {
  static _db(trx) {
    return trx || db;
  }

  static async create(data, trx) {
    const [subscription] = await SubscriptionModel._db(trx)('subscriptions')
      .insert(data)
      .returning('*');
    return subscription;
  }

  static async findById(id, trx) {
    return SubscriptionModel._db(trx)('subscriptions')
      .where({ id })
      .first();
  }

  static async findByUserId(userId, trx) {
    return SubscriptionModel._db(trx)('subscriptions')
      .where({ user_id: userId })
      .orderBy('created_at', 'desc')
      .first();
  }

  static async findActiveByUserId(userId, trx) {
    return SubscriptionModel._db(trx)('subscriptions')
      .where({ user_id: userId, status: 'active' })
      .orderBy('created_at', 'desc')
      .first();
  }

  static async findLatestByUserId(userId, trx) {
    return SubscriptionModel._db(trx)('subscriptions')
      .where({ user_id: userId })
      .whereIn('status', ['active', 'expired', 'canceled'])
      .orderBy('created_at', 'desc')
      .first();
  }

  static async hasUsedTrial(userId, trx) {
    const row = await SubscriptionModel._db(trx)('subscriptions')
      .where({ user_id: userId, free_trial: true })
      .first();
    return !!row;
  }

  static async updateById(id, data, trx) {
    const [updated] = await SubscriptionModel._db(trx)('subscriptions')
      .where({ id })
      .update({ ...data, updated_at: db.fn.now() })
      .returning('*');
    return updated;
  }

  static async updateStatusByUserId(userId, currentStatus, newData, trx) {
    const [updated] = await SubscriptionModel._db(trx)('subscriptions')
      .where({ user_id: userId, status: currentStatus })
      .update({ ...newData, updated_at: db.fn.now() })
      .returning('*');
    return updated;
  }

  /**
   * Expire active subscriptions whose ended_at < NOW()
   * Sets status='expired' and grace_period_end = NOW() + graceDays
   */
  static async expireActive(graceDays, trx) {
    const conn = SubscriptionModel._db(trx);
    const rows = await conn('subscriptions')
      .where('status', 'active')
      .where('ended_at', '<', conn.fn.now())
      .update({
        status: 'expired',
        grace_period_end: conn.raw(`NOW() + INTERVAL '${graceDays} days'`),
        updated_at: conn.fn.now(),
      })
      .returning('*');
    return rows;
  }

  /**
   * Terminate expired subscriptions whose grace_period_end < NOW()
   * Sets status='terminated' and sub_type=0
   */
  static async terminateExpired(trx) {
    const conn = SubscriptionModel._db(trx);
    const rows = await conn('subscriptions')
      .where('status', 'expired')
      .where('grace_period_end', '<', conn.fn.now())
      .update({
        status: 'terminated',
        sub_type: 0,
        updated_at: conn.fn.now(),
      })
      .returning('*');
    return rows;
  }

  /**
   * Find active subscriptions expiring in exactly N days (within a 1-hour window).
   * Used by expiry worker to send reminder notifications.
   */
  static async findExpiringInDays(days, trx) {
    const conn = SubscriptionModel._db(trx);
    return conn('subscriptions')
      .where('status', 'active')
      .where('ended_at', '>', conn.raw(`NOW() + INTERVAL '${days} days' - INTERVAL '1 hour'`))
      .where('ended_at', '<=', conn.raw(`NOW() + INTERVAL '${days} days'`));
  }

  /**
   * Find expired subscriptions with grace_period_end approaching (within 1 day)
   */
  static async findGraceWarnings(trx) {
    const conn = SubscriptionModel._db(trx);
    return conn('subscriptions')
      .where('status', 'expired')
      .where('grace_period_end', '>', conn.fn.now())
      .where('grace_period_end', '<', conn.raw(`NOW() + INTERVAL '1 day'`));
  }

  /**
   * Get subscription stats grouped by status and tier
   */
  static async getStats(trx) {
    const conn = SubscriptionModel._db(trx);

    const [byStatus, byTier] = await Promise.all([
      conn('subscriptions')
        .select('status')
        .count('id as count')
        .groupBy('status'),
      conn('subscriptions')
        .where('status', 'active')
        .select('sub_type')
        .count('id as count')
        .groupBy('sub_type'),
    ]);

    const statusMap = {};
    byStatus.forEach(r => { statusMap[r.status] = Number(r.count); });

    return {
      total_active: statusMap.active || 0,
      total_expired: statusMap.expired || 0,
      total_canceled: statusMap.canceled || 0,
      total_terminated: statusMap.terminated || 0,
      by_tier: byTier.map(r => ({ tier: r.sub_type, count: Number(r.count) })),
    };
  }
}
