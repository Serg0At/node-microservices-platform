import AuthService from '../services/auth.service.js';
import { SuccessHandler, ErrorHandler } from '../utils/index.js';
import { Validation } from '../middlewares/validations/index.js';

export default class AuthController {
  static async registerUser(call, callback) {
    const meta = { method: 'RegisterUser' };
    try {
      const { email, username, password_hash, fingerprint, ip } = call.request;
      const userAgent = call.metadata.get('user-agent')[0] || 'unknown';

      const { error: validationError } = Validation.validateRegister({ email, username, password_hash });
      if (validationError) {
        return ErrorHandler.invalidArgument(callback, validationError.details.map(d => d.message).join('; '), meta);
      }

      const result = await AuthService.register({
        email,
        username,
        password: password_hash,
        userAgent,
        fingerprint: fingerprint || '',
        ip: ip || '',
      });

      SuccessHandler.registered(callback, result, { ...meta, userId: result.user.id, email });
    } catch (error) {
      ErrorHandler.handle(callback, error, meta);
    }
  }

  static async loginUser(call, callback) {
    const meta = { method: 'LoginUser' };
    try {
      const { email_username, password_hash } = call.request;
      const userAgent = call.metadata.get('user-agent')[0] || 'unknown';

      const { error: validationError } = Validation.validateLogin({ email_username, password_hash });
      if (validationError) {
        return ErrorHandler.invalidArgument(callback, validationError.details.map(d => d.message).join('; '), meta);
      }

      const result = await AuthService.login({
        emailUsername: email_username,
        password: password_hash,
        userAgent,
      });

      SuccessHandler.authenticated(callback, result, { ...meta, userId: result.user.id });
    } catch (error) {
      ErrorHandler.handle(callback, error, meta);
    }
  }

  static async refreshTokens(call, callback) {
    const meta = { method: 'RefreshTokens' };
    try {
      const { refresh_token } = call.request;
      const userAgent = call.metadata.get('user-agent')[0] || 'unknown';

      const { error: validationError } = Validation.validateRefreshToken({ refresh_token });
      if (validationError) {
        return ErrorHandler.invalidArgument(callback, validationError.details.map(d => d.message).join('; '), meta);
      }

      const result = await AuthService.refreshTokens({
        refreshToken: refresh_token,
        userAgent,
      });

      SuccessHandler.tokenRefreshed(callback, result, meta);
    } catch (error) {
      ErrorHandler.handle(callback, error, meta);
    }
  }

  static async forgotPassword(call, callback) {
    const meta = { method: 'ForgotPassword' };
    try {
      const { email } = call.request;

      const { error: validationError } = Validation.validateForgotPassword({ email });
      if (validationError) {
        return ErrorHandler.invalidArgument(callback, validationError.details.map(d => d.message).join('; '), meta);
      }

      const result = await AuthService.forgotPassword({ email });

      SuccessHandler.ok(callback, result, { ...meta, email });
    } catch (error) {
      ErrorHandler.handle(callback, error, meta);
    }
  }

  static async verifyResetCode(call, callback) {
    const meta = { method: 'VerifyResetCode' };
    try {
      const { email, code } = call.request;

      const { error: validationError } = Validation.validateVerifyResetCode({ email, code });
      if (validationError) {
        return ErrorHandler.invalidArgument(callback, validationError.details.map(d => d.message).join('; '), meta);
      }

      const result = await AuthService.verifyResetCode({ email, code });

      SuccessHandler.ok(callback, result, meta);
    } catch (error) {
      ErrorHandler.handle(callback, error, meta);
    }
  }

  static async resetPassword(call, callback) {
    const meta = { method: 'ResetPassword' };
    try {
      const { email, code, new_pass } = call.request;

      const { error: validationError } = Validation.validateResetPassword({ email, code, new_pass });
      if (validationError) {
        return ErrorHandler.invalidArgument(callback, validationError.details.map(d => d.message).join('; '), meta);
      }

      const result = await AuthService.resetPassword({ email, code, newPass: new_pass });

      SuccessHandler.passwordChanged(callback, result, meta);
    } catch (error) {
      ErrorHandler.handle(callback, error, meta);
    }
  }

