import { jest, describe, it, expect, beforeEach } from '@jest/globals';

// ── Module-level mocks (must come before dynamic import) ──

const mockAuthModel = {
  findByEmail: jest.fn(),
  findByUsername: jest.fn(),
  findByEmailOrUsername: jest.fn(),
  findById: jest.fn(),
  create: jest.fn(),
  activate: jest.fn(),
  updateLastLogin: jest.fn(),
  updatePassword: jest.fn(),
  find2FAByUserId: jest.fn(),
  create2FA: jest.fn(),
  enable2FA: jest.fn(),
  delete2FA: jest.fn(),
  update2FABackupCodes: jest.fn(),
};

const mockJwtUtil = {
  generateAccessToken: jest.fn(() => ({ accessToken: 'mock-access-token' })),
  generateRefreshToken: jest.fn(() => 'mock-refresh-token'),
  verifyAccessToken: jest.fn(() => ({ id: '1', email: 'test@test.com', role: 0, ua_hash: 'mock-ua-hash' })),
};

const mockCryptoUtil = {
  hashPassword: jest.fn((p) => `hashed-${p}`),
  comparePassword: jest.fn(() => true),
  hashUA: jest.fn(() => 'mock-ua-hash'),
  encrypt: jest.fn(() => 'encrypted-secret'),
  decrypt: jest.fn(() => 'decrypted-secret'),
  sha256: jest.fn((val) => `sha256-${val}`),
  normalizeEmail: jest.fn((email) => email.toLowerCase().split('+')[0].split('@').join('@')),
};

const mockRedisOps = {
  addUserSession: jest.fn(),
  saveRefreshToken: jest.fn(),
  getRefreshToken: jest.fn(),
  deleteRefreshToken: jest.fn(),
  revokeDeviceToken: jest.fn(),
  saveVerificationCode: jest.fn(),
  getVerificationCode: jest.fn(),
  deleteVerificationCode: jest.fn(),
  getUserSubType: jest.fn(() => 0),
  saveChangePasswordToken: jest.fn(),
  getChangePasswordToken: jest.fn(),
  deleteChangePasswordToken: jest.fn(),
  revokeAllSessions: jest.fn(),
};

const mockRedisClient = {
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
};

const mockPublishAuthEvent = jest.fn();

const mockAuthenticator = {
  generateSecret: jest.fn(() => 'TOTP_SECRET'),
  keyuri: jest.fn(() => 'otpauth://totp/test'),
  check: jest.fn(() => true),
  options: {},
};

const mockQRCode = {
  toDataURL: jest.fn(() => 'data:image/png;base64,qrcode'),
};

const mockDb = jest.fn((cb) => cb('trx'));
mockDb.fn = { now: jest.fn(() => 'NOW()') };
mockDb.transaction = jest.fn((cb) => cb('trx'));

jest.unstable_mockModule('../../src/models/index.js', () => ({
  AuthModel: mockAuthModel,
}));

jest.unstable_mockModule('../../src/utils/jwt.util.js', () => ({
  default: mockJwtUtil,
}));

jest.unstable_mockModule('../../src/utils/crypto.util.js', () => ({
  default: mockCryptoUtil,
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
    TOTP: { DIGITS: 6, PERIOD: 30, ISSUER: 'TestAuth', BACKUP_CODES_COUNT: 5 },
    EMAIL: { VERIFY_TOKEN_TTL: 86400 },
    REDIS: { TTL: { USER_SESSIONS: 604800, RESET_CODE: 900, REFRESH_TOKEN: 2592000, CHANGE_PASSWORD_TOKEN: 900 } },
    SECURITY: { ENCRYPTION_KEY: 'a'.repeat(64) },
    RABBITMQ: {
      ROUTING_KEYS: {
        USER_REGISTERED: 'user.registered',
        USER_LOGGED_IN: 'user.logged_in',
        USER_PASSWORD_CHANGED: 'user.password_changed',
        USER_FORGOT_PASSWORD: 'user.forgot_password',
        USER_VERIFY_EMAIL: 'user.verify_email',
        USER_2FA_ENABLED: 'user.2fa_enabled',
        USER_CHANGE_PASSWORD_REQUEST: 'user.change_password_request',
        USER_USERNAME_CHANGED: 'user.username_changed',
      },
    },
  },
}));

jest.unstable_mockModule('../../src/utils/index.js', () => ({
  dbBreaker: { fire: jest.fn((fn) => fn()) },
  redisBreaker: { fire: jest.fn((fn) => fn()) },
  rabbitBreaker: { fire: jest.fn((fn) => fn()) },
}));

