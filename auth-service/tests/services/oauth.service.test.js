import { jest, describe, it, expect, beforeEach } from '@jest/globals';

// ── Module-level mocks ──

const mockAuthModel = {
  findByEmailOrUsername: jest.fn(),
  create: jest.fn(),
  updateLastLogin: jest.fn(),
};

const mockOAuthModel = {
  findByProvider: jest.fn(),
  create: jest.fn(),
  updateTokens: jest.fn(),
};

const mockJwtUtil = {
  generateAccessToken: jest.fn(() => ({ accessToken: 'mock-access-token' })),
  generateRefreshToken: jest.fn(() => 'mock-refresh-token'),
};

const mockCryptoUtil = {
  hashUA: jest.fn(() => 'mock-ua-hash'),
  encrypt: jest.fn((val) => `encrypted-${val}`),
};

const mockRandomizer = {
  generateRandomUsername: jest.fn(() => 'SwiftWolf1234'),
};

const mockRedisOps = {
  saveRefreshToken: jest.fn(),
  revokeDeviceToken: jest.fn(),
};

const mockRedisClient = {
  sadd: jest.fn(),
  expire: jest.fn(),
};

const mockPublishAuthEvent = jest.fn();

const mockDb = jest.fn();
mockDb.transaction = jest.fn((cb) => cb('trx'));

// Mock global fetch for Google API calls
const mockFetch = jest.fn();
global.fetch = mockFetch;

jest.unstable_mockModule('../../src/models/index.js', () => ({
  AuthModel: mockAuthModel,
  OAuthModel: mockOAuthModel,
}));

jest.unstable_mockModule('../../src/utils/jwt.util.js', () => ({
  default: mockJwtUtil,
}));

jest.unstable_mockModule('../../src/utils/crypto.util.js', () => ({
  default: mockCryptoUtil,
}));

jest.unstable_mockModule('../../src/utils/randomizer.util.js', () => ({
  default: mockRandomizer,
}));

jest.unstable_mockModule('../../src/redis/redisClient.js', () => ({
  redisOps: mockRedisOps,
  getRedis: () => mockRedisClient,
}));

jest.unstable_mockModule('../../src/rabbit/publisher.js', () => ({
  publishAuthEvent: mockPublishAuthEvent,
}));

jest.unstable_mockModule('../../src/config/db.js', () => ({
  default: mockDb,
}));

jest.unstable_mockModule('../../src/config/variables.config.js', () => ({
  default: {
    GOOGLE_OAUTH: {
      CLIENT_ID: 'google-client-id',
      CLIENT_SECRET: 'google-client-secret',
      CALLBACK_URL: 'http://localhost/callback',
    },
    SECURITY: { ENCRYPTION_KEY: 'a'.repeat(64) },
    REDIS: { TTL: { USER_SESSIONS: 604800, REFRESH_TOKEN: 2592000 } },
    RABBITMQ: {
      ROUTING_KEYS: {
        USER_REGISTERED: 'user.registered',
        USER_LOGGED_IN: 'user.logged_in',
      },
    },
  },
}));

// ── Import service AFTER mocks ──
const { default: OAuthService } = await import('../../src/services/oauth.service.js');

// ── Helpers ──
const googleTokenResponse = {
  access_token: 'google-access-token',
  refresh_token: 'google-refresh-token',
  id_token: 'google-id-token',
  expires_in: 3600,
};

const googleUserInfo = {
  id: 'google_123',
  email: 'oauth@gmail.com',
  picture: 'https://photo.url/pic.jpg',
};

function setupGoogleMocks() {
  mockFetch
    .mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(googleTokenResponse),
    })
    .mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(googleUserInfo),
    });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockJwtUtil.generateAccessToken.mockReturnValue({ accessToken: 'mock-access-token' });
  mockJwtUtil.generateRefreshToken.mockReturnValue('mock-refresh-token');
  mockDb.transaction.mockImplementation((cb) => cb('trx'));
});

