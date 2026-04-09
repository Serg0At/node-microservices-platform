import { Validation } from '../middlewares/validations/index.js';
import AdminService from '../services/admin.service.js';
import ErrorHandler from '../utils/error-handler.util.js';
import SuccessHandler from '../utils/success-handler.util.js';

export default class AdminController {
  static async getDashboardStats(call, callback) {
    const meta = { method: 'GetDashboardStats' };
    try {
      const { access_token } = call.request;
      const { error } = Validation.validateDashboardStats({ access_token });
      if (error) {
        return ErrorHandler.invalidArgument(callback, error.details.map(d => d.message).join('; '), meta);
      }

      const result = await AdminService.getDashboardStats(access_token);
      SuccessHandler.ok(callback, result, meta);
    } catch (error) {
      ErrorHandler.handle(callback, error, meta);
    }
  }

  static async listUsers(call, callback) {
    const meta = { method: 'ListUsers' };
    try {
      const { access_token, page, limit, search, role, status } = call.request;
      const { error } = Validation.validateListUsers({ access_token, page, limit, search, role, status });
      if (error) {
        return ErrorHandler.invalidArgument(callback, error.details.map(d => d.message).join('; '), meta);
      }

      const result = await AdminService.listUsers(access_token, { page, limit, search, role, status });
      SuccessHandler.ok(callback, result, meta);
    } catch (error) {
      ErrorHandler.handle(callback, error, meta);
    }
  }

  static async getUser(call, callback) {
    const meta = { method: 'GetUser' };
    try {
      const { access_token, user_id } = call.request;
      const { error } = Validation.validateGetUser({ access_token, user_id });
      if (error) {
        return ErrorHandler.invalidArgument(callback, error.details.map(d => d.message).join('; '), meta);
      }

      const result = await AdminService.getUser(access_token, user_id);
      SuccessHandler.ok(callback, result, meta);
    } catch (error) {
      ErrorHandler.handle(callback, error, meta);
    }
  }

  static async updateUserRole(call, callback) {
    const meta = { method: 'UpdateUserRole' };
    try {
      const { access_token, user_id, role } = call.request;
      const { error } = Validation.validateUpdateUserRole({ access_token, user_id, role });
      if (error) {
        return ErrorHandler.invalidArgument(callback, error.details.map(d => d.message).join('; '), meta);
      }

      const result = await AdminService.updateUserRole(access_token, user_id, role);
      SuccessHandler.ok(callback, result, meta);
    } catch (error) {
      ErrorHandler.handle(callback, error, meta);
    }
  }

  static async banUser(call, callback) {
    const meta = { method: 'BanUser' };
    try {
      const { access_token, user_id, reason } = call.request;
      const { error } = Validation.validateBanUser({ access_token, user_id, reason });
      if (error) {
        return ErrorHandler.invalidArgument(callback, error.details.map(d => d.message).join('; '), meta);
      }

      const result = await AdminService.banUser(access_token, user_id, reason);
      SuccessHandler.ok(callback, result, meta);
    } catch (error) {
      ErrorHandler.handle(callback, error, meta);
    }
  }

  static async unbanUser(call, callback) {
    const meta = { method: 'UnbanUser' };
    try {
      const { access_token, user_id } = call.request;
      const { error } = Validation.validateUnbanUser({ access_token, user_id });
      if (error) {
        return ErrorHandler.invalidArgument(callback, error.details.map(d => d.message).join('; '), meta);
      }

      const result = await AdminService.unbanUser(access_token, user_id);
      SuccessHandler.ok(callback, result, meta);
    } catch (error) {
      ErrorHandler.handle(callback, error, meta);
    }
  }

  static async createArticle(call, callback) {
    const meta = { method: 'CreateArticle' };
    try {
      const { access_token, title, content, type, cover_image_url, categories } = call.request;
      const { error } = Validation.validateCreateArticle({ access_token, title, content, type, cover_image_url, categories });
      if (error) {
        return ErrorHandler.invalidArgument(callback, error.details.map(d => d.message).join('; '), meta);
      }

      const result = await AdminService.createArticle(access_token, { title, content, type, cover_image_url, categories });
      SuccessHandler.ok(callback, result, meta);
    } catch (error) {
      ErrorHandler.handle(callback, error, meta);
    }
  }

  static async deleteArticle(call, callback) {
    const meta = { method: 'DeleteArticle' };
    try {
      const { access_token, article_id } = call.request;
      const { error } = Validation.validateDeleteArticle({ access_token, article_id });
      if (error) {
        return ErrorHandler.invalidArgument(callback, error.details.map(d => d.message).join('; '), meta);
      }

      const result = await AdminService.deleteArticle(access_token, article_id);
      SuccessHandler.ok(callback, result, meta);
    } catch (error) {
      ErrorHandler.handle(callback, error, meta);
    }
  }

  static async getUploadUrl(call, callback) {
    const meta = { method: 'GetUploadUrl' };
    try {
      const { access_token, filename, content_type, article_id } = call.request;
      const { error } = Validation.validateGetUploadUrl({ access_token, filename, content_type, article_id });
      if (error) {
        return ErrorHandler.invalidArgument(callback, error.details.map(d => d.message).join('; '), meta);
      }

      const result = await AdminService.getUploadUrl(access_token, { filename, content_type, article_id });
      SuccessHandler.ok(callback, result, meta);
    } catch (error) {
      ErrorHandler.handle(callback, error, meta);
    }
  }