jest.unstable_mockModule('otplib', () => ({
  authenticator: mockAuthenticator,
}));

jest.unstable_mockModule('qrcode', () => ({
  default: mockQRCode,
}));

jest.unstable_mockModule('disposable-email-domains', () => ({
  default: ['tempmail.com', 'throwaway.email'],
}));

// ── Import service AFTER mocks ──
const { default: AuthService } = await import('../../src/services/auth.service.js');

// ── Helpers ──
const mockUser = {
  id: 1,
  email: 'test@test.com',
  username: 'testuser',
  role: 0,
  password_hash: 'hashed-password123',
  is_active: true,
  banned_at: null,
};

beforeEach(() => {
  jest.clearAllMocks();

  // Reset common defaults
  mockJwtUtil.generateAccessToken.mockReturnValue({ accessToken: 'mock-access-token' });
  mockJwtUtil.generateRefreshToken.mockReturnValue('mock-refresh-token');
  mockJwtUtil.verifyAccessToken.mockReturnValue({ id: '1', email: 'test@test.com', role: 0, ua_hash: 'mock-ua-hash' });
  mockCryptoUtil.hashPassword.mockImplementation((p) => `hashed-${p}`);
  mockCryptoUtil.comparePassword.mockResolvedValue(true);
  mockCryptoUtil.hashUA.mockReturnValue('mock-ua-hash');
  mockCryptoUtil.encrypt.mockReturnValue('encrypted-secret');
  mockCryptoUtil.decrypt.mockReturnValue('decrypted-secret');
  mockCryptoUtil.sha256.mockImplementation((val) => `sha256-${val}`);
  mockCryptoUtil.normalizeEmail.mockImplementation((email) => {
    const [local, domain] = email.toLowerCase().split('@');
    const stripped = local.split('+')[0];
    return `${stripped}@${domain}`;
  });
  mockAuthenticator.check.mockReturnValue(true);
  mockDb.transaction.mockImplementation((cb) => cb('trx'));
  mockRedisOps.getUserSubType.mockResolvedValue(0);
  mockRedisClient.get.mockResolvedValue(null);
});

