import Joi from 'joi';

export default class AdminSchemas {
  AdminCreateArticleScheme = Joi.object({
    title: Joi.string().min(1).max(255).required(),
    content: Joi.string().min(1).required(),
    type: Joi.string().valid('blog', 'news').required(),
    coverImageUrl: Joi.string().uri().allow('').optional(),
  });

  AdminDeleteArticleScheme = Joi.object({
    articleId: Joi.string().required(),
  });

  AdminSendNotificationScheme = Joi.object({
    userId: Joi.string().required(),
    email: Joi.string().email().required(),
    subject: Joi.string().min(1).max(255).required(),
    body: Joi.string().min(1).required(),
    channel: Joi.string().valid('email', 'in_app').optional(),
  });

  AdminSendBulkNotificationScheme = Joi.object({
    subject: Joi.string().min(1).max(255).required(),
    body: Joi.string().min(1).required(),
    channel: Joi.string().valid('email', 'in_app').optional(),
    recipients: Joi.array()
      .items(
        Joi.object({
          userId: Joi.string().required(),
          email: Joi.string().email().required(),
        }),
      )
      .optional(),
  });
}
