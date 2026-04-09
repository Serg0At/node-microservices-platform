import Joi from 'joi';

export default class SubscriptionSchemas {
  GetSubscriptionScheme = Joi.object({
    access_token: Joi.string().min(1).required(),
  });

  CheckAccessScheme = Joi.object({
    user_id: Joi.string().min(1).required(),
    required_level: Joi.number().integer().min(0).max(3).required(),
  });

  CreateCheckoutScheme = Joi.object({
    access_token: Joi.string().min(1).required(),
    plan_type: Joi.number().integer().valid(1, 2, 3).required(),
    payment_method: Joi.string().min(1).required(),
    duration_months: Joi.number().integer().valid(1, 3, 6, 12).required(),
    promo_code: Joi.string().allow('').default(''),
  });

  CancelSubscriptionScheme = Joi.object({
    access_token: Joi.string().min(1).required(),
  });

  RestoreSubscriptionScheme = Joi.object({
    access_token: Joi.string().min(1).required(),
  });

  AdminRemoveSubscriptionScheme = Joi.object({
    access_token: Joi.string().min(1).required(),
    user_id: Joi.string().min(1).required(),
    reason: Joi.string().allow('').default(''),
  });

  AdminSetSubscriptionScheme = Joi.object({
    access_token: Joi.string().min(1).required(),
    user_id: Joi.string().min(1).required(),
    sub_type: Joi.number().integer().valid(0, 1, 2, 3).required(),
    duration_months: Joi.number().integer().valid(1, 3, 6, 12).required(),
    issued_by: Joi.string().valid('System', 'Payment', 'Admin', 'Promo', 'User').required(),
  });

  GetSubscriptionStatsScheme = Joi.object({
    access_token: Joi.string().min(1).required(),
  });

  CreatePromoCodeScheme = Joi.object({
    access_token: Joi.string().min(1).required(),
    code: Joi.string().min(3).max(50).required(),
    discount_type: Joi.string().valid('percentage', 'fixed').required(),
    discount_value: Joi.number().integer().min(1).required(),
    max_uses: Joi.number().integer().min(0).default(0),
    applicable_tiers: Joi.array().items(Joi.number().integer().valid(1, 2, 3)).default([]),
    min_duration_months: Joi.number().integer().min(0).default(0),
    valid_until: Joi.string().allow('').default(''),
  });

  ListPromoCodesScheme = Joi.object({
    access_token: Joi.string().min(1).required(),
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
    active_only: Joi.boolean().default(false),
  });

  DeactivatePromoCodeScheme = Joi.object({
    access_token: Joi.string().min(1).required(),
    code: Joi.string().min(1).required(),
  });

  ValidatePromoCodeScheme = Joi.object({
    access_token: Joi.string().min(1).required(),
    code: Joi.string().min(1).required(),
    plan_type: Joi.number().integer().valid(1, 2, 3).required(),
    duration_months: Joi.number().integer().valid(1, 3, 6, 12).required(),
  });
}
