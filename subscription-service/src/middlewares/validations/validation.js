import { SubscriptionSchemas } from './schemas/index.js';

const schemas = new SubscriptionSchemas();

export default class Validation {
  static validateGetSubscription(data) {
    return schemas.GetSubscriptionScheme.validate(data, { abortEarly: false });
  }

  static validateCheckAccess(data) {
    return schemas.CheckAccessScheme.validate(data, { abortEarly: false });
  }

  static validateCreateCheckout(data) {
    return schemas.CreateCheckoutScheme.validate(data, { abortEarly: false });
  }

  static validateCancelSubscription(data) {
    return schemas.CancelSubscriptionScheme.validate(data, { abortEarly: false });
  }

  static validateRestoreSubscription(data) {
    return schemas.RestoreSubscriptionScheme.validate(data, { abortEarly: false });
  }

  static validateAdminRemoveSubscription(data) {
    return schemas.AdminRemoveSubscriptionScheme.validate(data, { abortEarly: false });
  }

  static validateAdminSetSubscription(data) {
    return schemas.AdminSetSubscriptionScheme.validate(data, { abortEarly: false });
  }

  static validateGetSubscriptionStats(data) {
    return schemas.GetSubscriptionStatsScheme.validate(data, { abortEarly: false });
  }

  static validateCreatePromoCode(data) {
    return schemas.CreatePromoCodeScheme.validate(data, { abortEarly: false });
  }

  static validateListPromoCodes(data) {
    return schemas.ListPromoCodesScheme.validate(data, { abortEarly: false });
  }

  static validateDeactivatePromoCode(data) {
    return schemas.DeactivatePromoCodeScheme.validate(data, { abortEarly: false });
  }

  static validateValidatePromoCode(data) {
    return schemas.ValidatePromoCodeScheme.validate(data, { abortEarly: false });
  }
}
