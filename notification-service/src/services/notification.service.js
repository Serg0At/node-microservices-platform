import { NotificationModel } from '../models/index.js';
import { sendEmail } from './email.service.js';
import { notificationCacheOps } from '../redis/notificationCache.js';
import { dbBreaker, redisBreaker } from '../utils/circuit-breaker.util.js';
import logger from '../utils/logger.util.js';
import db from '../config/db.js';
import ErrorHandler from '../utils/error-handler.util.js';

const { errors } = ErrorHandler;

export default class NotificationService {
  /**
   * Create a notification record, optionally send email, update caches.
   * Called by RabbitMQ event handlers and the manual SendNotification RPC.
   *
   * @param {string} channel - 'email' | 'in_app' | 'both'
   *   - email:  send via SMTP only
   *   - in_app: store in DB + update Redis caches (no email)
   *   - both:   send email AND store as in-app notification
   */
  static async createAndSend({ userId, email, type, channel = 'email', template, subject, context, payload }) {
    const shouldEmail = channel === 'email' || channel === 'both';
    const dbChannel = channel === 'both' ? 'email' : channel;

    const record = await dbBreaker.fire(() =>
      NotificationModel.create({
        user_id: userId,
        type,
        channel: dbChannel,
        title: subject,
        body: context.body || null,
        recipient_email: shouldEmail ? email : null,
        template: shouldEmail ? template : null,
        payload: payload ? JSON.stringify(payload) : null,
        status: shouldEmail ? 'pending' : 'delivered',
        read: false,
        retry_count: 0,
      })
    );

    // For in_app only: no email needed, just update caches
    if (!shouldEmail) {
      try {
        await redisBreaker.fire(async () => {
          await notificationCacheOps.incrementUnread(userId);
          await notificationCacheOps.addToRecent(userId, record.id, Date.now());
        });
      } catch (cacheErr) {
        logger.warn('Failed to update notification cache', { error: cacheErr.message, notificationId: record.id });
      }

      return { success: true, notificationId: record.id };
    }

    // For email and both: send via SMTP
    try {
      const result = await sendEmail({ to: email, subject, template, context });

      await dbBreaker.fire(() =>
        NotificationModel.updateStatus(record.id, 'sent', {
          provider_response: JSON.stringify(result),
          sent_at: new Date(),
        })
      );

      // Update Redis caches (fire-and-forget, don't block on cache failures)
      try {
        await redisBreaker.fire(async () => {
          await notificationCacheOps.incrementUnread(userId);
          await notificationCacheOps.addToRecent(userId, record.id, Date.now());
        });
      } catch (cacheErr) {
        logger.warn('Failed to update notification cache', { error: cacheErr.message, notificationId: record.id });
      }

      // If 'both', create a second record for in_app
      if (channel === 'both') {
        try {
          const inAppRecord = await dbBreaker.fire(() =>
            NotificationModel.create({
              user_id: userId,
              type,
              channel: 'in_app',
              title: subject,
              body: context.body || null,
              recipient_email: null,
              template: null,
              payload: payload ? JSON.stringify(payload) : null,
              status: 'delivered',
              read: false,
              retry_count: 0,
            })
          );

          try {
            await redisBreaker.fire(async () => {
              await notificationCacheOps.incrementUnread(userId);
              await notificationCacheOps.addToRecent(userId, inAppRecord.id, Date.now());
            });
          } catch (cacheErr) {
            logger.warn('Failed to update in_app notification cache', { error: cacheErr.message, notificationId: inAppRecord.id });
          }
        } catch (inAppErr) {
          logger.warn('Failed to create in_app record for both channel', { error: inAppErr.message, userId, type });
        }
      }

      return { success: true, notificationId: record.id };
    } catch (sendErr) {
      logger.error('Failed to send email', { error: sendErr.message, notificationId: record.id, userId, template });

      await dbBreaker.fire(() =>
        NotificationModel.updateStatus(record.id, 'failed', {
          error_message: sendErr.message,
          retry_count: (record.retry_count || 0) + 1,
        })
      );

      throw sendErr;
    }
  }

  /**
   * Get paginated notifications for a user.
   */
  static async getNotifications(userId, { limit = 20, offset = 0, type, read } = {}) {
    const readFilter = read === 'unread' ? false : read === 'read' ? true : undefined;

    const [notifications, totalCount] = await Promise.all([
      dbBreaker.fire(() => NotificationModel.findByUserId(userId, { limit, offset, type, read: readFilter })),
      dbBreaker.fire(() => NotificationModel.countByUserId(userId, { type, read: readFilter })),
    ]);

    return {
      success: true,
      notifications: notifications.map(NotificationService._formatNotification),
      total_count: totalCount,
    };
  }

