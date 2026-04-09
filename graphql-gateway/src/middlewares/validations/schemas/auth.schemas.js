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
    password: Joi.string().min(8).max(128).required(),
  });

  LoginScheme = Joi.object({
    emailUsername: Joi.string().min(1).required(),
    password: Joi.string().min(1).required(),
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
    newPassword: Joi.string().min(8).max(128).required(),
  });

  ConfirmPasswordChangeScheme = Joi.object({
    token: Joi.string().min(1).required(),
    newPassword: Joi.string().min(8).max(128).required(),
  });

  RefreshTokenScheme = Joi.object({
    refreshToken: Joi.string().min(1).required(),
  });

  VerifyEmailScheme = Joi.object({
    token: Joi.string().min(1).required(),
  });

  LogoutScheme = Joi.object({
    refreshToken: Joi.string().min(1).required(),
  });

  Verify2FAScheme = Joi.object({
    code: Joi.alternatives().try(
      Joi.string().length(6).pattern(/^\d+$/),
      Joi.string().length(8).pattern(/^[0-9a-f]+$/),
    ).required(),
  });
}
