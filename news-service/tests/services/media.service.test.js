import { jest } from '@jest/globals';

/* ============================================================
   MODULE-LEVEL MOCKS
   ============================================================ */

// ── JWT ──────────────────────────────────────────────────────
const mockJwtUtil = {
  verifyAccessToken: jest.fn(() => ({
    sub: '42',
    email: 'user@test.com',
    role: 0,
  })),
};

jest.unstable_mockModule('../../src/utils/jwt.util.js', () => ({
  default: mockJwtUtil,
}));

// ── S3 Client ────────────────────────────────────────────────
const mockGetPresignedUploadUrl = jest.fn(() => ({
  uploadUrl: 'https://s3.test/upload?presigned=abc',
  fileUrl: 'https://s3.test/news-media-bucket/articles/general/123-cover.jpg',
  expiresIn: 3600,
}));

jest.unstable_mockModule('../../src/s3/s3Client.js', () => ({
  getPresignedUploadUrl: mockGetPresignedUploadUrl,
  initS3: jest.fn(),
  getS3: jest.fn(),
}));

// ── Config ───────────────────────────────────────────────────
jest.unstable_mockModule('../../src/config/variables.config.js', () => ({
  default: {
    PSQL: { HOST: 'localhost', PORT: 5432, USER: 'test', PASSWORD: 'test', DATABASE: 'test', SSL: false },
    S3: {
      BUCKET: 'news-media-bucket',
      PRESIGNED_URL_EXPIRES: 3600,
    },
  },
}));

// ── Circuit Breakers ─────────────────────────────────────────
jest.unstable_mockModule('../../src/utils/circuit-breaker.util.js', () => ({
  dbBreaker: { fire: jest.fn((fn) => fn()) },
  redisBreaker: { fire: jest.fn((fn) => fn()) },
  rabbitBreaker: { fire: jest.fn((fn) => fn()) },
  s3Breaker: { fire: jest.fn((fn) => fn()) },
}));

/* ============================================================
   IMPORT SERVICE
   ============================================================ */

const { default: MediaService } = await import('../../src/services/media.service.js');

/* ============================================================
   TESTS
   ============================================================ */

beforeEach(() => {
  jest.clearAllMocks();

  mockJwtUtil.verifyAccessToken.mockReturnValue({
    sub: '42',
    email: 'user@test.com',
    role: 0,
  });
});


describe('MediaService.getUploadUrl()', () => {
  const input = {
    access_token: 'valid-token',
    filename: 'cover-photo.jpg',
    content_type: 'image/jpeg',
    article_id: '10',
  };

  it('should verify JWT', async () => {
    await MediaService.getUploadUrl(input);
    expect(mockJwtUtil.verifyAccessToken).toHaveBeenCalledWith('valid-token');
  });

  it('should sanitize filename', async () => {
    await MediaService.getUploadUrl({ ...input, filename: 'my file (1).jpg' });
    expect(mockGetPresignedUploadUrl).toHaveBeenCalledWith(
      expect.stringMatching(/my_file__1_.jpg$/),
      'image/jpeg'
    );
  });

  it('should use article_id in S3 key path', async () => {
    await MediaService.getUploadUrl(input);
    expect(mockGetPresignedUploadUrl).toHaveBeenCalledWith(
      expect.stringContaining('articles/10/'),
      'image/jpeg'
    );
  });

  it('should use "general" path when no article_id', async () => {
    await MediaService.getUploadUrl({ ...input, article_id: '' });
    expect(mockGetPresignedUploadUrl).toHaveBeenCalledWith(
      expect.stringContaining('articles/general/'),
      'image/jpeg'
    );
  });

  it('should return success with upload and file URLs', async () => {
    const result = await MediaService.getUploadUrl(input);
    expect(result).toEqual({
      success: true,
      upload_url: 'https://s3.test/upload?presigned=abc',
      file_url: 'https://s3.test/news-media-bucket/articles/general/123-cover.jpg',
      expires_in: 3600,
    });
  });

  it('should throw when JWT is invalid', async () => {
    mockJwtUtil.verifyAccessToken.mockImplementation(() => {
      throw new Error('jwt expired');
    });
    await expect(MediaService.getUploadUrl(input)).rejects.toThrow('jwt expired');
  });
});
