import logger from './logger.util.js';

export default class SuccessHandler {
  static ok(callback, data, meta = {}) {
    const { method = 'unknown', ...extra } = meta;
    logger.info('Request completed successfully', { method, ...extra });
    callback(null, data);
  }

  static profileFetched(callback, data, meta = {}) {
    const { method = 'GetProfile', userId, ...extra } = meta;
    logger.info('Profile fetched', { method, userId, ...extra });
    callback(null, data);
  }

  static profileUpdated(callback, data, meta = {}) {
    const { method = 'UpdateProfile', userId, ...extra } = meta;
    logger.info('Profile updated', { method, userId, ...extra });
    callback(null, data);
  }
}
