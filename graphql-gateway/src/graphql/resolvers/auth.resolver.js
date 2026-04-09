import { GraphQLError } from 'graphql';
import { Validation } from '../../middlewares/validations/index.js';
import * as authGrpc from '../../grpc/clients/auth-client.js';
import { COOKIE_OPTIONS, REFRESH_COOKIE } from '../../middlewares/auth-context.js';
import { audit } from '../../utils/audit.js';

function validate(validatorFn, data) {
  const { error } = validatorFn(data);
  if (error) {
    throw new GraphQLError(
      error.details.map((d) => d.message).join('; '),
      { extensions: { code: 'BAD_USER_INPUT' } },
    );
  }
}

function mapUser(u) {
  if (!u) return null;
  return {
    id: u.id,
    email: u.email,
    username: u.username,
    externalId: u.external_id,
    provider: u.provider,
    subscription: u.subscription
      ? {
          id: u.subscription.id,
          type: u.subscription.type,
          status: u.subscription.status,
          expiresAt: u.subscription.expires_at,
        }
      : null,
  };
}

function mapTokens(t) {
  if (!t) return null;
  return {
    accessToken: t.access_token,
    refreshToken: t.refresh_token,
    tokenType: t.token_type,
    expiresIn: t.expires_in,
  };
}

export const authResolvers = {
  Mutation: {
    async register(_, { email, username, password, fingerprint }, { userAgent, ip, res: httpRes }) {
      validate(Validation.validateRegister, { email, username, password });
      const res = await authGrpc.registerUser(
        { email, username, password_hash: password, fingerprint: fingerprint || '', ip: ip || '' },
        userAgent,
      );
      if (res.tokens?.refresh_token) {
        httpRes.cookie(REFRESH_COOKIE, res.tokens.refresh_token, COOKIE_OPTIONS);
      }
      return {
        success: res.success,
        user: mapUser(res.user),
        tokens: mapTokens(res.tokens),
      };
    },

    async login(_, { emailUsername, password }, { userAgent, ip, res: httpRes }) {
      validate(Validation.validateLogin, { emailUsername, password });
      const res = await authGrpc.loginUser(
        { email_username: emailUsername, password_hash: password },
        userAgent,
      );
      audit(res.success ? 'auth.login.success' : 'auth.login.failure', {
        user: res.user ? { id: res.user.id, email: res.user.email, role: res.user.role } : null,
        ip, userAgent, resourceType: 'auth',
        meta: { email_username: emailUsername },
      });
      if (res.tokens?.refresh_token) {
        httpRes.cookie(REFRESH_COOKIE, res.tokens.refresh_token, COOKIE_OPTIONS);
      }
      return {
        success: res.success,
        user: mapUser(res.user),
        tokens: mapTokens(res.tokens),
        requires2FA: res.requires_2fa,
      };
    },

    async oidcLogin(_, { code, provider, state }, { userAgent, res: httpRes }) {
      const res = await authGrpc.oidcLogin({ code, provider, state }, userAgent);
      if (res.tokens?.refresh_token) {
        httpRes.cookie(REFRESH_COOKIE, res.tokens.refresh_token, COOKIE_OPTIONS);
      }
      return {
        success: res.success,
        user: mapUser(res.user),
        idToken: res.id_token,
        tokens: mapTokens(res.tokens),
      };
    },

    async forgotPassword(_, { email }, { userAgent }) {
      validate(Validation.validateForgotPassword, { email });
      const res = await authGrpc.forgotPassword({ email }, userAgent);
      return { success: res.success, message: res.message };
    },

    async verifyResetCode(_, { email, code }, { userAgent }) {
      validate(Validation.validateVerifyResetCode, { email, code });
      const res = await authGrpc.verifyResetCode({ email, code }, userAgent);
      return { success: res.success, message: res.message };
    },

    async resetPassword(_, { email, code, newPassword }, { userAgent }) {
      validate(Validation.validateResetPassword, { email, code, newPassword });
      const res = await authGrpc.resetPassword(
        { email, code, new_pass: newPassword },
        userAgent,
      );
      return { success: res.success, message: res.message };
    },

    async requestPasswordChange(_, __, { token, userAgent, user, ip }) {
      const res = await authGrpc.requestPasswordChange(
        { access_token: token },
        userAgent,
      );
      audit('auth.password.change.request', {
        user, ip, userAgent, resourceType: 'auth',
      });
      return { success: res.success, message: res.message };
    },

    async confirmPasswordChange(_, { token: changeToken, newPassword }, { userAgent, ip }) {
      validate(Validation.validateConfirmPasswordChange, { token: changeToken, newPassword });
      const res = await authGrpc.confirmPasswordChange(
        { token: changeToken, new_pass: newPassword },
        userAgent,
      );
      audit('auth.password.change.confirm', { ip, userAgent, resourceType: 'auth' });
      return { success: res.success, message: res.message };
    },

    async setup2FA(_, __, { token, userAgent, user, ip }) {
      const res = await authGrpc.setup2FA({ access_token: token }, userAgent);
      audit('auth.2fa.setup', { user, ip, userAgent, resourceType: 'auth' });
      return {
        success: res.success,
        qrCode: res.qr_code,
        secret: res.secret,
        backupCodes: res.backup_codes,
      };
    },

    async verify2FA(_, { code }, { token, userAgent, user, ip, res: httpRes }) {
      validate(Validation.validateVerify2FA, { code });
      const res = await authGrpc.verify2FA({ code, access_token: token }, userAgent);
      audit('auth.2fa.verify', { user, ip, userAgent, resourceType: 'auth' });
      if (res.refresh_token) {
        httpRes.cookie(REFRESH_COOKIE, res.refresh_token, COOKIE_OPTIONS);
      }
      return {
        success: res.success,
        message: res.message,
        accessToken: res.access_token,
        refreshToken: res.refresh_token,
      };
    },

    async verifyEmail(_, { token: emailToken }, { userAgent }) {
      validate(Validation.validateVerifyEmail, { token: emailToken });
      const res = await authGrpc.verifyEmail({ token: emailToken }, userAgent);
      return { success: res.success, message: res.message };
    },

    async refreshTokens(_, { refreshToken }, { userAgent, res: httpRes }) {
      validate(Validation.validateRefreshToken, { refreshToken });
      const res = await authGrpc.refreshTokens({ refresh_token: refreshToken }, userAgent);
      if (res.refresh_token) {
        httpRes.cookie(REFRESH_COOKIE, res.refresh_token, COOKIE_OPTIONS);
      }
      return {
        accessToken: res.access_token,
        refreshToken: res.refresh_token,
      };
    },

    async logout(_, { refreshToken }, { userAgent }) {
      validate(Validation.validateLogout, { refreshToken });
      const res = await authGrpc.logout({ refresh_token: refreshToken }, userAgent);
      return { success: res.success, message: res.message };
    },
  },
};
