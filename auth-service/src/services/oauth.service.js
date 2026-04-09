import CryptoUtil from '../utils/crypto.util.js';
import JwtUtil from '../utils/jwt.util.js';
import Randomizer from '../utils/randomizer.util.js';
import { publishAuthEvent } from '../rabbit/publisher.js';
import { getRedis, redisOps } from '../redis/redisClient.js';
import config from '../config/variables.config.js';
import db from '../config/db.js';
import { AuthModel, OAuthModel } from '../models/index.js';

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_USERINFO_URL = 'https://www.googleapis.com/oauth2/v2/userinfo';

export default class OAuthService {
  static async oidcLogin({ code, provider, userAgent }) {
    // 1. Exchange authorization code → Google tokens
    const tokenRes = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: config.GOOGLE_OAUTH.CLIENT_ID,
        client_secret: config.GOOGLE_OAUTH.CLIENT_SECRET,
        redirect_uri: config.GOOGLE_OAUTH.CALLBACK_URL,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenRes.ok) {
      const errBody = await tokenRes.json().catch(() => ({}));
      throw new Error(`Failed to exchange authorization code with Google: ${errBody.error} — ${errBody.error_description}`);
    }

    const {
      access_token: googleAccessToken,
      refresh_token: googleRefreshToken,
      id_token: idToken,
      expires_in,
    } = await tokenRes.json();

    // 2. Get user profile from Google
    const userInfoRes = await fetch(GOOGLE_USERINFO_URL, {
      headers: { Authorization: `Bearer ${googleAccessToken}` },
    });

    if (!userInfoRes.ok) {
      throw new Error('Failed to fetch user info from Google');
    }

    const { id: externalId, email } = await userInfoRes.json();

    // 3. Encrypt Google tokens before storing
    const encryptedAccessToken = CryptoUtil.encrypt(googleAccessToken, config.SECURITY.ENCRYPTION_KEY);
    const encryptedRefreshToken = googleRefreshToken
      ? CryptoUtil.encrypt(googleRefreshToken, config.SECURITY.ENCRYPTION_KEY)
      : null;
    const expiresAt = new Date(Date.now() + expires_in * 1000);

    // 4. Find or create user in a DB transaction
    let user;
    let isNewUser = false;

    await db.transaction(async (trx) => {
      const existingOAuth = await OAuthModel.findByProvider(provider, externalId, trx);

      if (existingOAuth) {
        // Returning user — refresh stored Google tokens and last_login
        user = existingOAuth;
        await OAuthModel.updateTokens(provider, externalId, {
          access_token: encryptedAccessToken,
          refresh_token: encryptedRefreshToken,
          expires_at: expiresAt,
        }, trx);
        await AuthModel.updateLastLogin(user.id, trx);
      } else {
        const existingUser = await AuthModel.findByEmailOrUsername(email, trx);

        if (existingUser) {
          // Link OAuth to the existing email/password account
          user = existingUser;
          await OAuthModel.create({
            user_id: user.id,
            provider,
            external_id: externalId,
            access_token: encryptedAccessToken,
            refresh_token: encryptedRefreshToken,
            expires_at: expiresAt,
          }, trx);
          await AuthModel.updateLastLogin(user.id, trx);
        } else {
          // Brand new user — create account + OAuth record
          isNewUser = true;
          user = await AuthModel.create({
            email,
            username: Randomizer.generateRandomUsername(),
            role: 0,
            is_active: true,
          }, trx);
          await OAuthModel.create({
            user_id: user.id,
            provider,
            external_id: externalId,
            access_token: encryptedAccessToken,
            refresh_token: encryptedRefreshToken,
            expires_at: expiresAt,
          }, trx);
        }
      }
    });

    // 5. Register session in Redis
    const uaHash = CryptoUtil.hashUA(userAgent);
    await getRedis().sadd(`user_sessions:${user.id}`, uaHash);
    await getRedis().expire(`user_sessions:${user.id}`, config.REDIS.TTL.USER_SESSIONS);

    // 6. Generate your own tokens (independent of Google tokens)
    const { accessToken } = JwtUtil.generateAccessToken(
      { id: user.id, email: user.email, role: user.role },
      uaHash
    );
    const refreshToken = JwtUtil.generateRefreshToken();
    await redisOps.revokeDeviceToken(user.id, uaHash);
    await redisOps.saveRefreshToken(refreshToken, user.id, uaHash);

    // 7. Publish RabbitMQ event
    const ts = Math.floor(Date.now() / 1000);
    if (isNewUser) {
      await publishAuthEvent(config.RABBITMQ.ROUTING_KEYS.USER_REGISTERED, {
        user_id: user.id,
        email: user.email,
        ts,
      });
    } else {
      await publishAuthEvent(config.RABBITMQ.ROUTING_KEYS.USER_LOGGED_IN, {
        user_id: user.id,
        device: userAgent,
        ts,
      });
    }

    return {
      success: true,
      user: {
        id: user.id.toString(),
        email: user.email,
        username: user.username,
        external_id: externalId,
        provider,
        subscription: null,
      },
      id_token: idToken,
      tokens: {
        access_token: accessToken,
        refresh_token: refreshToken,
        token_type: 'Bearer',
        expires_in: 3600,
      },
    };
  }
}
