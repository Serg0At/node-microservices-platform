import NotificationService from '../services/notification.service.js';
import { SuccessHandler, ErrorHandler } from '../utils/index.js';
import { Validation } from '../middlewares/validations/index.js';

export default class NotificationController {
  static async getNotifications(call, callback) {
    const meta = { method: 'GetNotifications' };
    try {
      const { user_id, limit, offset, type_filter, read_filter } = call.request;

      const { error: validationError } = Validation.validateGetNotifications({ user_id, limit, offset, type_filter, read_filter });
      if (validationError) {
        return ErrorHandler.invalidArgument(callback, validationError.details.map(d => d.message).join('; '), meta);
      }

      const result = await NotificationService.getNotifications(user_id, {
        limit,
        offset,
        type: type_filter || undefined,
        read: read_filter || undefined,
      });

      SuccessHandler.ok(callback, result, { ...meta, userId: user_id });
    } catch (error) {
      ErrorHandler.handle(callback, error, meta);
    }
  }

  static async getUnreadCount(call, callback) {
    const meta = { method: 'GetUnreadCount' };
    try {
      const { user_id } = call.request;

      const { error: validationError } = Validation.validateGetUnreadCount({ user_id });
      if (validationError) {
        return ErrorHandler.invalidArgument(callback, validationError.details.map(d => d.message).join('; '), meta);
      }

      const result = await NotificationService.getUnreadCount(user_id);

      SuccessHandler.ok(callback, result, { ...meta, userId: user_id });
    } catch (error) {
      ErrorHandler.handle(callback, error, meta);
    }
  }

  static async markAsRead(call, callback) {
    const meta = { method: 'MarkAsRead' };
    try {
      const { notification_id, user_id } = call.request;

      const { error: validationError } = Validation.validateMarkAsRead({ notification_id, user_id });
      if (validationError) {
        return ErrorHandler.invalidArgument(callback, validationError.details.map(d => d.message).join('; '), meta);
      }

      const result = await NotificationService.markAsRead(notification_id, user_id);

      SuccessHandler.notificationRead(callback, result, { ...meta, notificationId: notification_id });
    } catch (error) {
      ErrorHandler.handle(callback, error, meta);
    }
  }

  static async markAllAsRead(call, callback) {
    const meta = { method: 'MarkAllAsRead' };
    try {
      const { user_id } = call.request;

      const { error: validationError } = Validation.validateMarkAllAsRead({ user_id });
      if (validationError) {
        return ErrorHandler.invalidArgument(callback, validationError.details.map(d => d.message).join('; '), meta);
      }

      const result = await NotificationService.markAllAsRead(user_id);

      SuccessHandler.ok(callback, result, { ...meta, userId: user_id });
    } catch (error) {
      ErrorHandler.handle(callback, error, meta);
    }
  }

  static async deleteNotification(call, callback) {
    const meta = { method: 'DeleteNotification' };
    try {
      const { notification_id, user_id } = call.request;

      const { error: validationError } = Validation.validateDeleteNotification({ notification_id, user_id });
      if (validationError) {
        return ErrorHandler.invalidArgument(callback, validationError.details.map(d => d.message).join('; '), meta);
      }

      const result = await NotificationService.deleteNotification(notification_id, user_id);

      SuccessHandler.ok(callback, result, { ...meta, notificationId: notification_id });
    } catch (error) {
      ErrorHandler.handle(callback, error, meta);
    }
  }

  static async sendNotification(call, callback) {
    const meta = { method: 'SendNotification' };
    try {
      const { user_id, email, type, channel, subject, body } = call.request;

      const { error: validationError } = Validation.validateSendNotification({ user_id, email, type, channel, subject, body });
      if (validationError) {
        return ErrorHandler.invalidArgument(callback, validationError.details.map(d => d.message).join('; '), meta);
      }

      const result = await NotificationService.sendManual({ userId: user_id, email, type, channel, subject, body });

      SuccessHandler.notificationSent(callback, {
        success: true,
        message: 'Notification sent',
        notification_id: String(result.notificationId),
      }, { ...meta, userId: user_id, type });
    } catch (error) {
      ErrorHandler.handle(callback, error, meta);
    }
  }

  static async getNotificationStats(call, callback) {
    const meta = { method: 'GetNotificationStats' };
    try {
      const { from_time, to_time } = call.request;

      const { error: validationError } = Validation.validateGetNotificationStats({ from_time, to_time });
      if (validationError) {
        return ErrorHandler.invalidArgument(callback, validationError.details.map(d => d.message).join('; '), meta);
      }

      const result = await NotificationService.getStats({
        fromTime: from_time || undefined,
        toTime: to_time || undefined,
      });

      SuccessHandler.ok(callback, {
        success: true,
        total_sent: result.totalSent,
        total_failed: result.totalFailed,
        by_type: result.byType,
        by_status: result.byStatus,
        by_channel: result.byChannel,
      }, meta);
    } catch (error) {
      ErrorHandler.handle(callback, error, meta);
    }
  }

  static async getDeliveryLog(call, callback) {
    const meta = { method: 'GetDeliveryLog' };
    try {
      const { notification_id } = call.request;

      const { error: validationError } = Validation.validateGetDeliveryLog({ notification_id });
      if (validationError) {
        return ErrorHandler.invalidArgument(callback, validationError.details.map(d => d.message).join('; '), meta);
      }

      const result = await NotificationService.getDeliveryLog(notification_id);

      SuccessHandler.ok(callback, result, { ...meta, notificationId: notification_id });
    } catch (error) {
      ErrorHandler.handle(callback, error, meta);
    }
  }
}
