import db from '../config/db.js';

export default class NotificationModel {
  static _db(trx) {
    return trx || db;
  }

  static async create(data, trx) {
    const [notification] = await NotificationModel._db(trx)('notifications')
      .insert(data)
      .returning('*');
    return notification;
  }

  static async findById(id, trx) {
    return NotificationModel._db(trx)('notifications')
      .where({ id })
      .first();
  }

  static findByUserId(userId, { limit = 20, offset = 0, type, read } = {}, trx) {
    const query = NotificationModel._db(trx)('notifications')
      .where(function () {
        this.where({ user_id: userId }).orWhere({ is_broadcast: true });
      })
      .orderBy('created_at', 'desc')
      .limit(Math.min(limit, 100))
      .offset(offset);

    if (type) query.andWhere({ type });
    if (read === true) query.andWhere({ read: true });
    if (read === false) query.andWhere({ read: false });

    return query;
  }

  static async countByUserId(userId, { type, read } = {}, trx) {
    const query = NotificationModel._db(trx)('notifications')
      .where(function () {
        this.where({ user_id: userId }).orWhere({ is_broadcast: true });
      })
      .count('id as count');

    if (type) query.andWhere({ type });
    if (read === true) query.andWhere({ read: true });
    if (read === false) query.andWhere({ read: false });

    const [{ count }] = await query;
    return Number(count);
  }

  static async getUnreadCount(userId, trx) {
    const [{ count }] = await NotificationModel._db(trx)('notifications')
      .where(function () {
        this.where({ user_id: userId }).orWhere({ is_broadcast: true });
      })
      .andWhere({ read: false })
      .count('id as count');
    return Number(count);
  }

  static async markAsRead(id, userId, trx) {
    const updated = await NotificationModel._db(trx)('notifications')
      .where({ id, user_id: userId, read: false })
      .update({ read: true, status: 'read', read_at: db.fn.now() });
    return updated;
  }

  static async markAllAsRead(userId, trx) {
    const updated = await NotificationModel._db(trx)('notifications')
      .where({ user_id: userId, read: false })
      .update({ read: true, status: 'read', read_at: db.fn.now() });
    return updated;
  }

  static async deleteById(id, userId, trx) {
    return NotificationModel._db(trx)('notifications')
      .where({ id, user_id: userId })
      .del();
  }

  static async updateStatus(id, status, extra = {}, trx) {
    return NotificationModel._db(trx)('notifications')
      .where({ id })
      .update({ status, ...extra });
  }

  static async getStats({ fromTime, toTime } = {}, trx) {
    const base = NotificationModel._db(trx)('notifications');
    if (fromTime) base.where('created_at', '>=', fromTime);
    if (toTime) base.where('created_at', '<=', toTime);

    const [byType, byStatus, byChannel] = await Promise.all([
      base.clone().select('type').count('id as count').groupBy('type'),
      base.clone().select('status').count('id as count').groupBy('status'),
      base.clone().select('channel').count('id as count').groupBy('channel'),
    ]);

    const totalSent = byStatus.find(s => s.status === 'sent')?.count || 0;
    const totalFailed = byStatus.find(s => s.status === 'failed')?.count || 0;

    return {
      totalSent: Number(totalSent),
      totalFailed: Number(totalFailed),
      byType: byType.map(r => ({ type: r.type, count: Number(r.count) })),
      byStatus: byStatus.map(r => ({ status: r.status, count: Number(r.count) })),
      byChannel: byChannel.map(r => ({ channel: r.channel, count: Number(r.count) })),
    };
  }

  static async getDeliveryLog(id, trx) {
    return NotificationModel._db(trx)('notifications')
      .where({ id })
      .select('*')
      .first();
  }

  static async archiveOld(days, trx) {
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
    const conn = NotificationModel._db(trx);

    const archived = await conn.raw(`
      WITH moved AS (
        DELETE FROM notifications
        WHERE created_at < ?
        RETURNING *
      )
      INSERT INTO notification_archive
      SELECT * FROM moved
    `, [cutoff]);

    return archived.rowCount || 0;
  }
}
