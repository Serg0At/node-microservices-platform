import { verifyAccessToken, isTokenExpiredError } from '../utils/jwt-verify.js';
import { refreshTokens } from '../grpc/clients/auth-client.js';
import { config } from '../config/variables.config.js';
import { logger } from '../utils/logger.js';

const REFRESH_COOKIE = 'refresh_token';

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: config.env === 'production',
  sameSite: 'strict',
  path: '/',
};

function decodeUser(decoded) {
  return {
    id: decoded.sub || decoded.id,
    email: decoded.email,
    role: decoded.role,
    ua_hash: decoded.ua_hash,
  };
}

export async function buildContext({ req, res }) {
  const userAgent = req.headers['user-agent'] || '';
  const ip = req.ip;

  const context = { userAgent, ip, user: null, token: null, res, newTokens: null };

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return context;
  }

  const token = authHeader.slice(7);
  try {
    const decoded = verifyAccessToken(token);
    context.user = decodeUser(decoded);
    context.token = token;
  } catch (err) {
    if (!isTokenExpiredError(err)) {
      logger.error('JWT verification failed', { error: err.message });
      return context;
    }

    // Access token expired — attempt auto-refresh
    const refreshToken = req.cookies?.[REFRESH_COOKIE];
    if (!refreshToken) {
      logger.debug('Access token expired, no refresh token cookie present');
      return context;
    }

    try {
      const tokens = await refreshTokens({ refresh_token: refreshToken }, userAgent);

      const decoded = verifyAccessToken(tokens.access_token);
      context.user = decodeUser(decoded);
      context.token = tokens.access_token;

      // Set new refresh token cookie
      res.cookie(REFRESH_COOKIE, tokens.refresh_token, COOKIE_OPTIONS);

      // Store new access token for response extensions
      context.newTokens = { accessToken: tokens.access_token };

      logger.debug('Access token auto-refreshed', { userId: context.user.id });
    } catch (refreshErr) {
      logger.debug('Auto-refresh failed', { error: refreshErr.message });
    }
  }

  return context;
}

export { COOKIE_OPTIONS, REFRESH_COOKIE };