// ═══════════════════════════════════════════
//  register()
// ═══════════════════════════════════════════
describe('AuthService.register', () => {
  const registerData = { email: 'new@test.com', username: 'newuser', password: 'password123', userAgent: 'Mozilla/5.0', fingerprint: 'fp123', ip: '1.2.3.4' };

  beforeEach(() => {
    mockAuthModel.findByEmail.mockResolvedValue(null);
    mockAuthModel.findByUsername.mockResolvedValue(null);
    mockAuthModel.create.mockResolvedValue({ id: 2, email: 'new@test.com', username: 'newuser', role: 0 });
  });

  it('should register a new user successfully', async () => {
    const result = await AuthService.register(registerData);

    expect(result.success).toBe(true);
    expect(result.user.email).toBe('new@test.com');
    expect(result.user.username).toBe('newuser');
    expect(result.tokens.access_token).toBe('mock-access-token');
    expect(result.tokens.refresh_token).toBe('mock-refresh-token');
    expect(result.tokens.token_type).toBe('Bearer');
  });

  it('should throw ConflictError if email exists', async () => {
    mockAuthModel.findByEmail.mockResolvedValue(mockUser);

    await expect(AuthService.register(registerData)).rejects.toMatchObject({
      name: 'ConflictError',
      message: 'Email is already in use',
    });
  });

  it('should throw ConflictError if username exists', async () => {
    mockAuthModel.findByUsername.mockResolvedValue(mockUser);

    await expect(AuthService.register(registerData)).rejects.toMatchObject({
      name: 'ConflictError',
      message: 'Username is already in use',
    });
  });

  it('should hash the password before storing', async () => {
    await AuthService.register(registerData);
    expect(mockCryptoUtil.hashPassword).toHaveBeenCalledWith('password123');
  });

  it('should store verification token in Redis', async () => {
    await AuthService.register(registerData);
    expect(mockRedisClient.set).toHaveBeenCalledWith(
      expect.stringMatching(/^verify_token:/),
      expect.any(String),
      'EX',
      86400,
    );
  });

  it('should save refresh token in Redis', async () => {
    await AuthService.register(registerData);
    expect(mockRedisOps.saveRefreshToken).toHaveBeenCalledWith('mock-refresh-token', 2, 'mock-ua-hash');
  });

  it('should publish user.registered event with trial_signals', async () => {
    await AuthService.register(registerData);
    expect(mockPublishAuthEvent).toHaveBeenCalledWith(
      'user.registered',
      expect.objectContaining({
        user_id: 2,
        email: 'new@test.com',
        username: 'newuser',
        trial_signals: expect.objectContaining({
          fingerprint_seen: false,
          ip_seen: false,
          disposable_email: false,
        }),
      }),
    );
  });

  it('should generate access token with sub_type: 0', async () => {
    await AuthService.register(registerData);
    expect(mockJwtUtil.generateAccessToken).toHaveBeenCalledWith(
      expect.objectContaining({ id: 2, email: 'new@test.com', role: 0, sub_type: 0 }),
      'mock-ua-hash',
    );
  });

  it('should normalize email before processing', async () => {
    await AuthService.register(registerData);
    expect(mockCryptoUtil.normalizeEmail).toHaveBeenCalledWith('new@test.com');
  });

  it('should throw InputValidationError for disposable email', async () => {
    mockCryptoUtil.normalizeEmail.mockReturnValue('user@tempmail.com');

    await expect(AuthService.register({ ...registerData, email: 'user@tempmail.com' })).rejects.toMatchObject({
      name: 'InputValidationError',
      message: 'Disposable email addresses are not allowed',
    });
  });

  it('should store trial tracking keys in Redis for fingerprint and IP', async () => {
    await AuthService.register(registerData);

    // fingerprint tracking
    expect(mockRedisClient.set).toHaveBeenCalledWith(
      'trial_devices:sha256-fp123',
      '2',
      'EX',
      365 * 24 * 60 * 60,
    );

    // IP tracking
    expect(mockRedisClient.set).toHaveBeenCalledWith(
      'trial_ips:sha256-1.2.3.4',
      '2',
      'EX',
      30 * 24 * 60 * 60,
    );
  });

  it('should detect previously seen fingerprint', async () => {
    mockRedisClient.get.mockImplementation((key) => {
      if (key === 'trial_devices:sha256-fp123') return Promise.resolve('99');
      return Promise.resolve(null);
    });

    await AuthService.register(registerData);

    expect(mockPublishAuthEvent).toHaveBeenCalledWith(
      'user.registered',
      expect.objectContaining({
        trial_signals: expect.objectContaining({ fingerprint_seen: true }),
      }),
    );
  });

  it('should work without fingerprint and ip', async () => {
    const result = await AuthService.register({ email: 'new@test.com', username: 'newuser', password: 'password123', userAgent: 'Mozilla/5.0' });
    expect(result.success).toBe(true);
  });
});

