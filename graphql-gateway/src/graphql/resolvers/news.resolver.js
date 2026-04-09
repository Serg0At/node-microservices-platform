import { GraphQLError } from 'graphql';
import { Validation } from '../../middlewares/validations/index.js';
import * as newsGrpc from '../../grpc/clients/news-client.js';
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

function mapArticle(a) {
  if (!a) return null;
  return {
    id: a.id,
    title: a.title,
    slug: a.slug,
    content: a.content,
    authorId: a.author_id,
    categoryId: a.category_id,
    status: a.status,
    tags: a.tags || [],
    coverImageUrl: a.cover_image_url,
    publishedAt: a.published_at,
    createdAt: a.created_at,
    updatedAt: a.updated_at,
    categoryName: a.category_name,
  };
}

function mapArticleSummary(a) {
  if (!a) return null;
  return {
    id: a.id,
    title: a.title,
    slug: a.slug,
    authorId: a.author_id,
    categoryId: a.category_id,
    status: a.status,
    tags: a.tags || [],
    coverImageUrl: a.cover_image_url,
    publishedAt: a.published_at,
    createdAt: a.created_at,
    categoryName: a.category_name,
  };
}

function mapCategory(c) {
  if (!c) return null;
  return {
    id: c.id,
    name: c.name,
    slug: c.slug,
    description: c.description,
    parentId: c.parent_id || null,
    createdAt: c.created_at,
    updatedAt: c.updated_at,
  };
}

function mapPagination(p) {
  if (!p) return null;
  return {
    page: p.page,
    limit: p.limit,
    total: p.total,
    totalPages: p.total_pages,
  };
}

export const newsResolvers = {
  Query: {
    async article(_, { id, slug }, { userAgent }) {
      validate(Validation.validateGetArticle, { id, slug });
      const res = await newsGrpc.getArticle({ id: id || '', slug: slug || '' }, userAgent);
      return { success: res.success, article: mapArticle(res.article) };
    },

    async articles(_, { page, limit, categoryId, status, sortBy, sortOrder, authorId }, { userAgent }) {
      validate(Validation.validateListArticles, { page, limit, categoryId, status, sortBy, sortOrder, authorId });
      const res = await newsGrpc.listArticles(
        {
          page: page || 1,
          limit: limit || 10,
          category_id: categoryId || 0,
          status: status ?? -1,
          sort_by: sortBy || 'published_at',
          sort_order: sortOrder || 'desc',
          author_id: authorId || '',
        },
        userAgent,
      );
      return {
        success: res.success,
        articles: (res.articles || []).map(mapArticleSummary),
        pagination: mapPagination(res.pagination),
      };
    },

    async searchArticles(_, { query, page, limit, categoryId }, { userAgent }) {
      validate(Validation.validateSearchArticles, { query, page, limit, categoryId });
      const res = await newsGrpc.searchArticles(
        { query, page: page || 1, limit: limit || 10, category_id: categoryId || 0 },
        userAgent,
      );
      return {
        success: res.success,
        articles: (res.articles || []).map(mapArticleSummary),
        pagination: mapPagination(res.pagination),
      };
    },

    async categories(_, { parentId }, { userAgent }) {
      const res = await newsGrpc.listCategories({ parent_id: parentId || 0 }, userAgent);
      return {
        success: res.success,
        categories: (res.categories || []).map(mapCategory),
      };
    },
  },

  Mutation: {
    async createArticle(_, { title, content, categoryId, tags, coverImageUrl, status }, { token, userAgent }) {
      validate(Validation.validateCreateArticle, { title, content, categoryId, tags, coverImageUrl, status });
      const res = await newsGrpc.createArticle(
        {
          access_token: token,
          title,
          content,
          category_id: categoryId,
          tags: tags || [],
          cover_image_url: coverImageUrl || '',
          status: status ?? 0,
        },
        userAgent,
      );
      return { success: res.success, article: mapArticle(res.article) };
    },

    async updateArticle(_, { id, title, content, categoryId, tags, coverImageUrl, status }, { token, userAgent }) {
      validate(Validation.validateUpdateArticle, { id, title, content, categoryId, tags, coverImageUrl, status });
      const res = await newsGrpc.updateArticle(
        {
          access_token: token,
          id,
          title: title || '',
          content: content || '',
          category_id: categoryId || 0,
          tags: tags || [],
          cover_image_url: coverImageUrl || '',
          status: status ?? -1,
        },
        userAgent,
      );
      return { success: res.success, article: mapArticle(res.article) };
    },

    async deleteArticle(_, { id }, { token, userAgent }) {
      validate(Validation.validateDeleteArticle, { id });
      const res = await newsGrpc.deleteArticle({ access_token: token, id }, userAgent);
      return { success: res.success, message: res.message };
    },

    async createCategory(_, { name, description, parentId }, { token, userAgent, user, ip }) {
      validate(Validation.validateCreateCategory, { name, description, parentId });
      const res = await newsGrpc.createCategory(
        { access_token: token, name, description: description || '', parent_id: parentId || 0 },
        userAgent,
      );
      audit('category.create', {
        user, ip, userAgent, resourceType: 'category',
        resourceId: res.category?.id, resourceTitle: name,
      });
      return { success: res.success, category: mapCategory(res.category) };
    },

    async updateCategory(_, { id, name, description, parentId }, { token, userAgent, user, ip }) {
      validate(Validation.validateUpdateCategory, { id, name, description, parentId });
      const res = await newsGrpc.updateCategory(
        { access_token: token, id, name: name || '', description: description || '', parent_id: parentId || 0 },
        userAgent,
      );
      audit('category.update', {
        user, ip, userAgent, resourceType: 'category',
        resourceId: id, resourceTitle: name,
      });
      return { success: res.success, category: mapCategory(res.category) };
    },

    async deleteCategory(_, { id }, { token, userAgent, user, ip }) {
      validate(Validation.validateDeleteCategory, { id });
      const res = await newsGrpc.deleteCategory({ access_token: token, id }, userAgent);
      audit('category.delete', {
        user, ip, userAgent, resourceType: 'category', resourceId: id,
      });
      return { success: res.success, message: res.message };
    },

    async getUploadUrl(_, { filename, contentType, articleId }, { token, userAgent }) {
      validate(Validation.validateGetUploadUrl, { filename, contentType, articleId });
      const res = await newsGrpc.getUploadUrl(
        { access_token: token, filename, content_type: contentType, article_id: articleId || '' },
        userAgent,
      );
      return {
        success: res.success,
        uploadUrl: res.upload_url,
        fileUrl: res.file_url,
        expiresIn: res.expires_in,
      };
    },
  },
};
