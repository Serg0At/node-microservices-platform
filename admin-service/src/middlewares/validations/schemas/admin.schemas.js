import Joi from 'joi';

export default class AdminSchemas {
  static DashboardStatsScheme = Joi.object({
    access_token: Joi.string().required(),
  });

  static ListUsersScheme = Joi.object({
    access_token: Joi.string().required(),
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
    search: Joi.string().allow('').default(''),
    role: Joi.number().integer().valid(-1, 0, 1).default(-1),
    status: Joi.number().integer().valid(-1, 0, 1).default(-1),
  });

  static GetUserScheme = Joi.object({
    access_token: Joi.string().required(),
    user_id: Joi.string().min(1).required(),
  });

  static UpdateUserRoleScheme = Joi.object({
    access_token: Joi.string().required(),
    user_id: Joi.string().min(1).required(),
    role: Joi.number().integer().valid(0, 1).required(),
  });

  static BanUserScheme = Joi.object({
    access_token: Joi.string().required(),
    user_id: Joi.string().min(1).required(),
    reason: Joi.string().allow('').default(''),
  });

  static UnbanUserScheme = Joi.object({
    access_token: Joi.string().required(),
    user_id: Joi.string().min(1).required(),
  });

  static CreateArticleScheme = Joi.object({
    access_token: Joi.string().required(),
    title: Joi.string().min(1).max(255).required(),
    content: Joi.string().min(1).required(),
    type: Joi.string().valid('blog', 'news').required(),
    cover_image_url: Joi.string().uri().allow('').default(''),
    categories: Joi.array().items(Joi.string().min(1)).optional().default([]),
  });

  static DeleteArticleScheme = Joi.object({
    access_token: Joi.string().required(),
    article_id: Joi.string().min(1).required(),
  });

  static GetUploadUrlScheme = Joi.object({
    access_token: Joi.string().required(),
    filename: Joi.string().min(1).required(),
    content_type: Joi.string().min(1).required(),
    article_id: Joi.string().allow('').default(''),
  });

  static GetArticleStatsScheme = Joi.object({
    access_token: Joi.string().required(),
  });

  static AdminSetSubscriptionScheme = Joi.object({
    access_token: Joi.string().required(),
    user_id: Joi.string().min(1).required(),
    sub_type: Joi.number().integer().valid(0, 1, 2, 3).required(),
    duration_months: Joi.number().integer().valid(1, 3, 6, 12).required(),
    issued_by: Joi.string().valid('System', 'Payment', 'Admin', 'Promo', 'User').required(),
  });

  static AdminRemoveSubscriptionScheme = Joi.object({
    access_token: Joi.string().required(),
    user_id: Joi.string().min(1).required(),
    reason: Joi.string().allow('').default(''),
  });

  static GetSubscriptionStatsScheme = Joi.object({
    access_token: Joi.string().required(),
  });

  static CreatePromoCodeScheme = Joi.object({
    access_token: Joi.string().required(),
    code: Joi.string().min(3).max(50).required(),
    discount_type: Joi.string().valid('percentage', 'fixed').required(),
    discount_value: Joi.number().integer().min(1).required(),
    max_uses: Joi.number().integer().min(0).default(0),
    applicable_tiers: Joi.array().items(Joi.number().integer().valid(1, 2, 3)).default([]),
    min_duration_months: Joi.number().integer().min(0).default(0),
    valid_until: Joi.string().allow('').default(''),
  });

  static ListPromoCodesScheme = Joi.object({
    access_token: Joi.string().required(),
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
    active_only: Joi.boolean().default(false),
  });

  static DeactivatePromoCodeScheme = Joi.object({
    access_token: Joi.string().required(),
    code: Joi.string().min(1).required(),
  });

  static SendNotificationScheme = Joi.object({
    access_token: Joi.string().required(),
    user_id: Joi.string().min(1).required(),
    email: Joi.string().email().required(),
    subject: Joi.string().min(1).required(),
    body: Joi.string().allow('').default(''),
    channel: Joi.string().valid('email', 'in_app').default('email'),
  });

  static SendBulkNotificationScheme = Joi.object({
    access_token: Joi.string().required(),
    subject: Joi.string().min(1).required(),
    body: Joi.string().allow('').default(''),
    channel: Joi.string().valid('email', 'in_app').default('email'),
    recipients: Joi.array().items(
      Joi.object({
        user_id: Joi.string().min(1).required(),
        email: Joi.string().email().required(),
      })
    ).optional().default([]),
  });

}