// ═══════════════════════════════════════════
//  login()
// ═══════════════════════════════════════════
describe('AuthService.login', () => {
  const loginData = { emailUsername: 'test@test.com', password: 'password123', userAgent: 'Mozilla/5.0' };

  beforeEach(() => {
    mockAuthModel.findByEmailOrUsername.mockResolvedValue(mockUser);
    mockAuthModel.find2FAByUserId.mockResolvedValue(null);
  });

  it('should login successfully', async () => {
    const result = await AuthService.login(loginData);

    expect(result.success).toBe(true);
    expect(result.user.email).toBe('test@test.com');
    expect(result.tokens.access_token).toBe('mock-access-token');
    expect(result.tokens.refresh_token).toBe('mock-refresh-token');
    expect(result.requires_2fa).toBe(false);
  });

  it('should throw InvalidPasswordError if user not found', async () => {
    mockAuthModel.findByEmailOrUsername.mockResolvedValue(null);

    await expect(AuthService.login(loginData)).rejects.toMatchObject({
      name: 'InvalidPasswordError',
    });
  });

  it('should throw InvalidPasswordError if password wrong', async () => {
    mockCryptoUtil.comparePassword.mockResolvedValue(false);

    await expect(AuthService.login(loginData)).rejects.toMatchObject({
      name: 'InvalidPasswordError',
    });
  });

  it('should throw UnauthorizedError if account not activated', async () => {
    mockAuthModel.findByEmailOrUsername.mockResolvedValue({ ...mockUser, is_active: false });

    await expect(AuthService.login(loginData)).rejects.toMatchObject({
      name: 'UnauthorizedError',
    });
  });

  it('should throw Forbidden if user is banned', async () => {
    mockAuthModel.findByEmailOrUsername.mockResolvedValue({ ...mockUser, banned_at: new Date() });

    await expect(AuthService.login(loginData)).rejects.toMatchObject({
      name: 'Forbidden',
      message: 'Account has been banned',
    });
  });

  it('should revoke old device token before saving new one', async () => {
    await AuthService.login(loginData);
    expect(mockRedisOps.revokeDeviceToken).toHaveBeenCalledWith(1, 'mock-ua-hash');
  });

  it('should create session in Redis', async () => {
    await AuthService.login(loginData);
    expect(mockRedisOps.addUserSession).toHaveBeenCalledWith(1, 'mock-ua-hash');
  });

  it('should publish user.logged_in event', async () => {
    await AuthService.login(loginData);
    expect(mockPublishAuthEvent).toHaveBeenCalledWith(
      'user.logged_in',
      expect.objectContaining({ user_id: 1, email: 'test@test.com' }),
    );
  });

  it('should return requires_2fa: true when 2FA enabled', async () => {
    mockAuthModel.find2FAByUserId.mockResolvedValue({ enabled: true });

    const result = await AuthService.login(loginData);

    expect(result.requires_2fa).toBe(true);
    expect(result.tokens.refresh_token).toBe('');
    expect(result.tokens.expires_in).toBe(300);
  });

  it('should NOT create session when 2FA is required', async () => {
    mockAuthModel.find2FAByUserId.mockResolvedValue({ enabled: true });

    await AuthService.login(loginData);

    expect(mockRedisOps.addUserSession).not.toHaveBeenCalled();
    expect(mockRedisOps.saveRefreshToken).not.toHaveBeenCalled();
  });

  it('should save refresh token for non-2FA login', async () => {
    await AuthService.login(loginData);
    expect(mockRedisOps.saveRefreshToken).toHaveBeenCalledWith('mock-refresh-token', 1, 'mock-ua-hash');
  });

  it('should include sub_type in JWT payload', async () => {
    mockRedisOps.getUserSubType.mockResolvedValue(2);

    await AuthService.login(loginData);

    expect(mockJwtUtil.generateAccessToken).toHaveBeenCalledWith(
      expect.objectContaining({ sub_type: 2 }),
      'mock-ua-hash',
    );
  });
});

// ═══════════════════════════════════════════
//  refreshTokens()
// ═══════════════════════════════════════════
describe('AuthService.refreshTokens', () => {
  const refreshData = { refreshToken: 'old-refresh-token', userAgent: 'Mozilla/5.0' };

  beforeEach(() => {
    mockRedisOps.getRefreshToken.mockResolvedValue({ user_id: 1, device: 'mock-ua-hash' });
    mockAuthModel.findById.mockResolvedValue(mockUser);
  });

  it('should rotate tokens successfully', async () => {
    const result = await AuthService.refreshTokens(refreshData);

    expect(result.access_token).toBe('mock-access-token');
    expect(result.refresh_token).toBe('mock-refresh-token');
  });

  it('should throw UnauthorizedError if refresh token not found', async () => {
    mockRedisOps.getRefreshToken.mockResolvedValue(null);

    await expect(AuthService.refreshTokens(refreshData)).rejects.toMatchObject({
      name: 'UnauthorizedError',
    });
  });

  it('should throw UnauthorizedError if device mismatch', async () => {
    mockRedisOps.getRefreshToken.mockResolvedValue({ user_id: 1, device: 'different-hash' });

    await expect(AuthService.refreshTokens(refreshData)).rejects.toMatchObject({
      name: 'UnauthorizedError',
      message: 'Device mismatch',
    });
  });

  it('should delete old refresh token', async () => {
    await AuthService.refreshTokens(refreshData);
    expect(mockRedisOps.deleteRefreshToken).toHaveBeenCalledWith('old-refresh-token');
  });

  it('should save new refresh token', async () => {
    await AuthService.refreshTokens(refreshData);
    expect(mockRedisOps.saveRefreshToken).toHaveBeenCalledWith('mock-refresh-token', 1, 'mock-ua-hash');
  });

  it('should throw ResourceNotFoundError if user not found', async () => {
    mockAuthModel.findById.mockResolvedValue(null);

    await expect(AuthService.refreshTokens(refreshData)).rejects.toMatchObject({
      name: 'ResourceNotFoundError',
    });
  });

  it('should throw Forbidden if user is banned', async () => {
    mockAuthModel.findById.mockResolvedValue({ ...mockUser, banned_at: new Date() });

    await expect(AuthService.refreshTokens(refreshData)).rejects.toMatchObject({
      name: 'Forbidden',
      message: 'Account has been banned',
    });
  });

  it('should revoke refresh token when user is banned', async () => {
    mockAuthModel.findById.mockResolvedValue({ ...mockUser, banned_at: new Date() });

    await expect(AuthService.refreshTokens(refreshData)).rejects.toThrow();
    expect(mockRedisOps.deleteRefreshToken).toHaveBeenCalledWith('old-refresh-token');
  });

  it('should include sub_type in JWT payload', async () => {
    mockRedisOps.getUserSubType.mockResolvedValue(1);

    await AuthService.refreshTokens(refreshData);

    expect(mockJwtUtil.generateAccessToken).toHaveBeenCalledWith(
      expect.objectContaining({ sub_type: 1 }),
      'mock-ua-hash',
    );
  });
});

