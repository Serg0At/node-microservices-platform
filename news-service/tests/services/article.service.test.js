import { jest } from '@jest/globals';

/* ============================================================
   MODULE-LEVEL MOCKS — must be defined BEFORE service import
   ============================================================ */

// ── Database ─────────────────────────────────────────────────
const mockDb = jest.fn((cb) => cb('trx'));
mockDb.fn = { now: jest.fn(() => 'NOW()') };
mockDb.transaction = jest.fn((cb) => cb('trx'));
mockDb.raw = jest.fn();

jest.unstable_mockModule('../../src/config/db.js', () => ({
  default: mockDb,
}));

// ── Article Model ────────────────────────────────────────────
const mockArticleModel = {
  findById: jest.fn(),
  findBySlug: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  list: jest.fn(),
  search: jest.fn(),
};

jest.unstable_mockModule('../../src/models/Article.js', () => ({
  default: mockArticleModel,
}));

// ── Category Model ───────────────────────────────────────────
const mockCategoryModel = {
  findById: jest.fn(),
};

jest.unstable_mockModule('../../src/models/Category.js', () => ({
  default: mockCategoryModel,
}));

// ── JWT ──────────────────────────────────────────────────────
const mockJwtUtil = {
  verifyAccessToken: jest.fn(() => ({
    sub: '42',
    email: 'author@test.com',
    role: 0,
  })),
};

jest.unstable_mockModule('../../src/utils/jwt.util.js', () => ({
  default: mockJwtUtil,
}));

// ── Slug ─────────────────────────────────────────────────────
const mockGenerateUniqueSlug = jest.fn((title) =>
  title.toLowerCase().replace(/\s+/g, '-')
);

jest.unstable_mockModule('../../src/utils/slug.util.js', () => ({
  generateUniqueSlug: mockGenerateUniqueSlug,
}));

// ── Redis Ops ────────────────────────────────────────────────
const mockRedisOps = {
  cacheArticle: jest.fn(),
  getCachedArticle: jest.fn(),
  invalidateArticle: jest.fn(),
  cacheLatestList: jest.fn(),
  getCachedLatestList: jest.fn(),
  cacheSearch: jest.fn(),
  getCachedSearch: jest.fn(),
  invalidateListCaches: jest.fn(),
};

jest.unstable_mockModule('../../src/redis/redisOps.js', () => ({
  redisOps: mockRedisOps,
}));

// ── RabbitMQ Publisher ───────────────────────────────────────
const mockPublishNewsEvent = jest.fn();

jest.unstable_mockModule('../../src/rabbit/publisher.js', () => ({
  publishNewsEvent: mockPublishNewsEvent,
}));

