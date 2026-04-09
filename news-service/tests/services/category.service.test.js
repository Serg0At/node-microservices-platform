import { jest } from '@jest/globals';

/* ============================================================
   MODULE-LEVEL MOCKS
   ============================================================ */

// ── Database ─────────────────────────────────────────────────
const mockDb = jest.fn((cb) => cb('trx'));
mockDb.fn = { now: jest.fn(() => 'NOW()') };
mockDb.transaction = jest.fn((cb) => cb('trx'));

jest.unstable_mockModule('../../src/config/db.js', () => ({
  default: mockDb,
}));

// ── Category Model ───────────────────────────────────────────
const mockCategoryModel = {
  findById: jest.fn(),
  findByName: jest.fn(),
  findBySlug: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  list: jest.fn(),
  hasArticles: jest.fn(),
};

jest.unstable_mockModule('../../src/models/Category.js', () => ({
  default: mockCategoryModel,
}));

// ── JWT ──────────────────────────────────────────────────────
const mockJwtUtil = {
  verifyAccessToken: jest.fn(() => ({
    sub: '1',
    email: 'admin@test.com',
    role: 1,
  })),
};

jest.unstable_mockModule('../../src/utils/jwt.util.js', () => ({
  default: mockJwtUtil,
}));

// ── Config ───────────────────────────────────────────────────
jest.unstable_mockModule('../../src/config/variables.config.js', () => ({
  default: {
    PAGINATION: { DEFAULT_PAGE: 1, DEFAULT_LIMIT: 10, MAX_LIMIT: 50 },
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

const { default: CategoryService } = await import('../../src/services/category.service.js');

/* ============================================================
   TEST DATA
   ============================================================ */

const mockCategoryRow = {
  id: 1,
  name: 'Technology',
  slug: 'technology',
  description: 'Tech news and articles',
  parent_id: null,
  created_at: new Date('2026-01-01'),
  updated_at: new Date('2026-01-01'),
};

/* ============================================================
   TESTS
   ============================================================ */

beforeEach(() => {
  jest.clearAllMocks();

  mockJwtUtil.verifyAccessToken.mockReturnValue({
    sub: '1',
    email: 'admin@test.com',
    role: 1,
  });
});


/* ─── CREATE ──────────────────────────────────────────────── */

describe('CategoryService.create()', () => {
  const input = {
    access_token: 'admin-token',
    name: 'Technology',
    description: 'Tech news and articles',
  };

  beforeEach(() => {
    mockCategoryModel.findByName.mockResolvedValue(null);
    mockCategoryModel.create.mockResolvedValue(mockCategoryRow);
  });

  it('should verify JWT', async () => {
    await CategoryService.create(input);
    expect(mockJwtUtil.verifyAccessToken).toHaveBeenCalledWith('admin-token');
  });

  it('should throw Forbidden for non-admin users', async () => {
    mockJwtUtil.verifyAccessToken.mockReturnValue({ sub: '2', role: 0 });
    await expect(CategoryService.create(input)).rejects.toMatchObject({
      name: 'Forbidden',
      message: 'Admin access required',
    });
  });

  it('should throw ConflictError if category name exists', async () => {
    mockCategoryModel.findByName.mockResolvedValue(mockCategoryRow);
    await expect(CategoryService.create(input)).rejects.toMatchObject({
      name: 'ConflictError',
      message: 'Category with this name already exists',
    });
  });

  it('should validate parent category exists when parent_id provided', async () => {
    mockCategoryModel.findById.mockResolvedValue(null);
    await expect(CategoryService.create({ ...input, parent_id: 99 })).rejects.toMatchObject({
      name: 'ResourceNotFoundError',
      message: 'Parent category not found',
    });
  });

  it('should create category with auto-generated slug', async () => {
    await CategoryService.create(input);
    expect(mockCategoryModel.create).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Technology',
        slug: 'technology',
        description: 'Tech news and articles',
        parent_id: null,
      })
    );
  });

  it('should return formatted category', async () => {
    const result = await CategoryService.create(input);
    expect(result).toEqual(
      expect.objectContaining({
        id: 1,
        name: 'Technology',
        slug: 'technology',
        parent_id: 0,
      })
    );
  });
});


/* ─── UPDATE ──────────────────────────────────────────────── */

describe('CategoryService.update()', () => {
  const input = {
    access_token: 'admin-token',
    id: 1,
    name: 'Updated Tech',
  };

  beforeEach(() => {
    mockCategoryModel.findById.mockResolvedValue(mockCategoryRow);
    mockCategoryModel.findByName.mockResolvedValue(null);
    mockCategoryModel.update.mockResolvedValue({
      ...mockCategoryRow,
      name: 'Updated Tech',
      slug: 'updated-tech',
    });
  });

  it('should throw Forbidden for non-admin', async () => {
    mockJwtUtil.verifyAccessToken.mockReturnValue({ sub: '2', role: 0 });
    await expect(CategoryService.update(input)).rejects.toMatchObject({
      name: 'Forbidden',
    });
  });

  it('should throw ResourceNotFoundError if category not found', async () => {
    mockCategoryModel.findById.mockResolvedValue(null);
    await expect(CategoryService.update(input)).rejects.toMatchObject({
      name: 'ResourceNotFoundError',
    });
  });

  it('should throw ConflictError if new name already taken', async () => {
    mockCategoryModel.findByName.mockResolvedValue({ id: 2, name: 'Updated Tech' });
    await expect(CategoryService.update(input)).rejects.toMatchObject({
      name: 'ConflictError',
    });
  });

  it('should prevent self-referencing parent_id', async () => {
    await expect(CategoryService.update({ ...input, parent_id: 1 })).rejects.toMatchObject({
      name: 'InputValidationError',
      message: 'Category cannot be its own parent',
    });
  });

  it('should update category and regenerate slug', async () => {
    await CategoryService.update(input);
    expect(mockCategoryModel.update).toHaveBeenCalledWith(
      1,
      expect.objectContaining({
        name: 'Updated Tech',
        slug: 'updated-tech',
      })
    );
  });

  it('should skip update when no changes provided', async () => {
    const result = await CategoryService.update({
      access_token: 'admin-token',
      id: 1,
    });
    expect(mockCategoryModel.update).not.toHaveBeenCalled();
    expect(result.id).toBe(1);
  });
});


/* ─── DELETE ──────────────────────────────────────────────── */

describe('CategoryService.delete()', () => {
  const input = { access_token: 'admin-token', id: 1 };

  beforeEach(() => {
    mockCategoryModel.findById.mockResolvedValue(mockCategoryRow);
    mockCategoryModel.hasArticles.mockResolvedValue(false);
    mockCategoryModel.delete.mockResolvedValue(1);
  });

  it('should throw Forbidden for non-admin', async () => {
    mockJwtUtil.verifyAccessToken.mockReturnValue({ sub: '2', role: 0 });
    await expect(CategoryService.delete(input)).rejects.toMatchObject({
      name: 'Forbidden',
    });
  });

  it('should throw ResourceNotFoundError if category not found', async () => {
    mockCategoryModel.findById.mockResolvedValue(null);
    await expect(CategoryService.delete(input)).rejects.toMatchObject({
      name: 'ResourceNotFoundError',
    });
  });

  it('should throw PreconditionError when category has articles', async () => {
    mockCategoryModel.hasArticles.mockResolvedValue(true);
    await expect(CategoryService.delete(input)).rejects.toMatchObject({
      name: 'PreconditionError',
    });
  });

  it('should delete category from DB', async () => {
    await CategoryService.delete(input);
    expect(mockCategoryModel.delete).toHaveBeenCalledWith(1);
  });

  it('should return success response', async () => {
    const result = await CategoryService.delete(input);
    expect(result).toEqual({ success: true, message: 'Category deleted' });
  });
});


/* ─── LIST ────────────────────────────────────────────────── */

describe('CategoryService.list()', () => {
  beforeEach(() => {
    mockCategoryModel.list.mockResolvedValue([
      mockCategoryRow,
      { ...mockCategoryRow, id: 2, name: 'Sports', slug: 'sports' },
    ]);
  });

  it('should return all categories', async () => {
    const result = await CategoryService.list({});
    expect(result).toHaveLength(2);
    expect(result[0].name).toBe('Technology');
  });

  it('should pass parent_id filter', async () => {
    await CategoryService.list({ parent_id: 1 });
    expect(mockCategoryModel.list).toHaveBeenCalledWith(1);
  });

  it('should format null parent_id as 0', async () => {
    const result = await CategoryService.list({});
    expect(result[0].parent_id).toBe(0);
  });
});