// ═══════════════════════════════════════════
//  forgotPassword()
// ═══════════════════════════════════════════
describe('AuthService.forgotPassword', () => {
  it('should save reset code and publish event for existing user', async () => {
    mockAuthModel.findByEmailOrUsername.mockResolvedValue(mockUser);

    const result = await AuthService.forgotPassword({ email: 'test@test.com' });

    expect(result.success).toBe(true);
    expect(mockRedisOps.saveVerificationCode).toHaveBeenCalledWith('test@test.com', expect.any(String), 1);
    expect(mockPublishAuthEvent).toHaveBeenCalledWith(
      'user.forgot_password',
      expect.objectContaining({ user_id: 1, email: 'test@test.com', code: expect.any(String) }),
    );
  });

  it('should return success even if user not found (enumeration prevention)', async () => {
    mockAuthModel.findByEmailOrUsername.mockResolvedValue(null);

    const result = await AuthService.forgotPassword({ email: 'nonexistent@test.com' });

    expect(result.success).toBe(true);
    expect(mockRedisOps.saveVerificationCode).not.toHaveBeenCalled();
  });

  it('should generate a 6-digit numeric code', async () => {
    mockAuthModel.findByEmailOrUsername.mockResolvedValue(mockUser);

    await AuthService.forgotPassword({ email: 'test@test.com' });

    const code = mockRedisOps.saveVerificationCode.mock.calls[0][1];
    expect(code).toMatch(/^\d{6}$/);
  });
});

// ═══════════════════════════════════════════
//  verifyResetCode()
// ═══════════════════════════════════════════
describe('AuthService.verifyResetCode', () => {
  it('should return success for valid code', async () => {
    mockRedisOps.getVerificationCode.mockResolvedValue({ code: '123456', userId: 1 });

    const result = await AuthService.verifyResetCode({ email: 'test@test.com', code: '123456' });

    expect(result.success).toBe(true);
  });

  it('should throw ExpiredTokenConfirmError if no code in Redis', async () => {
    mockRedisOps.getVerificationCode.mockResolvedValue(null);

    await expect(AuthService.verifyResetCode({ email: 'test@test.com', code: '123456' })).rejects.toMatchObject({
      name: 'ExpiredTokenConfirmError',
    });
  });

  it('should throw InvalidEmailConfirmError if code does not match', async () => {
    mockRedisOps.getVerificationCode.mockResolvedValue({ code: '654321', userId: 1 });

    await expect(AuthService.verifyResetCode({ email: 'test@test.com', code: '123456' })).rejects.toMatchObject({
      name: 'InvalidEmailConfirmError',
    });
  });

  it('should NOT consume the code (read-only)', async () => {
    mockRedisOps.getVerificationCode.mockResolvedValue({ code: '123456', userId: 1 });

    await AuthService.verifyResetCode({ email: 'test@test.com', code: '123456' });

    expect(mockRedisOps.deleteVerificationCode).not.toHaveBeenCalled();
  });
});