  /**
   * Get unread count (Redis first, DB fallback).
   */
  static async getUnreadCount(userId) {
    let count;

    try {
      count = await redisBreaker.fire(() => notificationCacheOps.getUnreadCount(userId));
    } catch {
      count = null;
    }

    if (count === null) {
      count = await dbBreaker.fire(() => NotificationModel.getUnreadCount(userId));

      try {
        await redisBreaker.fire(() => notificationCacheOps.setUnreadCount(userId, count));
      } catch {
        // cache population failed, non-critical
      }
    }

    return { success: true, count };
  }

  /**
   * Mark a single notification as read.
   */
  static async markAsRead(notificationId, userId) {
    const updated = await dbBreaker.fire(() =>
      db.transaction(trx => NotificationModel.markAsRead(notificationId, userId, trx))
    );

    if (!updated) {
      const err = new errors.ResourceNotFoundError('Notification not found or already read');
      throw err;
    }

    try {
      await redisBreaker.fire(() => notificationCacheOps.decrementUnread(userId));
    } catch {
      // non-critical
    }

    return { success: true, message: 'Notification marked as read' };
  }

  /**
   * Mark all notifications as read for a user.
   */
  static async markAllAsRead(userId) {
    const updatedCount = await dbBreaker.fire(() =>
      db.transaction(trx => NotificationModel.markAllAsRead(userId, trx))
    );

    try {
      await redisBreaker.fire(() => notificationCacheOps.resetUnreadCount(userId));
    } catch {
      // non-critical
    }

    return { success: true, message: 'All notifications marked as read', updated_count: updatedCount };
  }

  /**
   * Delete a notification.
   */
  static async deleteNotification(notificationId, userId) {
    // Check if notification exists and get its read status
    const notification = await dbBreaker.fire(() => NotificationModel.findById(notificationId));
    if (!notification || String(notification.user_id) !== String(userId)) {
      throw new errors.ResourceNotFoundError('Notification not found');
    }

    await dbBreaker.fire(() =>
      db.transaction(trx => NotificationModel.deleteById(notificationId, userId, trx))
    );

    try {
      await redisBreaker.fire(async () => {
        if (!notification.read) {
          await notificationCacheOps.decrementUnread(userId);
        }
        await notificationCacheOps.removeFromRecent(userId, notificationId);
      });
    } catch {
      // non-critical
    }

    return { success: true, message: 'Notification deleted' };
  }

  /**
   * Manual send (admin/system trigger via gRPC).
   */
  static async sendManual({ userId, email, type, channel = 'email', subject, body }) {
    return NotificationService.createAndSend({
      userId,
      email,
      type,
      channel,
      template: type,
      subject: subject || `Notification: ${type}`,
      context: { body },
      payload: { user_id: userId, type, channel, manual: true },
    });
  }

  /**
   * Create a broadcast notification (no user_id) visible to all users in-app.
   */
  static async createBroadcast({ type, title, payload }) {
    await dbBreaker.fire(() =>
      NotificationModel.create({
        user_id: null,
        is_broadcast: true,
        type,
        channel: 'in_app',
        title,
        status: 'sent',
        payload: payload ? JSON.stringify(payload) : null,
      })
    );
    logger.info('Broadcast notification created', { type, title });
  }

  /**
   * Get notification stats for a time range.
   */
  static async getStats({ fromTime, toTime } = {}) {
    const stats = await dbBreaker.fire(() => NotificationModel.getStats({ fromTime, toTime }));
    return { success: true, ...stats };
  }

  /**
   * Get full delivery log for a notification.
   */
  static async getDeliveryLog(notificationId) {
    const entry = await dbBreaker.fire(() => NotificationModel.getDeliveryLog(notificationId));
    if (!entry) {
      throw new errors.ResourceNotFoundError('Notification not found');
    }

    return {
      success: true,
      entry: {
        id: String(entry.id),
        user_id: String(entry.user_id),
        type: entry.type,
        channel: entry.channel,
        title: entry.title,
        body: entry.body || '',
        recipient_email: entry.recipient_email || '',
        template: entry.template || '',
        payload: entry.payload ? (typeof entry.payload === 'string' ? entry.payload : JSON.stringify(entry.payload)) : '',
        provider_response: entry.provider_response ? (typeof entry.provider_response === 'string' ? entry.provider_response : JSON.stringify(entry.provider_response)) : '',
        status: entry.status,
        retry_count: entry.retry_count,
        error_message: entry.error_message || '',
        created_at: entry.created_at?.toISOString?.() || '',
        sent_at: entry.sent_at?.toISOString?.() || '',
        read_at: entry.read_at?.toISOString?.() || '',
      },
    };
  }

  /**
   * Format a notification record for gRPC response.
   */
  static _formatNotification(n) {
    return {
      id: String(n.id),
      user_id: String(n.user_id),
      type: n.type,
      channel: n.channel,
      title: n.title,
      body: n.body || '',
      status: n.status,
      read: n.read,
      created_at: n.created_at?.toISOString?.() || '',
      sent_at: n.sent_at?.toISOString?.() || '',
      read_at: n.read_at?.toISOString?.() || '',
    };
  }
}
