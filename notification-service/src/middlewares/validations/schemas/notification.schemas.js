import Joi from 'joi';

export default class NotificationSchemas {
  GetNotificationsScheme = Joi.object({
    user_id: Joi.string().min(1).required(),
    limit: Joi.number().integer().min(1).max(100).default(20),
    offset: Joi.number().integer().min(0).default(0),
    type_filter: Joi.string().allow('').optional(),
    read_filter: Joi.string().valid('', 'read', 'unread').allow('').optional(),
  });

  GetUnreadCountScheme = Joi.object({
    user_id: Joi.string().min(1).required(),
  });

  MarkAsReadScheme = Joi.object({
    notification_id: Joi.string().min(1).required(),
    user_id: Joi.string().min(1).required(),
  });

  MarkAllAsReadScheme = Joi.object({
    user_id: Joi.string().min(1).required(),
  });

  DeleteNotificationScheme = Joi.object({
    notification_id: Joi.string().min(1).required(),
    user_id: Joi.string().min(1).required(),
  });

  SendNotificationScheme = Joi.object({
    user_id: Joi.string().min(1).required(),
    email: Joi.string().email().required(),
    type: Joi.string().min(1).required(),
    channel: Joi.string().valid('email', 'in_app').default('email'),
    subject: Joi.string().min(1).required(),
    body: Joi.string().allow('').optional(),
  });

  GetNotificationStatsScheme = Joi.object({
    from_time: Joi.string().allow('').optional(),
    to_time: Joi.string().allow('').optional(),
  });

  GetDeliveryLogScheme = Joi.object({
    notification_id: Joi.string().min(1).required(),
  });
}
