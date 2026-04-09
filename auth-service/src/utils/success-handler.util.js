import logger from './logger.util.js';

export default class SuccessHandler {
  /**
   * Send a successful gRPC response with logging.
   *
   * @param {Function} callback - gRPC callback
   * @param {object}   data     - Response payload
   * @param {object}   [meta]   - Extra log context { method, userId, ... }
   */
  static ok(callback, data, meta = {}) {
    const { method = 'unknown', ...extra } = meta;
    logger.info('Request completed successfully', { method, ...extra });
    callback(null, data);
  }

  /**
   * Successful registration handler.
   */
  static registered(callback, data, meta = {}) {
    const { method = 'RegisterUser', userId, email, ...extra } = meta;
    logger.info('User registered', { method, userId, email, ...extra });
    callback(null, data);
  }

  /**
   * Successful login handler.
   */
  static authenticated(callback, data, meta = {}) {
    const { method = 'LoginUser', userId, ...extra } = meta;
    logger.info('User authenticated', { method, userId, ...extra });
    callback(null, data);
  }

  /**
   * Successful token refresh handler.
   */
  static tokenRefreshed(callback, data, meta = {}) {
    const { method = 'RefreshTokens', userId, ...extra } = meta;
    logger.info('Tokens refreshed', { method, userId, ...extra });
    callback(null, data);
  }

  /**
   * Successful token validation handler.
   */
  static tokenValidated(callback, data, meta = {}) {
    const { method = 'ValidateAccessToken', ...extra } = meta;
    logger.info('Token validated', { method, ...extra });
    callback(null, data);
  }

  /**
   * Successful email verification handler.
   */
  static emailVerified(callback, data, meta = {}) {
    const { method = 'VerifyEmail', userId, ...extra } = meta;
    logger.info('Email verified', { method, userId, ...extra });
    callback(null, data);
  }

  /**
   * Successful 2FA setup handler.
   */
  static twoFactorSetup(callback, data, meta = {}) {
    const { method = 'Setup2FA', userId, ...extra } = meta;
    logger.info('2FA setup completed', { method, userId, ...extra });
    callback(null, data);
  }

  /**
   * Successful 2FA verification handler.
   */
  static twoFactorVerified(callback, data, meta = {}) {
    const { method = 'Verify2FA', userId, ...extra } = meta;
    logger.info('2FA verified', { method, userId, ...extra });
    callback(null, data);
  }

  /**
   * Successful password change handler.
   */
  static passwordChanged(callback, data, meta = {}) {
    const { method = 'ResetPassword', userId, ...extra } = meta;
    logger.info('Password changed', { method, userId, ...extra });
    callback(null, data);
  }
}
