import SubscriptionService from '../services/subscription.service.js';
import { SuccessHandler, ErrorHandler } from '../utils/index.js';
import { Validation } from '../middlewares/validations/index.js';
import { verifyAccessToken } from '../utils/jwt.util.js';

export default class SubscriptionController {
  static async getSubscription(call, callback) {
    const meta = { method: 'GetSubscription' };
    try {
      const { access_token } = call.request;

      const { error: validationError } = Validation.validateGetSubscription({ access_token });
      if (validationError) {
        return ErrorHandler.invalidArgument(callback, validationError.details.map(d => d.message).join('; '), meta);
      }

      const decoded = verifyAccessToken(access_token);
      if (!decoded) {
        return ErrorHandler.handle(callback, new ErrorHandler.errors.UnauthorizedError('Invalid or expired access token'), meta);
      }

      const result = await SubscriptionService.getSubscription(decoded.id);

      SuccessHandler.ok(callback, result, { ...meta, userId: decoded.id });
    } catch (error) {
      ErrorHandler.handle(callback, error, meta);
    }
  }

  static async checkAccess(call, callback) {
    const meta = { method: 'CheckAccess' };
    try {
      const { user_id, required_level } = call.request;

      const { error: validationError } = Validation.validateCheckAccess({ user_id, required_level });
      if (validationError) {
        return ErrorHandler.invalidArgument(callback, validationError.details.map(d => d.message).join('; '), meta);
      }

      const result = await SubscriptionService.checkAccess(user_id, required_level);

      SuccessHandler.ok(callback, result, { ...meta, userId: user_id });
    } catch (error) {
      ErrorHandler.handle(callback, error, meta);
    }
  }

  static async createCheckout(call, callback) {
    const meta = { method: 'CreateCheckout' };
    try {
      const { access_token, plan_type, payment_method, duration_months, promo_code } = call.request;

      const { error: validationError } = Validation.validateCreateCheckout({ access_token, plan_type, payment_method, duration_months, promo_code });
      if (validationError) {
        return ErrorHandler.invalidArgument(callback, validationError.details.map(d => d.message).join('; '), meta);
      }

      const decoded = verifyAccessToken(access_token);
      if (!decoded) {
        return ErrorHandler.handle(callback, new ErrorHandler.errors.UnauthorizedError('Invalid or expired access token'), meta);
      }

      const result = await SubscriptionService.createCheckout(decoded.id, plan_type, payment_method, duration_months, promo_code || '');

      SuccessHandler.checkoutCreated(callback, result, { ...meta, userId: decoded.id });
    } catch (error) {
      ErrorHandler.handle(callback, error, meta);
    }
  }

  static async cancelSubscription(call, callback) {
    const meta = { method: 'CancelSubscription' };
    try {
      const { access_token } = call.request;

      const { error: validationError } = Validation.validateCancelSubscription({ access_token });
      if (validationError) {
        return ErrorHandler.invalidArgument(callback, validationError.details.map(d => d.message).join('; '), meta);
      }

      const decoded = verifyAccessToken(access_token);
      if (!decoded) {
        return ErrorHandler.handle(callback, new ErrorHandler.errors.UnauthorizedError('Invalid or expired access token'), meta);
      }

      const result = await SubscriptionService.cancelSubscription(decoded.id);

      SuccessHandler.subscriptionUpdated(callback, result, { ...meta, userId: decoded.id });
    } catch (error) {
      ErrorHandler.handle(callback, error, meta);
    }
  }

  static async restoreSubscription(call, callback) {
    const meta = { method: 'RestoreSubscription' };
    try {
      const { access_token } = call.request;

      const { error: validationError } = Validation.validateRestoreSubscription({ access_token });
      if (validationError) {
        return ErrorHandler.invalidArgument(callback, validationError.details.map(d => d.message).join('; '), meta);
      }

      const decoded = verifyAccessToken(access_token);
      if (!decoded) {
        return ErrorHandler.handle(callback, new ErrorHandler.errors.UnauthorizedError('Invalid or expired access token'), meta);
      }

      const result = await SubscriptionService.restoreSubscription(decoded.id);

      SuccessHandler.subscriptionUpdated(callback, result, { ...meta, userId: decoded.id });
    } catch (error) {
      ErrorHandler.handle(callback, error, meta);
    }
  }

  static async adminSetSubscription(call, callback) {
    const meta = { method: 'AdminSetSubscription' };
    try {
      const { access_token, user_id, sub_type, duration_months, issued_by } = call.request;

      const { error: validationError } = Validation.validateAdminSetSubscription({ access_token, user_id, sub_type, duration_months, issued_by });
      if (validationError) {
        return ErrorHandler.invalidArgument(callback, validationError.details.map(d => d.message).join('; '), meta);
      }

      const decoded = verifyAccessToken(access_token);
      if (!decoded) {
        return ErrorHandler.handle(callback, new ErrorHandler.errors.UnauthorizedError('Invalid or expired access token'), meta);
      }

      // Admin role check could be added here if needed
      const result = await SubscriptionService.adminSetSubscription(user_id, sub_type, duration_months, issued_by);

      SuccessHandler.subscriptionUpdated(callback, result, { ...meta, userId: user_id, adminId: decoded.id });
    } catch (error) {
      ErrorHandler.handle(callback, error, meta);
    }
  }

