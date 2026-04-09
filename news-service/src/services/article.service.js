import ArticleModel from '../models/Article.js';
import { JwtUtil, generateUniqueSlug } from '../utils/index.js';
import { redisOps } from '../redis/redisOps.js';
import { publishNewsEvent } from '../rabbit/publisher.js';
import config from '../config/variables.config.js';
import ErrorHandler from '../utils/error-handler.util.js';
import logger from '../utils/logger.util.js';

const { errors } = ErrorHandler;

export default class ArticleService {
  static async create({ access_token, title, content, type, cover_image_url, categories }) {
    const decoded = JwtUtil.verifyAccessToken(access_token);
    if (decoded.role !== 1) throw new errors.Forbidden('Admin access required');

    const authorId = decoded.id;
    const slug = await generateUniqueSlug(title);

    const article = await ArticleModel.create({
      title,
      slug,
      content: content || null,
      author_id: authorId,
      type: type || 'news',
      categories: categories && categories.length > 0 ? categories : [],
      cover_image_url: cover_image_url || null,
      published_at: new Date(),
    });

    await redisOps.invalidateListCaches();

    publishNewsEvent(config.RABBITMQ.ROUTING_KEYS.ARTICLE_CREATED, {
      article_id: article.id.toString(),
      title: article.title,
      slug: article.slug,
      author_id: authorId,
      type: article.type,
      ts: Date.now(),
    });

    logger.info('AUDIT: Article created', {
      action: 'article.created',
      admin_id: authorId,
      article_id: article.id.toString(),
      title: article.title,
      type: article.type,
    });

    return ArticleService._formatArticle(article);
  }

  static async delete({ access_token, id }) {
    const decoded = JwtUtil.verifyAccessToken(access_token);
    if (decoded.role !== 1) throw new errors.Forbidden('Admin access required');

    const existing = await ArticleModel.findById(id);
    if (!existing) throw new errors.ResourceNotFoundError('Article not found');

    await ArticleModel.delete(id);

    await redisOps.invalidateArticle(id);
    await redisOps.invalidateListCaches();

    publishNewsEvent(config.RABBITMQ.ROUTING_KEYS.ARTICLE_DELETED, {
      article_id: id.toString(),
      ts: Date.now(),
    });

    logger.info('AUDIT: Article deleted', {
      action: 'article.deleted',
      admin_id: decoded.id,
      article_id: id.toString(),
      title: existing.title,
    });

    return { success: true, message: 'Article deleted' };
  }

  static async get({ id, slug }) {
    if (id) {
      const cached = await redisOps.getCachedArticle(id);
      if (cached) {
        ArticleModel.incrementViewCount(id).catch(() => {});
        return cached;
      }
    }

    const article = id
      ? await ArticleModel.findById(id)
      : await ArticleModel.findBySlug(slug);

    if (!article) throw new errors.ResourceNotFoundError('Article not found');

    ArticleModel.incrementViewCount(article.id).catch(() => {});

    const formatted = ArticleService._formatArticle(article);
    await redisOps.cacheArticle(article.id, formatted);

    return formatted;
  }

  static async list({ page, limit, category, author_id }) {
    page = page || config.PAGINATION.DEFAULT_PAGE;
    limit = Math.min(limit || config.PAGINATION.DEFAULT_LIMIT, config.PAGINATION.MAX_LIMIT);

    const { articles, total } = await ArticleModel.list({ page, limit, category, author_id });

    const totalPages = Math.ceil(total / limit);

    return {
      articles: articles.map(ArticleService._formatSummary),
      pagination: { page, limit, total, total_pages: totalPages },
    };
  }

  static async search({ query, page, limit, category, author_id }) {
    page = page || config.PAGINATION.DEFAULT_PAGE;
    limit = Math.min(limit || config.PAGINATION.DEFAULT_LIMIT, config.PAGINATION.MAX_LIMIT);

    const cacheKey = [query, page, limit, category || '', author_id || ''].join(':');
    const cached = await redisOps.getCachedSearch(cacheKey, page, limit);
    if (cached) return cached;

    const { articles, total } = await ArticleModel.search({ query, page, limit, category, author_id });
    const totalPages = Math.ceil(total / limit);

    const result = {
      articles: articles.map(ArticleService._formatSummary),
      pagination: { page, limit, total, total_pages: totalPages },
    };

    await redisOps.cacheSearch(cacheKey, page, limit, result);
    return result;
  }

  static async getStats({ access_token }) {
    const decoded = JwtUtil.verifyAccessToken(access_token);
    if (decoded.role !== 1) throw new errors.Forbidden('Admin access required');

    const stats = await ArticleModel.getStats();

    return {
      success: true,
      total_articles: stats.total_articles,
      total_blog: stats.total_blog,
      total_news: stats.total_news,
      total_views: parseInt(stats.total_views, 10),
    };
  }

  static _formatArticle(row) {
    return {
      id: row.id.toString(),
      title: row.title,
      slug: row.slug,
      content: row.content || '',
      author_id: row.author_id.toString(),
      type: row.type || 'news',
      categories: row.categories || [],
      cover_image_url: row.cover_image_url || '',
      view_count: parseInt(row.view_count || 0, 10),
      published_at: row.published_at ? row.published_at.toISOString() : '',
      created_at: row.created_at ? row.created_at.toISOString() : '',
      updated_at: row.updated_at ? row.updated_at.toISOString() : '',
    };
  }

  static _formatSummary(row) {
    return {
      id: row.id.toString(),
      title: row.title,
      slug: row.slug,
      author_id: row.author_id.toString(),
      type: row.type || 'news',
      categories: row.categories || [],
      cover_image_url: row.cover_image_url || '',
      view_count: parseInt(row.view_count || 0, 10),
      published_at: row.published_at ? row.published_at.toISOString() : '',
      created_at: row.created_at ? row.created_at.toISOString() : '',
    };
  }
}
