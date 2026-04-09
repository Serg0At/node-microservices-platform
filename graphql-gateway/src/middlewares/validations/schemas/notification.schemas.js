import Joi from 'joi';

export default class NotificationSchemas {
  GetNotificationsScheme = Joi.object({
    limit: Joi.number().integer().min(1).max(100).optional(),
    offset: Joi.number().integer().min(0).optional(),
    typeFilter: Joi.string().allow('').optional(),
    readFilter: Joi.string().valid('', 'read', 'unread').optional(),
  });

  MarkAsReadScheme = Joi.object({
    notificationId: Joi.string().required(),
  });

  DeleteNotificationScheme = Joi.object({
    notificationId: Joi.string().required(),
  });
}