describe('OAuthService.oidcLogin', () => {
  const loginData = { code: 'auth-code', provider: 'google', userAgent: 'Mozilla/5.0' };

  it('should exchange auth code for Google tokens', async () => {
    setupGoogleMocks();
    mockOAuthModel.findByProvider.mockResolvedValue(null);
    mockAuthModel.findByEmailOrUsername.mockResolvedValue(null);
    mockAuthModel.create.mockResolvedValue({ id: 1, email: 'oauth@gmail.com', username: 'SwiftWolf1234', role: 0 });

    await OAuthService.oidcLogin(loginData);

    expect(mockFetch).toHaveBeenCalledWith(
      'https://oauth2.googleapis.com/token',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('should fetch user info from Google', async () => {
    setupGoogleMocks();
    mockOAuthModel.findByProvider.mockResolvedValue(null);
    mockAuthModel.findByEmailOrUsername.mockResolvedValue(null);
    mockAuthModel.create.mockResolvedValue({ id: 1, email: 'oauth@gmail.com', username: 'SwiftWolf1234', role: 0 });

    await OAuthService.oidcLogin(loginData);

    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(mockFetch.mock.calls[1][0]).toBe('https://www.googleapis.com/oauth2/v2/userinfo');
  });

  it('should create new user + OAuth account for first login', async () => {
    setupGoogleMocks();
    mockOAuthModel.findByProvider.mockResolvedValue(null);
    mockAuthModel.findByEmailOrUsername.mockResolvedValue(null);
    mockAuthModel.create.mockResolvedValue({ id: 1, email: 'oauth@gmail.com', username: 'SwiftWolf1234', role: 0 });

    const result = await OAuthService.oidcLogin(loginData);

    expect(mockAuthModel.create).toHaveBeenCalledWith(expect.objectContaining({
      email: 'oauth@gmail.com',
      is_active: true,
    }), 'trx');
    expect(mockOAuthModel.create).toHaveBeenCalledWith(expect.objectContaining({
      provider: 'google',
      external_id: 'google_123',
    }), 'trx');
    expect(result.success).toBe(true);
  });

  it('should link OAuth to existing user on subsequent login', async () => {
    setupGoogleMocks();
    mockOAuthModel.findByProvider.mockResolvedValue(null);
    mockAuthModel.findByEmailOrUsername.mockResolvedValue({ id: 5, email: 'oauth@gmail.com', username: 'existing', role: 0 });

    const result = await OAuthService.oidcLogin(loginData);

    expect(mockAuthModel.create).not.toHaveBeenCalled();
    expect(mockOAuthModel.create).toHaveBeenCalledWith(expect.objectContaining({
      user_id: 5,
    }), 'trx');
    expect(result.user.id).toBe('5');
  });

  it('should update OAuth tokens on returning user re-login', async () => {
    setupGoogleMocks();
    mockOAuthModel.findByProvider.mockResolvedValue({ id: 1, email: 'oauth@gmail.com', username: 'existing', role: 0 });

    await OAuthService.oidcLogin(loginData);

    expect(mockOAuthModel.updateTokens).toHaveBeenCalledWith(
      'google',
      'google_123',
      expect.objectContaining({
        access_token: expect.stringContaining('encrypted-'),
      }),
      'trx',
    );
  });

  it('should generate access and refresh tokens', async () => {
    setupGoogleMocks();
    mockOAuthModel.findByProvider.mockResolvedValue({ id: 1, email: 'oauth@gmail.com', username: 'existing', role: 0 });

    const result = await OAuthService.oidcLogin(loginData);

    expect(result.tokens.access_token).toBe('mock-access-token');
    expect(result.tokens.refresh_token).toBe('mock-refresh-token');
    expect(result.tokens.token_type).toBe('Bearer');
  });

  it('should create session in Redis', async () => {
    setupGoogleMocks();
    mockOAuthModel.findByProvider.mockResolvedValue({ id: 1, email: 'oauth@gmail.com', username: 'existing', role: 0 });

    await OAuthService.oidcLogin(loginData);

    expect(mockRedisClient.sadd).toHaveBeenCalledWith('user_sessions:1', 'mock-ua-hash');
    expect(mockRedisClient.expire).toHaveBeenCalledWith('user_sessions:1', 604800);
  });

  it('should publish user.registered event for new users', async () => {
    setupGoogleMocks();
    mockOAuthModel.findByProvider.mockResolvedValue(null);
    mockAuthModel.findByEmailOrUsername.mockResolvedValue(null);
    mockAuthModel.create.mockResolvedValue({ id: 1, email: 'oauth@gmail.com', username: 'SwiftWolf1234', role: 0 });

    await OAuthService.oidcLogin(loginData);

    expect(mockPublishAuthEvent).toHaveBeenCalledWith(
      'user.registered',
      expect.objectContaining({ user_id: 1, email: 'oauth@gmail.com' }),
    );
  });

  it('should publish user.logged_in event for returning users', async () => {
    setupGoogleMocks();
    mockOAuthModel.findByProvider.mockResolvedValue({ id: 1, email: 'oauth@gmail.com', username: 'existing', role: 0 });

    await OAuthService.oidcLogin(loginData);

    expect(mockPublishAuthEvent).toHaveBeenCalledWith(
      'user.logged_in',
      expect.objectContaining({ user_id: 1 }),
    );
  });

  it('should throw error for invalid auth code', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: () => Promise.resolve({ error: 'invalid_grant', error_description: 'Code expired' }),
    });

    await expect(OAuthService.oidcLogin(loginData)).rejects.toThrow('Failed to exchange authorization code with Google');
  });

  it('should throw error if Google userinfo fails', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(googleTokenResponse),
      })
      .mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({}),
      });

    await expect(OAuthService.oidcLogin(loginData)).rejects.toThrow('Failed to fetch user info from Google');
  });

  it('should revoke old device token before new login', async () => {
    setupGoogleMocks();
    mockOAuthModel.findByProvider.mockResolvedValue({ id: 1, email: 'oauth@gmail.com', username: 'existing', role: 0 });

    await OAuthService.oidcLogin(loginData);

    expect(mockRedisOps.revokeDeviceToken).toHaveBeenCalledWith(1, 'mock-ua-hash');
  });

  it('should save device token reverse index', async () => {
    setupGoogleMocks();
    mockOAuthModel.findByProvider.mockResolvedValue({ id: 1, email: 'oauth@gmail.com', username: 'existing', role: 0 });

    await OAuthService.oidcLogin(loginData);

    expect(mockRedisOps.saveRefreshToken).toHaveBeenCalledWith('mock-refresh-token', 1, 'mock-ua-hash');
  });

  it('should return user object with external_id and provider', async () => {
    setupGoogleMocks();
    mockOAuthModel.findByProvider.mockResolvedValue({ id: 1, email: 'oauth@gmail.com', username: 'existing', role: 0 });

    const result = await OAuthService.oidcLogin(loginData);

    expect(result.user.external_id).toBe('google_123');
    expect(result.user.provider).toBe('google');
  });

  it('should return id_token from Google', async () => {
    setupGoogleMocks();
    mockOAuthModel.findByProvider.mockResolvedValue({ id: 1, email: 'oauth@gmail.com', username: 'existing', role: 0 });

    const result = await OAuthService.oidcLogin(loginData);

    expect(result.id_token).toBe('google-id-token');
  });
});