  static async requestPasswordChange(call, callback) {
    const meta = { method: 'RequestPasswordChange' };
    try {
      const { access_token } = call.request;

      const { error: validationError } = Validation.validateRequestPasswordChange({ access_token });
      if (validationError) {
        return ErrorHandler.invalidArgument(callback, validationError.details.map(d => d.message).join('; '), meta);
      }

      const result = await AuthService.requestPasswordChange({
        accessToken: access_token,
      });

      SuccessHandler.ok(callback, result, meta);
    } catch (error) {
      ErrorHandler.handle(callback, error, meta);
    }
  }

  static async confirmPasswordChange(call, callback) {
    const meta = { method: 'ConfirmPasswordChange' };
    try {
      const { token, new_pass } = call.request;

      const { error: validationError } = Validation.validateConfirmPasswordChange({ token, new_pass });
      if (validationError) {
        return ErrorHandler.invalidArgument(callback, validationError.details.map(d => d.message).join('; '), meta);
      }

      const result = await AuthService.confirmPasswordChange({
        token,
        newPass: new_pass,
      });

      SuccessHandler.passwordChanged(callback, result, meta);
    } catch (error) {
      ErrorHandler.handle(callback, error, meta);
    }
  }

  static async setup2FA(call, callback) {
    const meta = { method: 'Setup2FA' };
    try {
      const { access_token } = call.request;

      const { error: validationError } = Validation.validateSetup2FA({ access_token });
      if (validationError) {
        return ErrorHandler.invalidArgument(callback, validationError.details.map(d => d.message).join('; '), meta);
      }

      const result = await AuthService.setup2FA({ accessToken: access_token });

      SuccessHandler.twoFactorSetup(callback, result, meta);
    } catch (error) {
      ErrorHandler.handle(callback, error, meta);
    }
  }

  static async verify2FA(call, callback) {
    const meta = { method: 'Verify2FA' };
    try {
      const { code, access_token } = call.request;
      const userAgent = call.metadata.get('user-agent')[0] || 'unknown';

      const { error: validationError } = Validation.validateVerify2FA({ code, access_token });
      if (validationError) {
        return ErrorHandler.invalidArgument(callback, validationError.details.map(d => d.message).join('; '), meta);
      }

      const result = await AuthService.verify2FA({
        code,
        accessToken: access_token,
        userAgent,
      });

      SuccessHandler.twoFactorVerified(callback, result, meta);
    } catch (error) {
      ErrorHandler.handle(callback, error, meta);
    }
  }

  static async logout(call, callback) {
    const meta = { method: 'Logout' };
    try {
      const { refresh_token } = call.request;
      const userAgent = call.metadata.get('user-agent')[0] || 'unknown';

      const { error: validationError } = Validation.validateLogout({ refresh_token });
      if (validationError) {
        return ErrorHandler.invalidArgument(callback, validationError.details.map(d => d.message).join('; '), meta);
      }

      const result = await AuthService.logout({
        refreshToken: refresh_token,
        userAgent,
      });

      SuccessHandler.ok(callback, result, meta);
    } catch (error) {
      ErrorHandler.handle(callback, error, meta);
    }
  }

  static async getUserById(call, callback) {
    const meta = { method: 'GetUserById' };
    try {
      const { user_id } = call.request;
      const user = await AuthService.getUserById(user_id);
      if (!user) {
        return ErrorHandler.notFound(callback, 'User not found', meta);
      }
      callback(null, { success: true, user_id: String(user.id), email: user.email, username: user.username });
    } catch (error) {
      ErrorHandler.handle(callback, error, meta);
    }
  }

  static async verifyEmail(call, callback) {
    const meta = { method: 'VerifyEmail' };
    try {
      const { token } = call.request;

      const { error: validationError } = Validation.validateVerifyEmail({ token });
      if (validationError) {
        return ErrorHandler.invalidArgument(callback, validationError.details.map(d => d.message).join('; '), meta);
      }

      const result = await AuthService.verifyEmail({ token });

      SuccessHandler.emailVerified(callback, result, meta);
    } catch (error) {
      ErrorHandler.handle(callback, error, meta);
    }
  }
}
