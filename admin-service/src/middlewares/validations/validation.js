import { AdminSchemas } from './schemas/index.js';

export default class Validation {
  static validateDashboardStats(data) {
    return AdminSchemas.DashboardStatsScheme.validate(data, { abortEarly: false });
  }

  static validateListUsers(data) {
    return AdminSchemas.ListUsersScheme.validate(data, { abortEarly: false });
  }

  static validateGetUser(data) {
    return AdminSchemas.GetUserScheme.validate(data, { abortEarly: false });
  }

  static validateUpdateUserRole(data) {
    return AdminSchemas.UpdateUserRoleScheme.validate(data, { abortEarly: false });
  }

  static validateBanUser(data) {
    return AdminSchemas.BanUserScheme.validate(data, { abortEarly: false });
  }

  static validateUnbanUser(data) {
    return AdminSchemas.UnbanUserScheme.validate(data, { abortEarly: false });
  }

  static validateCreateArticle(data) {
    return AdminSchemas.CreateArticleScheme.validate(data, { abortEarly: false });
  }

  static validateDeleteArticle(data) {
    return AdminSchemas.DeleteArticleScheme.validate(data, { abortEarly: false });
  }

  static validateGetUploadUrl(data) {
    return AdminSchemas.GetUploadUrlScheme.validate(data, { abortEarly: false });
  }

  static validateGetArticleStats(data) {
    return AdminSchemas.GetArticleStatsScheme.validate(data, { abortEarly: false });
  }

  static validateAdminSetSubscription(data) {
    return AdminSchemas.AdminSetSubscriptionScheme.validate(data, { abortEarly: false });
  }

  static validateAdminRemoveSubscription(data) {
    return AdminSchemas.AdminRemoveSubscriptionScheme.validate(data, { abortEarly: false });
  }

  static validateGetSubscriptionStats(data) {
    return AdminSchemas.GetSubscriptionStatsScheme.validate(data, { abortEarly: false });
  }

  static validateCreatePromoCode(data) {
    return AdminSchemas.CreatePromoCodeScheme.validate(data, { abortEarly: false });
  }

  static validateListPromoCodes(data) {
    return AdminSchemas.ListPromoCodesScheme.validate(data, { abortEarly: false });
  }

  static validateDeactivatePromoCode(data) {
    return AdminSchemas.DeactivatePromoCodeScheme.validate(data, { abortEarly: false });
  }

  static validateSendNotification(data) {
    return AdminSchemas.SendNotificationScheme.validate(data, { abortEarly: false });
  }

  static validateSendBulkNotification(data) {
    return AdminSchemas.SendBulkNotificationScheme.validate(data, { abortEarly: false });
  }

}
