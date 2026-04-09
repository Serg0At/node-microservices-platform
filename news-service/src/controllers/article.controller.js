import ArticleService from '../services/article.service.js';
import MediaService from '../services/media.service.js';
import { SuccessHandler, ErrorHandler } from '../utils/index.js';
import { Validation } from '../middlewares/validations/index.js';

export default class ArticleController {
  static async createArticle(call, callback) {
    const meta = { method: 'CreateArticle' };
    try {
      const { access_token, title, content, type, cover_image_url, categories } = call.request;

      const { error: validationError } = Validation.validateCreateArticle({
        access_token, title, content, type, cover_image_url, categories,
      });
      if (validationError) {
        return ErrorHandler.invalidArgument(callback, validationError.details.map(d => d.message).join('; '), meta);
      }

      const article = await ArticleService.create({ access_token, title, content, type, cover_image_url, categories });

      SuccessHandler.articleCreated(callback, { success: true, article }, { ...meta, articleId: article.id });
    } catch (error) {
      ErrorHandler.handle(callback, error, meta);
    }
  }

  static async deleteArticle(call, callback) {
    const meta = { method: 'DeleteArticle' };
    try {
      const { access_token, id } = call.request;

      const { error: validationError } = Validation.validateDeleteArticle({ access_token, id });
      if (validationError) {
        return ErrorHandler.invalidArgument(callback, validationError.details.map(d => d.message).join('; '), meta);
      }

      const result = await ArticleService.delete({ access_token, id });

      SuccessHandler.articleDeleted(callback, result, { ...meta, articleId: id });
    } catch (error) {
      ErrorHandler.handle(callback, error, meta);
    }
  }

  static async getArticle(call, callback) {
    const meta = { method: 'GetArticle' };
    try {
      const { id, slug } = call.request;

      const { error: validationError } = Validation.validateGetArticle({ id, slug });
      if (validationError) {
        return ErrorHandler.invalidArgument(callback, validationError.details.map(d => d.message).join('; '), meta);
      }

      const article = await ArticleService.get({ id, slug });

      SuccessHandler.articleFetched(callback, { success: true, article }, { ...meta, articleId: article.id });
    } catch (error) {
      ErrorHandler.handle(callback, error, meta);
    }
  }

  static async listArticles(call, callback) {
    const meta = { method: 'ListArticles' };
    try {
      const { page, limit, category, author_id } = call.request;

      const { error: validationError } = Validation.validateListArticles({ page, limit, category, author_id });
      if (validationError) {
        return ErrorHandler.invalidArgument(callback, validationError.details.map(d => d.message).join('; '), meta);
      }

      const result = await ArticleService.list({ page, limit, category, author_id });

      SuccessHandler.articlesListed(callback, { success: true, ...result }, { ...meta, count: result.articles.length });
    } catch (error) {
      ErrorHandler.handle(callback, error, meta);
    }
  }

  static async searchArticles(call, callback) {
    const meta = { method: 'SearchArticles' };
    try {
      const { query, page, limit, category, author_id } = call.request;

      const { error: validationError } = Validation.validateSearchArticles({ query, page, limit, category, author_id });
      if (validationError) {
        return ErrorHandler.invalidArgument(callback, validationError.details.map(d => d.message).join('; '), meta);
      }

      const result = await ArticleService.search({ query, page, limit, category, author_id });

      SuccessHandler.articlesListed(callback, { success: true, ...result }, { ...meta, count: result.articles.length });
    } catch (error) {
      ErrorHandler.handle(callback, error, meta);
    }
  }

  static async getUploadUrl(call, callback) {
    const meta = { method: 'GetUploadUrl' };
    try {
      const { access_token, filename, content_type, article_id } = call.request;

      const { error: validationError } = Validation.validateGetUploadUrl({ access_token, filename, content_type, article_id });
      if (validationError) {
        return ErrorHandler.invalidArgument(callback, validationError.details.map(d => d.message).join('; '), meta);
      }

      const result = await MediaService.getUploadUrl({ access_token, filename, content_type, article_id });

      SuccessHandler.uploadUrlGenerated(callback, result, meta);
    } catch (error) {
      ErrorHandler.handle(callback, error, meta);
    }
  }

  static async getArticleStats(call, callback) {
    const meta = { method: 'GetArticleStats' };
    try {
      const { access_token } = call.request;

      const { error: validationError } = Validation.validateGetArticleStats({ access_token });
      if (validationError) {
        return ErrorHandler.invalidArgument(callback, validationError.details.map(d => d.message).join('; '), meta);
      }

      const result = await ArticleService.getStats({ access_token });

      SuccessHandler.ok(callback, result, meta);
    } catch (error) {
      ErrorHandler.handle(callback, error, meta);
    }
  }
}