// ── Config ───────────────────────────────────────────────────
jest.unstable_mockModule('../../src/config/variables.config.js', () => ({
  default: {
    PAGINATION: { DEFAULT_PAGE: 1, DEFAULT_LIMIT: 10, MAX_LIMIT: 50 },
    RABBITMQ: {
      ROUTING_KEYS: {
        ARTICLE_CREATED: 'article.created',
        ARTICLE_UPDATED: 'article.updated',
        ARTICLE_PUBLISHED: 'article.published',
        ARTICLE_DELETED: 'article.deleted',
      },
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
   IMPORT SERVICE (after all mocks are registered)
   ============================================================ */

const { default: ArticleService } = await import('../../src/services/article.service.js');

/* ============================================================
   TEST DATA
   ============================================================ */

const mockArticleRow = {
  id: 1,
  title: 'Test Article',
  slug: 'test-article',
  content: 'Article body text',
  author_id: 42,
  category_id: 5,
  status: 0,
  tags: '["news","tech"]',
  cover_image_url: 'https://img.test/cover.jpg',
  published_at: null,
  created_at: new Date('2026-01-01'),
  updated_at: new Date('2026-01-01'),
  category_name: 'Technology',
};

const mockPublishedRow = {
  ...mockArticleRow,
  status: 1,
  published_at: new Date('2026-01-15'),
};

/* ============================================================
   TESTS
   ============================================================ */

beforeEach(() => {
  jest.clearAllMocks();

  mockJwtUtil.verifyAccessToken.mockReturnValue({
    sub: '42',
    email: 'author@test.com',
    role: 0,
  });
});


/* ─── CREATE ──────────────────────────────────────────────── */

describe('ArticleService.create()', () => {
  const input = {
    access_token: 'valid-token',
    title: 'Test Article',
    content: 'Article body text',
    category_id: 5,
    tags: ['news', 'tech'],
    cover_image_url: 'https://img.test/cover.jpg',
    status: 0,
  };

  beforeEach(() => {
    mockCategoryModel.findById.mockResolvedValue({ id: 5, name: 'Technology' });
    mockArticleModel.create.mockResolvedValue(mockArticleRow);
  });

  it('should verify JWT and extract author_id', async () => {
    await ArticleService.create(input);
    expect(mockJwtUtil.verifyAccessToken).toHaveBeenCalledWith('valid-token');
  });

  it('should validate category exists', async () => {
    await ArticleService.create(input);
    expect(mockCategoryModel.findById).toHaveBeenCalledWith(5);
  });

  it('should throw ResourceNotFoundError when category not found', async () => {
    mockCategoryModel.findById.mockResolvedValue(null);
    await expect(ArticleService.create(input)).rejects.toMatchObject({
      name: 'ResourceNotFoundError',
      message: 'Category not found',
    });
  });

  it('should generate a unique slug from title', async () => {
    await ArticleService.create(input);
    expect(mockGenerateUniqueSlug).toHaveBeenCalledWith('Test Article');
  });

  it('should insert article into DB with correct data', async () => {
    await ArticleService.create(input);
    expect(mockArticleModel.create).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Test Article',
        slug: 'test-article',
        content: 'Article body text',
        author_id: '42',
        category_id: 5,
        status: 0,
        tags: '["news","tech"]',
        cover_image_url: 'https://img.test/cover.jpg',
        published_at: null,
      })
    );
  });

  it('should set published_at when status is 1', async () => {
    mockArticleModel.create.mockResolvedValue(mockPublishedRow);
    await ArticleService.create({ ...input, status: 1 });
    expect(mockArticleModel.create).toHaveBeenCalledWith(
      expect.objectContaining({
        published_at: expect.any(Date),
      })
    );
  });

  it('should invalidate list caches after creation', async () => {
    await ArticleService.create(input);
    expect(mockRedisOps.invalidateListCaches).toHaveBeenCalled();
  });

  it('should publish article.created event', async () => {
    await ArticleService.create(input);
    expect(mockPublishNewsEvent).toHaveBeenCalledWith(
      'article.created',
      expect.objectContaining({
        article_id: '1',
        title: 'Test Article',
        slug: 'test-article',
        author_id: '42',
        status: 0,
      })
    );
  });

  it('should return formatted article', async () => {
    const result = await ArticleService.create(input);
    expect(result).toEqual(
      expect.objectContaining({
        id: '1',
        title: 'Test Article',
        slug: 'test-article',
        tags: ['news', 'tech'],
        category_name: 'Technology',
      })
    );
  });

  it('should skip category validation when category_id is not provided', async () => {
    await ArticleService.create({ ...input, category_id: null });
    expect(mockCategoryModel.findById).not.toHaveBeenCalled();
  });
});


/* ─── UPDATE ──────────────────────────────────────────────── */

describe('ArticleService.update()', () => {
  const input = {
    access_token: 'valid-token',
    id: '1',
    title: 'Updated Title',
  };

  beforeEach(() => {
    mockArticleModel.findById.mockResolvedValue(mockArticleRow);
    mockArticleModel.update.mockResolvedValue({ ...mockArticleRow, title: 'Updated Title', slug: 'updated-title' });
  });

  it('should verify JWT', async () => {
    await ArticleService.update(input);
    expect(mockJwtUtil.verifyAccessToken).toHaveBeenCalledWith('valid-token');
  });

  it('should throw ResourceNotFoundError if article not found', async () => {
    mockArticleModel.findById.mockResolvedValue(null);
    await expect(ArticleService.update(input)).rejects.toMatchObject({
      name: 'ResourceNotFoundError',
      message: 'Article not found',
    });
  });

  it('should throw Forbidden if user is not the author and not admin', async () => {
    mockJwtUtil.verifyAccessToken.mockReturnValue({ sub: '999', role: 0 });
    await expect(ArticleService.update(input)).rejects.toMatchObject({
      name: 'Forbidden',
      message: 'You can only edit your own articles',
    });
  });

  it('should allow admin to update any article', async () => {
    mockJwtUtil.verifyAccessToken.mockReturnValue({ sub: '999', role: 1 });
    const result = await ArticleService.update(input);
    expect(result.title).toBe('Updated Title');
  });

  it('should regenerate slug when title changes', async () => {
    await ArticleService.update(input);
    expect(mockGenerateUniqueSlug).toHaveBeenCalledWith('Updated Title');
  });

  it('should set published_at when status transitions to 1', async () => {
    mockArticleModel.update.mockResolvedValue(mockPublishedRow);
    await ArticleService.update({ ...input, status: 1 });
    expect(mockArticleModel.update).toHaveBeenCalledWith(
      '1',
      expect.objectContaining({ published_at: expect.any(Date) })
    );
  });

  it('should publish article.published when status changes to 1', async () => {
    mockArticleModel.update.mockResolvedValue(mockPublishedRow);
    await ArticleService.update({ ...input, status: 1 });
    expect(mockPublishNewsEvent).toHaveBeenCalledWith(
      'article.published',
      expect.objectContaining({ article_id: '1' })
    );
  });

  it('should invalidate article and list caches', async () => {
    await ArticleService.update(input);
    expect(mockRedisOps.invalidateArticle).toHaveBeenCalledWith('1');
    expect(mockRedisOps.invalidateListCaches).toHaveBeenCalled();
  });

  it('should return existing article when no changes provided', async () => {
    const result = await ArticleService.update({
      access_token: 'valid-token',
      id: '1',
    });
    expect(mockArticleModel.update).not.toHaveBeenCalled();
    expect(result.id).toBe('1');
  });
});


/* ─── DELETE ──────────────────────────────────────────────── */

describe('ArticleService.delete()', () => {
  const input = { access_token: 'valid-token', id: '1' };

  beforeEach(() => {
    mockArticleModel.findById.mockResolvedValue(mockArticleRow);
    mockArticleModel.delete.mockResolvedValue(1);
  });

  it('should verify JWT', async () => {
    await ArticleService.delete(input);
    expect(mockJwtUtil.verifyAccessToken).toHaveBeenCalledWith('valid-token');
  });

  it('should throw ResourceNotFoundError if article not found', async () => {
    mockArticleModel.findById.mockResolvedValue(null);
    await expect(ArticleService.delete(input)).rejects.toMatchObject({
      name: 'ResourceNotFoundError',
    });
  });

  it('should throw Forbidden if not author and not admin', async () => {
    mockJwtUtil.verifyAccessToken.mockReturnValue({ sub: '999', role: 0 });
    await expect(ArticleService.delete(input)).rejects.toMatchObject({
      name: 'Forbidden',
    });
  });

  it('should delete article from DB', async () => {
    await ArticleService.delete(input);
    expect(mockArticleModel.delete).toHaveBeenCalledWith('1');
  });

  it('should invalidate caches', async () => {
    await ArticleService.delete(input);
    expect(mockRedisOps.invalidateArticle).toHaveBeenCalledWith('1');
    expect(mockRedisOps.invalidateListCaches).toHaveBeenCalled();
  });

  it('should publish article.deleted event', async () => {
    await ArticleService.delete(input);
    expect(mockPublishNewsEvent).toHaveBeenCalledWith(
      'article.deleted',
      expect.objectContaining({ article_id: '1' })
    );
  });

  it('should return success response', async () => {
    const result = await ArticleService.delete(input);
    expect(result).toEqual({ success: true, message: 'Article deleted' });
  });
});


/* ─── GET ─────────────────────────────────────────────────── */

describe('ArticleService.get()', () => {
  it('should return cached article if available', async () => {
    const cached = { id: '1', title: 'Cached Article', slug: 'cached' };
    mockRedisOps.getCachedArticle.mockResolvedValue(cached);

    const result = await ArticleService.get({ id: '1' });
    expect(result).toEqual(cached);
    expect(mockArticleModel.findById).not.toHaveBeenCalled();
  });

  it('should fetch from DB and cache on miss', async () => {
    mockRedisOps.getCachedArticle.mockResolvedValue(null);
    mockArticleModel.findById.mockResolvedValue(mockArticleRow);

    const result = await ArticleService.get({ id: '1' });
    expect(result.id).toBe('1');
    expect(mockRedisOps.cacheArticle).toHaveBeenCalledWith(1, expect.any(Object));
  });

  it('should fetch by slug when id not provided', async () => {
    mockArticleModel.findBySlug.mockResolvedValue(mockArticleRow);

    const result = await ArticleService.get({ slug: 'test-article' });
    expect(result.slug).toBe('test-article');
    expect(mockArticleModel.findBySlug).toHaveBeenCalledWith('test-article');
  });

  it('should throw ResourceNotFoundError when article not found', async () => {
    mockRedisOps.getCachedArticle.mockResolvedValue(null);
    mockArticleModel.findById.mockResolvedValue(null);

    await expect(ArticleService.get({ id: '999' })).rejects.toMatchObject({
      name: 'ResourceNotFoundError',
      message: 'Article not found',
    });
  });
});


/* ─── LIST ────────────────────────────────────────────────── */

describe('ArticleService.list()', () => {
  beforeEach(() => {
    mockArticleModel.list.mockResolvedValue({
      articles: [mockPublishedRow, { ...mockPublishedRow, id: 2, title: 'Second' }],
      total: 2,
    });
  });

  it('should use default pagination values', async () => {
    await ArticleService.list({});
    expect(mockArticleModel.list).toHaveBeenCalledWith(
      expect.objectContaining({ page: 1, limit: 10 })
    );
  });

  it('should cap limit at MAX_LIMIT', async () => {
    await ArticleService.list({ limit: 100 });
    expect(mockArticleModel.list).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 50 })
    );
  });

  it('should default status to published (1)', async () => {
    await ArticleService.list({});
    expect(mockArticleModel.list).toHaveBeenCalledWith(
      expect.objectContaining({ status: 1 })
    );
  });

  it('should return articles with pagination metadata', async () => {
    const result = await ArticleService.list({});
    expect(result.articles).toHaveLength(2);
    expect(result.pagination).toEqual({
      page: 1,
      limit: 10,
      total: 2,
      total_pages: 1,
    });
  });

  it('should pass filters to model', async () => {
    await ArticleService.list({ category_id: 5, author_id: '42' });
    expect(mockArticleModel.list).toHaveBeenCalledWith(
      expect.objectContaining({ category_id: 5, author_id: '42' })
    );
  });
});