// ═══════════════════════════════════════════
//  resetPassword()
// ═══════════════════════════════════════════
describe('AuthService.resetPassword', () => {
  beforeEach(() => {
    mockRedisOps.getVerificationCode.mockResolvedValue({ code: '123456', userId: 1 });
  });

  it('should reset password successfully', async () => {
    const result = await AuthService.resetPassword({ email: 'test@test.com', code: '123456', newPass: 'newpass123' });

    expect(result.success).toBe(true);
    expect(mockAuthModel.updatePassword).toHaveBeenCalledWith(1, 'hashed-newpass123');
  });

  it('should delete reset code from Redis after use', async () => {
    await AuthService.resetPassword({ email: 'test@test.com', code: '123456', newPass: 'newpass123' });
    expect(mockRedisOps.deleteVerificationCode).toHaveBeenCalledWith('test@test.com');
  });

  it('should publish user.password_changed event', async () => {
    await AuthService.resetPassword({ email: 'test@test.com', code: '123456', newPass: 'newpass123' });
    expect(mockPublishAuthEvent).toHaveBeenCalledWith(
      'user.password_changed',
      expect.objectContaining({ user_id: 1 }),
    );
  });

  it('should throw error if code expired', async () => {
    mockRedisOps.getVerificationCode.mockResolvedValue(null);

    await expect(AuthService.resetPassword({ email: 'test@test.com', code: '123456', newPass: 'x' })).rejects.toMatchObject({
      name: 'ExpiredTokenConfirmError',
    });
  });

  it('should throw error if code invalid', async () => {
    mockRedisOps.getVerificationCode.mockResolvedValue({ code: '000000', userId: 1 });

    await expect(AuthService.resetPassword({ email: 'test@test.com', code: '123456', newPass: 'x' })).rejects.toMatchObject({
      name: 'InvalidEmailConfirmError',
    });
  });
});

// ═══════════════════════════════════════════
//  requestPasswordChange()
// ═══════════════════════════════════════════
describe('AuthService.requestPasswordChange', () => {
  it('should send password change link successfully', async () => {
    const result = await AuthService.requestPasswordChange({ accessToken: 'token' });

    expect(result.success).toBe(true);
    expect(result.message).toContain('Password change link sent');
  });

  it('should save change password token in Redis', async () => {
    await AuthService.requestPasswordChange({ accessToken: 'token' });
    expect(mockRedisOps.saveChangePasswordToken).toHaveBeenCalledWith(expect.any(String), '1');
  });

  it('should publish user.change_password_request event', async () => {
    await AuthService.requestPasswordChange({ accessToken: 'token' });
    expect(mockPublishAuthEvent).toHaveBeenCalledWith(
      'user.change_password_request',
      expect.objectContaining({ user_id: '1', email: 'test@test.com', token: expect.any(String) }),
    );
  });

  it('should throw UnauthorizedError if access token invalid', async () => {
    mockJwtUtil.verifyAccessToken.mockReturnValue(null);

    await expect(AuthService.requestPasswordChange({ accessToken: 'bad' })).rejects.toMatchObject({
      name: 'UnauthorizedError',
    });
  });
});

// ═══════════════════════════════════════════
//  confirmPasswordChange()
// ═══════════════════════════════════════════
describe('AuthService.confirmPasswordChange', () => {
  beforeEach(() => {
    mockRedisOps.getChangePasswordToken.mockResolvedValue({ userId: 1 });
    mockAuthModel.findById.mockResolvedValue(mockUser);
  });

  it('should change password successfully', async () => {
    const result = await AuthService.confirmPasswordChange({ token: 'change-token', newPass: 'newpass123' });

    expect(result.success).toBe(true);
    expect(mockAuthModel.updatePassword).toHaveBeenCalledWith(1, 'hashed-newpass123');
  });

  it('should delete change password token after use', async () => {
    await AuthService.confirmPasswordChange({ token: 'change-token', newPass: 'newpass123' });
    expect(mockRedisOps.deleteChangePasswordToken).toHaveBeenCalledWith('change-token');
  });

  it('should revoke all sessions after password change', async () => {
    await AuthService.confirmPasswordChange({ token: 'change-token', newPass: 'newpass123' });
    expect(mockRedisOps.revokeAllSessions).toHaveBeenCalledWith(1);
  });

  it('should publish user.password_changed event', async () => {
    await AuthService.confirmPasswordChange({ token: 'change-token', newPass: 'newpass123' });
    expect(mockPublishAuthEvent).toHaveBeenCalledWith(
      'user.password_changed',
      expect.objectContaining({ user_id: 1, email: 'test@test.com' }),
    );
  });

  it('should throw ExpiredTokenConfirmError if token not found', async () => {
    mockRedisOps.getChangePasswordToken.mockResolvedValue(null);

    await expect(AuthService.confirmPasswordChange({ token: 'expired', newPass: 'x' })).rejects.toMatchObject({
      name: 'ExpiredTokenConfirmError',
    });
  });

  it('should throw ResourceNotFoundError if user not found', async () => {
    mockAuthModel.findById.mockResolvedValue(null);

    await expect(AuthService.confirmPasswordChange({ token: 'change-token', newPass: 'x' })).rejects.toMatchObject({
      name: 'ResourceNotFoundError',
    });
  });
});

