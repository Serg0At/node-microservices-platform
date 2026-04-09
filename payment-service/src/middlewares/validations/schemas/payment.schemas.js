import Joi from 'joi';

export default class PaymentSchemas {
  CreatePaymentScheme = Joi.object({
    user_id: Joi.string().min(1).required(),
    plan_type: Joi.number().integer().valid(1, 2, 3).required(),
    payment_method: Joi.string().valid('crypto', 'card').required(),
    currency: Joi.string().min(1).default('USD'),
    amount: Joi.number().integer().min(1).required(),
    duration_months: Joi.number().integer().min(1).default(1),
    order_id: Joi.string().min(1).required(),
  });

  GetTransactionScheme = Joi.object({
    access_token: Joi.string().allow('').optional(),
    id: Joi.string().min(1).required(),
  });

  ListTransactionsScheme = Joi.object({
    access_token: Joi.string().allow('').optional(),
    user_id: Joi.string().min(1).required(),
    status: Joi.string().valid('', 'pending', 'succeeded', 'failed', 'refunded', 'expired').allow('').optional(),
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
  });
}