/* ─── SEARCH ──────────────────────────────────────────────── */

describe('ArticleService.search()', () => {
  const searchInput = { query: 'technology', page: 1, limit: 10 };

  it('should return cached results if available', async () => {
    const cached = { articles: [], pagination: { page: 1, limit: 10, total: 0, total_pages: 0 } };
    mockRedisOps.getCachedSearch.mockResolvedValue(cached);

    const result = await ArticleService.search(searchInput);
    expect(result).toEqual(cached);
    expect(mockArticleModel.search).not.toHaveBeenCalled();
  });

  it('should search DB and cache results on miss', async () => {
    mockRedisOps.getCachedSearch.mockResolvedValue(null);
    mockArticleModel.search.mockResolvedValue({
      articles: [mockPublishedRow],
      total: 1,
    });

    const result = await ArticleService.search(searchInput);
    expect(result.articles).toHaveLength(1);
    expect(mockRedisOps.cacheSearch).toHaveBeenCalledWith(
      'technology', 1, 10, expect.any(Object)
    );
  });

  it('should pass category_id filter to search', async () => {
    mockRedisOps.getCachedSearch.mockResolvedValue(null);
    mockArticleModel.search.mockResolvedValue({ articles: [], total: 0 });

    await ArticleService.search({ ...searchInput, category_id: 3 });
    expect(mockArticleModel.search).toHaveBeenCalledWith(
      expect.objectContaining({ category_id: 3 })
    );
  });

  it('should calculate total_pages correctly', async () => {
    mockRedisOps.getCachedSearch.mockResolvedValue(null);
    mockArticleModel.search.mockResolvedValue({
      articles: Array(10).fill(mockPublishedRow),
      total: 25,
    });

    const result = await ArticleService.search(searchInput);
    expect(result.pagination.total_pages).toBe(3);
  });
});