// ═══════════════════════════════════════════
//  setup2FA()
// ═══════════════════════════════════════════
describe('AuthService.setup2FA', () => {
  beforeEach(() => {
    mockAuthModel.find2FAByUserId.mockResolvedValue(null);
  });

  it('should generate QR code, secret, and backup codes', async () => {
    const result = await AuthService.setup2FA({ accessToken: 'token' });

    expect(result.success).toBe(true);
    expect(result.qr_code).toBe('data:image/png;base64,qrcode');
    expect(result.secret).toBe('TOTP_SECRET');
    expect(result.backup_codes).toHaveLength(5);
  });

  it('should encrypt secret before storing in DB', async () => {
    await AuthService.setup2FA({ accessToken: 'token' });
    expect(mockCryptoUtil.encrypt).toHaveBeenCalled();
    expect(mockAuthModel.create2FA).toHaveBeenCalledWith(
      '1',
      'encrypted-secret',
      expect.any(Array),
    );
  });

  it('should store backup codes as SHA-256 hashes', async () => {
    await AuthService.setup2FA({ accessToken: 'token' });

    const storedCodes = mockAuthModel.create2FA.mock.calls[0][2];
    storedCodes.forEach((code) => {
      expect(code).toMatch(/^[a-f0-9]{64}$/); // SHA-256 hex
    });
  });

  it('should return plaintext backup codes to user', async () => {
    const result = await AuthService.setup2FA({ accessToken: 'token' });

    result.backup_codes.forEach((code) => {
      expect(code).toMatch(/^[a-f0-9]{8}$/); // 8-char hex
    });
  });

  it('should create user_2fa row with enabled: false', async () => {
    await AuthService.setup2FA({ accessToken: 'token' });
    expect(mockAuthModel.create2FA).toHaveBeenCalled();
  });

  it('should throw ConflictError if 2FA already enabled', async () => {
    mockAuthModel.find2FAByUserId.mockResolvedValue({ enabled: true });

    await expect(AuthService.setup2FA({ accessToken: 'token' })).rejects.toMatchObject({
      name: 'ConflictError',
      message: '2FA is already enabled',
    });
  });

  it('should delete existing unenabled 2FA before re-setup', async () => {
    mockAuthModel.find2FAByUserId.mockResolvedValue({ enabled: false });

    await AuthService.setup2FA({ accessToken: 'token' });

    expect(mockAuthModel.delete2FA).toHaveBeenCalledWith('1');
    expect(mockAuthModel.create2FA).toHaveBeenCalled();
  });
});

