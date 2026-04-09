import OAuthService from '../services/oauth.service.js';
import { SuccessHandler, ErrorHandler } from '../utils/index.js';

export default class OAuthController {
  static async oidcLogin(call, callback) {
    const meta = { method: 'OIDCLogin' };
    try {
      const { code, provider } = call.request;
      const userAgent = call.metadata.get('user-agent')[0] || 'unknown';

      if (!code || !provider) {
        return ErrorHandler.invalidArgument(callback, 'Missing required fields: code, provider', meta);
      }

      if (provider !== 'google') {
        return ErrorHandler.invalidArgument(callback, `Unsupported provider: ${provider}`, meta);
      }

      const result = await OAuthService.oidcLogin({ code, provider, userAgent });

      SuccessHandler.authenticated(callback, result, {
        ...meta,
        userId: result.user.id,
        provider,
      });
    } catch (error) {
      ErrorHandler.handle(callback, error, meta);
    }
  }
}