  static async getArticleStats(call, callback) {
    const meta = { method: 'GetArticleStats' };
    try {
      const { access_token } = call.request;
      const { error } = Validation.validateGetArticleStats({ access_token });
      if (error) {
        return ErrorHandler.invalidArgument(callback, error.details.map(d => d.message).join('; '), meta);
      }

      const result = await AdminService.getArticleStats(access_token);
      SuccessHandler.ok(callback, result, meta);
    } catch (error) {
      ErrorHandler.handle(callback, error, meta);
    }
  }

  static async adminSetSubscription(call, callback) {
    const meta = { method: 'AdminSetSubscription' };
    try {
      const { access_token, user_id, sub_type, duration_months, issued_by } = call.request;
      const { error } = Validation.validateAdminSetSubscription({ access_token, user_id, sub_type, duration_months, issued_by });
      if (error) {
        return ErrorHandler.invalidArgument(callback, error.details.map(d => d.message).join('; '), meta);
      }

      const result = await AdminService.adminSetSubscription(access_token, { user_id, sub_type, duration_months, issued_by });
      SuccessHandler.ok(callback, result, meta);
    } catch (error) {
      ErrorHandler.handle(callback, error, meta);
    }
  }

  static async adminRemoveSubscription(call, callback) {
    const meta = { method: 'AdminRemoveSubscription' };
    try {
      const { access_token, user_id, reason } = call.request;
      const { error } = Validation.validateAdminRemoveSubscription({ access_token, user_id, reason });
      if (error) {
        return ErrorHandler.invalidArgument(callback, error.details.map(d => d.message).join('; '), meta);
      }

      const result = await AdminService.adminRemoveSubscription(access_token, { user_id, reason });
      SuccessHandler.ok(callback, result, meta);
    } catch (error) {
      ErrorHandler.handle(callback, error, meta);
    }
  }

  static async getSubscriptionStats(call, callback) {
    const meta = { method: 'GetSubscriptionStats' };
    try {
      const { access_token } = call.request;
      const { error } = Validation.validateGetSubscriptionStats({ access_token });
      if (error) {
        return ErrorHandler.invalidArgument(callback, error.details.map(d => d.message).join('; '), meta);
      }

      const result = await AdminService.getSubscriptionStats(access_token);
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
      const { error } = Validation.validateCreatePromoCode({ access_token, code, discount_type, discount_value, max_uses, applicable_tiers, min_duration_months, valid_until });
      if (error) {
        return ErrorHandler.invalidArgument(callback, error.details.map(d => d.message).join('; '), meta);
      }

      const result = await AdminService.createPromoCode(access_token, { code, discount_type, discount_value, max_uses, applicable_tiers, min_duration_months, valid_until });
      SuccessHandler.ok(callback, result, meta);
    } catch (error) {
      ErrorHandler.handle(callback, error, meta);
    }
  }

  static async listPromoCodes(call, callback) {
    const meta = { method: 'ListPromoCodes' };
    try {
      const { access_token, page, limit, active_only } = call.request;
      const { error } = Validation.validateListPromoCodes({ access_token, page, limit, active_only });
      if (error) {
        return ErrorHandler.invalidArgument(callback, error.details.map(d => d.message).join('; '), meta);
      }

      const result = await AdminService.listPromoCodes(access_token, { page, limit, active_only });
      SuccessHandler.ok(callback, result, meta);
    } catch (error) {
      ErrorHandler.handle(callback, error, meta);
    }
  }

  static async deactivatePromoCode(call, callback) {
    const meta = { method: 'DeactivatePromoCode' };
    try {
      const { access_token, code } = call.request;
      const { error } = Validation.validateDeactivatePromoCode({ access_token, code });
      if (error) {
        return ErrorHandler.invalidArgument(callback, error.details.map(d => d.message).join('; '), meta);
      }

      const result = await AdminService.deactivatePromoCode(access_token, code);
      SuccessHandler.ok(callback, result, meta);
    } catch (error) {
      ErrorHandler.handle(callback, error, meta);
    }
  }

  static async adminSendNotification(call, callback) {
    const meta = { method: 'AdminSendNotification' };
    try {
      const { access_token, user_id, email, subject, body, channel } = call.request;
      const { error } = Validation.validateSendNotification({ access_token, user_id, email, subject, body, channel });
      if (error) {
        return ErrorHandler.invalidArgument(callback, error.details.map(d => d.message).join('; '), meta);
      }

      const result = await AdminService.sendNotification(access_token, { user_id, email, subject, body, channel });
      SuccessHandler.ok(callback, result, meta);
    } catch (error) {
      ErrorHandler.handle(callback, error, meta);
    }
  }

  static async adminSendBulkNotification(call, callback) {
    const meta = { method: 'AdminSendBulkNotification' };
    try {
      const { access_token, subject, body, channel, recipients } = call.request;
      const { error } = Validation.validateSendBulkNotification({ access_token, subject, body, channel, recipients });
      if (error) {
        return ErrorHandler.invalidArgument(callback, error.details.map(d => d.message).join('; '), meta);
      }

      const result = await AdminService.sendBulkNotification(access_token, { subject, body, channel, recipients });
      SuccessHandler.ok(callback, result, meta);
    } catch (error) {
      ErrorHandler.handle(callback, error, meta);
    }
  }
}
