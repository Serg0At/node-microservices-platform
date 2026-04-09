import logger from './logger.util.js';

export default class SuccessHandler {
  static ok(callback, data, meta = {}) {
    const { method = 'unknown', ...extra } = meta;
    logger.info('Request completed successfully', { method, ...extra });
    callback(null, data);
  }

  static notificationSent(callback, data, meta = {}) {
    const { method = 'SendNotification', userId, type, ...extra } = meta;
    logger.info('Notification sent', { method, userId, type, ...extra });
    callback(null, data);
  }

  static notificationRead(callback, data, meta = {}) {
    const { method = 'MarkAsRead', notificationId, ...extra } = meta;
    logger.info('Notification marked as read', { method, notificationId, ...extra });
    callback(null, data);
  }
}