  static async adminRemoveSubscription(call, callback) {
    const meta = { method: 'AdminRemoveSubscription' };
    try {
      const { access_token, user_id, reason } = call.request;

      const { error: validationError } = Validation.validateAdminRemoveSubscription({ access_token, user_id, reason });
      if (validationError) {
        return ErrorHandler.invalidArgument(callback, validationError.details.map(d => d.message).join('; '), meta);
      }

      const decoded = verifyAccessToken(access_token);
      if (!decoded) {
        return ErrorHandler.handle(callback, new ErrorHandler.errors.UnauthorizedError('Invalid or expired access token'), meta);
      }

      const result = await SubscriptionService.adminRemoveSubscription(user_id, reason);

      SuccessHandler.ok(callback, result, { ...meta, userId: user_id, adminId: decoded.id });
    } catch (error) {
      ErrorHandler.handle(callback, error, meta);
    }
  }

  static async getSubscriptionStats(call, callback) {
    const meta = { method: 'GetSubscriptionStats' };
    try {
      const { access_token } = call.request;

      const { error: validationError } = Validation.validateGetSubscriptionStats({ access_token });
      if (validationError) {
        return ErrorHandler.invalidArgument(callback, validationError.details.map(d => d.message).join('; '), meta);
      }

      const decoded = verifyAccessToken(access_token);
      if (!decoded) {
        return ErrorHandler.handle(callback, new ErrorHandler.errors.UnauthorizedError('Invalid or expired access token'), meta);
      }

      const result = await SubscriptionService.getSubscriptionStats();

      SuccessHandler.ok(callback, result, meta);
    } catch (error) {
      ErrorHandler.handle(callback, error, meta);
    }
  }

  // ─────────────────────── Promo Codes ───────────────────────

  static async createPromoCode(call, callback) {
    const meta = { method: 'CreatePromoCode' };
    try {
      const { access_token, code, discount_type, discount_value, max_uses, applicable_tiers, min_duration_months, valid_until } = call.request;

      const { error: validationError } = Validation.validateCreatePromoCode({ access_token, code, discount_type, discount_value, max_uses, applicable_tiers, min_duration_months, valid_until });
      if (validationError) {
        return ErrorHandler.invalidArgument(callback, validationError.details.map(d => d.message).join('; '), meta);
      }

      const decoded = verifyAccessToken(access_token);
      if (!decoded) {
        return ErrorHandler.handle(callback, new ErrorHandler.errors.UnauthorizedError('Invalid or expired access token'), meta);
      }

      const result = await SubscriptionService.createPromoCode({ code, discount_type, discount_value, max_uses, applicable_tiers, min_duration_months, valid_until });

      SuccessHandler.ok(callback, result, { ...meta, adminId: decoded.id });
    } catch (error) {
      ErrorHandler.handle(callback, error, meta);
    }
  }

  static async listPromoCodes(call, callback) {
    const meta = { method: 'ListPromoCodes' };
    try {
      const { access_token, page, limit, active_only } = call.request;

      const { error: validationError } = Validation.validateListPromoCodes({ access_token, page, limit, active_only });
      if (validationError) {
        return ErrorHandler.invalidArgument(callback, validationError.details.map(d => d.message).join('; '), meta);
      }

      const decoded = verifyAccessToken(access_token);
      if (!decoded) {
        return ErrorHandler.handle(callback, new ErrorHandler.errors.UnauthorizedError('Invalid or expired access token'), meta);
      }

      const result = await SubscriptionService.listPromoCodes({ page, limit, active_only });

      SuccessHandler.ok(callback, result, meta);
    } catch (error) {
      ErrorHandler.handle(callback, error, meta);
    }
  }

  static async deactivatePromoCode(call, callback) {
    const meta = { method: 'DeactivatePromoCode' };
    try {
      const { access_token, code } = call.request;

      const { error: validationError } = Validation.validateDeactivatePromoCode({ access_token, code });
      if (validationError) {
        return ErrorHandler.invalidArgument(callback, validationError.details.map(d => d.message).join('; '), meta);
      }

      const decoded = verifyAccessToken(access_token);
      if (!decoded) {
        return ErrorHandler.handle(callback, new ErrorHandler.errors.UnauthorizedError('Invalid or expired access token'), meta);
      }

      const result = await SubscriptionService.deactivatePromoCode(code);

      SuccessHandler.ok(callback, result, { ...meta, adminId: decoded.id });
    } catch (error) {
      ErrorHandler.handle(callback, error, meta);
    }
  }

  static async validatePromoCode(call, callback) {
    const meta = { method: 'ValidatePromoCode' };
    try {
      const { access_token, code, plan_type, duration_months } = call.request;

      const { error: validationError } = Validation.validateValidatePromoCode({ access_token, code, plan_type, duration_months });
      if (validationError) {
        return ErrorHandler.invalidArgument(callback, validationError.details.map(d => d.message).join('; '), meta);
      }

      const decoded = verifyAccessToken(access_token);
      if (!decoded) {
        return ErrorHandler.handle(callback, new ErrorHandler.errors.UnauthorizedError('Invalid or expired access token'), meta);
      }

      const result = await SubscriptionService.validatePromoCode(code, plan_type, duration_months);

      SuccessHandler.ok(callback, result, meta);
    } catch (error) {
      ErrorHandler.handle(callback, error, meta);
    }
  }
}