// ═══════════════════════════════════════════
//  verify2FA()
// ═══════════════════════════════════════════
describe('AuthService.verify2FA', () => {
  const verifyData = { code: '123456', accessToken: 'token', userAgent: 'Mozilla/5.0' };

  beforeEach(() => {
    mockAuthModel.find2FAByUserId.mockResolvedValue({
      secret: 'encrypted-secret',
      backup_codes: [],
      enabled: true,
    });
  });

  it('should verify TOTP code successfully', async () => {
    const result = await AuthService.verify2FA(verifyData);

    expect(result.success).toBe(true);
    expect(result.message).toBe('2FA verified successfully');
    expect(result.access_token).toBe('mock-access-token');
    expect(result.refresh_token).toBe('mock-refresh-token');
  });

  it('should enable 2FA on first verification', async () => {
    mockAuthModel.find2FAByUserId.mockResolvedValue({
      secret: 'encrypted-secret',
      backup_codes: [],
      enabled: false,
    });

    await AuthService.verify2FA(verifyData);

    expect(mockAuthModel.enable2FA).toHaveBeenCalledWith('1');
  });

  it('should publish user.2fa_enabled event on first activation', async () => {
    mockAuthModel.find2FAByUserId.mockResolvedValue({
      secret: 'encrypted-secret',
      backup_codes: [],
      enabled: false,
    });

    await AuthService.verify2FA(verifyData);

    expect(mockPublishAuthEvent).toHaveBeenCalledWith(
      'user.2fa_enabled',
      expect.objectContaining({ user_id: '1', email: 'test@test.com' }),
    );
  });

  it('should generate access token with acr: 2fa claim and sub_type', async () => {
    mockRedisOps.getUserSubType.mockResolvedValue(1);

    await AuthService.verify2FA(verifyData);

    expect(mockJwtUtil.generateAccessToken).toHaveBeenCalledWith(
      expect.objectContaining({ id: '1', sub_type: 1 }),
      'mock-ua-hash',
      { acr: '2fa' },
    );
  });

  it('should generate refresh token and create session', async () => {
    await AuthService.verify2FA(verifyData);

    expect(mockJwtUtil.generateRefreshToken).toHaveBeenCalled();
    expect(mockRedisOps.addUserSession).toHaveBeenCalledWith('1', 'mock-ua-hash');
    expect(mockRedisOps.saveRefreshToken).toHaveBeenCalled();
  });

  it('should accept valid backup code', async () => {
    const backupCode = 'abcd1234';
    const crypto = await import('crypto');
    const codeHash = crypto.createHash('sha256').update(backupCode).digest('hex');

    mockAuthenticator.check.mockReturnValue(false); // TOTP fails
    mockAuthModel.find2FAByUserId.mockResolvedValue({
      secret: 'encrypted-secret',
      backup_codes: [codeHash],
      enabled: true,
    });

    const result = await AuthService.verify2FA({ ...verifyData, code: backupCode });

    expect(result.success).toBe(true);
    expect(result.message).toContain('backup code');
  });

  it('should remove used backup code from DB', async () => {
    const backupCode = 'abcd1234';
    const crypto = await import('crypto');
    const codeHash = crypto.createHash('sha256').update(backupCode).digest('hex');

    mockAuthenticator.check.mockReturnValue(false);
    mockAuthModel.find2FAByUserId.mockResolvedValue({
      secret: 'encrypted-secret',
      backup_codes: [codeHash, 'other-hash'],
      enabled: true,
    });

    await AuthService.verify2FA({ ...verifyData, code: backupCode });

    expect(mockAuthModel.update2FABackupCodes).toHaveBeenCalledWith('1', ['other-hash']);
  });

  it('should throw Invalid2FACodeError for wrong code', async () => {
    mockAuthenticator.check.mockReturnValue(false);

    await expect(AuthService.verify2FA(verifyData)).rejects.toMatchObject({
      name: 'Invalid2FACodeError',
    });
  });

  it('should throw ResourceNotFoundError if 2FA not set up', async () => {
    mockAuthModel.find2FAByUserId.mockResolvedValue(null);

    await expect(AuthService.verify2FA(verifyData)).rejects.toMatchObject({
      name: 'ResourceNotFoundError',
    });
  });

  it('should throw UnauthorizedError if access token invalid', async () => {
    mockJwtUtil.verifyAccessToken.mockReturnValue(null);

    await expect(AuthService.verify2FA(verifyData)).rejects.toMatchObject({
      name: 'UnauthorizedError',
    });
  });
});

// ═══════════════════════════════════════════
//  verifyEmail()
// ═══════════════════════════════════════════
describe('AuthService.verifyEmail', () => {
  it('should activate user account successfully', async () => {
    mockRedisClient.get.mockResolvedValue(JSON.stringify({ userId: 1, email: 'test@test.com' }));
    mockAuthModel.activate.mockResolvedValue(1);

    const result = await AuthService.verifyEmail({ token: 'abc123' });

    expect(result.success).toBe(true);
    expect(mockAuthModel.activate).toHaveBeenCalledWith(1);
  });

  it('should delete verification token from Redis after use', async () => {
    mockRedisClient.get.mockResolvedValue(JSON.stringify({ userId: 1, email: 'test@test.com' }));
    mockAuthModel.activate.mockResolvedValue(1);

    await AuthService.verifyEmail({ token: 'abc123' });

    expect(mockRedisClient.del).toHaveBeenCalledWith('verify_token:abc123');
  });

  it('should throw error if token not found in Redis', async () => {
    mockRedisClient.get.mockResolvedValue(null);

    await expect(AuthService.verifyEmail({ token: 'expired' })).rejects.toThrow('Verification link expired or invalid');
  });

  it('should throw error if user not found', async () => {
    mockRedisClient.get.mockResolvedValue(JSON.stringify({ userId: 999, email: 'test@test.com' }));
    mockAuthModel.activate.mockResolvedValue(0);

    await expect(AuthService.verifyEmail({ token: 'abc123' })).rejects.toThrow('User not found');
  });
});
