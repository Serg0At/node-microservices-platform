import Joi from 'joi';

export default class AuthSchemas {
  RegisterScheme = Joi.object({
    email: Joi.string().email().required(),
    username: Joi.string()
      .pattern(/^[^@]+$/, { name: 'no-at-sign' })
      .min(3)
      .max(30)
      .required()
      .messages({ 'string.pattern.name': 'Username must not contain "@"' }),
    password_hash: Joi.string().min(1).required(),
  });

  LoginScheme = Joi.object({
    email_username: Joi.string().min(1).required(),
    password_hash: Joi.string().min(1).required(),
  });

  RefreshTokenScheme = Joi.object({
    refresh_token: Joi.string().hex().length(64).required(),
  });

  ForgotPasswordScheme = Joi.object({
    email: Joi.string().email().required(),
  });

  VerifyResetCodeScheme = Joi.object({
    email: Joi.string().email().required(),
    code: Joi.string().length(6).pattern(/^\d+$/).required()
      .messages({ 'string.pattern.base': 'Code must be a 6-digit number' }),
  });

  ResetPasswordScheme = Joi.object({
    email: Joi.string().email().required(),
    code: Joi.string().length(6).pattern(/^\d+$/).required()
      .messages({ 'string.pattern.base': 'Code must be a 6-digit number' }),
    new_pass: Joi.string().min(8).required(),
  });

  RequestPasswordChangeScheme = Joi.object({
    access_token: Joi.string().min(1).required(),
  });

  ConfirmPasswordChangeScheme = Joi.object({
    token: Joi.string().hex().length(64).required(),
    new_pass: Joi.string().min(8).required(),
  });

  Setup2FAScheme = Joi.object({
    access_token: Joi.string().min(1).required(),
  });

  VerifyEmailScheme = Joi.object({
    token: Joi.string().hex().length(64).required(),
  });

  Verify2FAScheme = Joi.object({
    code: Joi.alternatives().try(
      Joi.string().length(6).pattern(/^\d+$/),   // TOTP code (6 digits)
      Joi.string().length(8).pattern(/^[0-9a-f]+$/) // backup code (8-char hex)
    ).required(),
    access_token: Joi.string().min(1).required(),
  });

  LogoutScheme = Joi.object({
    refresh_token: Joi.string().hex().length(64).required(),
  });
}
