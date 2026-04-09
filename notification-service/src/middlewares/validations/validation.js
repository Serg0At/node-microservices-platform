import { NotificationSchemas } from './schemas/index.js';

const schemas = new NotificationSchemas();

export default class Validation {
  static validateGetNotifications(data) {
    return schemas.GetNotificationsScheme.validate(data, { abortEarly: false });
  }

  static validateGetUnreadCount(data) {
    return schemas.GetUnreadCountScheme.validate(data, { abortEarly: false });
  }

  static validateMarkAsRead(data) {
    return schemas.MarkAsReadScheme.validate(data, { abortEarly: false });
  }

  static validateMarkAllAsRead(data) {
    return schemas.MarkAllAsReadScheme.validate(data, { abortEarly: false });
  }

  static validateDeleteNotification(data) {
    return schemas.DeleteNotificationScheme.validate(data, { abortEarly: false });
  }

  static validateSendNotification(data) {
    return schemas.SendNotificationScheme.validate(data, { abortEarly: false });
  }

  static validateGetNotificationStats(data) {
    return schemas.GetNotificationStatsScheme.validate(data, { abortEarly: false });
  }

  static validateGetDeliveryLog(data) {
    return schemas.GetDeliveryLogScheme.validate(data, { abortEarly: false });
  }
}
