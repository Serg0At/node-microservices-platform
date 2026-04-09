import logger from './logger.util.js';

export default class SuccessHandler {
  static ok(callback, data, meta = {}) {
    const { method = 'unknown', ...extra } = meta;
    logger.info('Request completed successfully', { method, ...extra });
    callback(null, data);
  }

  static subscriptionUpdated(callback, data, meta = {}) {
    const { method = 'unknown', userId, ...extra } = meta;
    logger.info('Subscription updated', { method, userId, ...extra });
    callback(null, data);
  }

  static checkoutCreated(callback, data, meta = {}) {
    const { method = 'CreateCheckout', userId, ...extra } = meta;
    logger.info('Checkout created', { method, userId, ...extra });
    callback(null, data);
  }
}
