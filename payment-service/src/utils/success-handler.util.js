import logger from './logger.util.js';

export default class SuccessHandler {
  static ok(callback, data, meta = {}) {
    const { method = 'unknown', ...extra } = meta;
    logger.info('Request completed successfully', { method, ...extra });
    callback(null, data);
  }

  static paymentCreated(callback, data, meta = {}) {
    const { method = 'CreatePayment', orderId, provider, ...extra } = meta;
    logger.info('Payment created', { method, orderId, provider, ...extra });
    callback(null, data);
  }
}
