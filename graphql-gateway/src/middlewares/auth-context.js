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

// In-flight refresh de-duplication. Concurrent requests that arrive at
// `buildContext` with the same expired access token share a single backend
// refresh call instead of stampeding auth-service and racing on the rotated
// refresh token. Keyed by the OLD refresh token value — every request in a
// burst reads the same cookie, so they all hit the same key.
//
// The grace delay before deletion lets a straggler request (whose response
// cookie hasn't been written yet, so it still carries the old token) ride
// the cached result instead of starting a new refresh with a dead token.
const refreshInFlight = new Map();
const REFRESH_GRACE_MS = 5000;

function getOrStartRefresh(oldRefreshToken, userAgent) {
  const existing = refreshInFlight.get(oldRefreshToken);
  if (existing) {
    logger.debug('Refresh single-flight: joined in-flight refresh');
    return existing;
  }

  logger.debug('Refresh single-flight: starting new refresh');
  const p = refreshTokens({ refresh_token: oldRefreshToken }, userAgent)
    .finally(() => {
      setTimeout(() => refreshInFlight.delete(oldRefreshToken), REFRESH_GRACE_MS);
    });

  refreshInFlight.set(oldRefreshToken, p);
  return p;
}

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
      const tokens = await getOrStartRefresh(refreshToken, userAgent);

      const decoded = verifyAccessToken(tokens.access_token);
      context.user = decodeUser(decoded);
      context.token = tokens.access_token;

      // Set new refresh token cookie
      res.cookie(REFRESH_COOKIE, tokens.refresh_token, COOKIE_OPTIONS);

      // Store new access token for response extensions
      context.newTokens = { accessToken: tokens.access_token };

      logger.debug('Access token auto-refreshed', { userId: context.user.id });
    } catch (refreshErr) {
      // With single-flight in place this should be rare — a genuine refresh
      // failure means the refresh token is actually revoked/expired, not a
      // race. Surface it at warn so it's visible.
      logger.warn('Auto-refresh failed', { error: refreshErr.message });
    }
  }

  return context;
}

export { COOKIE_OPTIONS, REFRESH_COOKIE };
