import { AuthSchemas } from './schemas/index.js';

const auth = new AuthSchemas();

export default class Validation {
  static validateRegister(data) {
    return auth.RegisterScheme.validate(data, { abortEarly: false });
  }

  static validateLogin(data) {
    return auth.LoginScheme.validate(data, { abortEarly: false });
  }

  static validateRefreshToken(data) {
    return auth.RefreshTokenScheme.validate(data, { abortEarly: false });
  }

  static validateForgotPassword(data) {
    return auth.ForgotPasswordScheme.validate(data, { abortEarly: false });
  }

  static validateVerifyResetCode(data) {
    return auth.VerifyResetCodeScheme.validate(data, { abortEarly: false });
  }

  static validateResetPassword(data) {
    return auth.ResetPasswordScheme.validate(data, { abortEarly: false });
  }

  static validateRequestPasswordChange(data) {
    return auth.RequestPasswordChangeScheme.validate(data, { abortEarly: false });
  }

  static validateConfirmPasswordChange(data) {
    return auth.ConfirmPasswordChangeScheme.validate(data, { abortEarly: false });
  }

  static validateVerifyEmail(data) {
    return auth.VerifyEmailScheme.validate(data, { abortEarly: false });
  }

  static validateSetup2FA(data) {
    return auth.Setup2FAScheme.validate(data, { abortEarly: false });
  }

  static validateVerify2FA(data) {
    return auth.Verify2FAScheme.validate(data, { abortEarly: false });
  }

  static validateLogout(data) {
    return auth.LogoutScheme.validate(data, { abortEarly: false });
  }
}
