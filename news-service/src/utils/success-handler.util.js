import logger from './logger.util.js';

export default class SuccessHandler {
  static ok(callback, data, meta = {}) {
    const { method = 'unknown', ...extra } = meta;
    logger.info('Request completed successfully', { method, ...extra });
    callback(null, data);
  }

  static articleCreated(callback, data, meta = {}) {
    const { method = 'CreateArticle', articleId, ...extra } = meta;
    logger.info('Article created', { method, articleId, ...extra });
    callback(null, data);
  }

  static articleDeleted(callback, data, meta = {}) {
    const { method = 'DeleteArticle', articleId, ...extra } = meta;
    logger.info('Article deleted', { method, articleId, ...extra });
    callback(null, data);
  }

  static articleFetched(callback, data, meta = {}) {
    const { method = 'GetArticle', articleId, ...extra } = meta;
    logger.info('Article fetched', { method, articleId, ...extra });
    callback(null, data);
  }

  static articlesListed(callback, data, meta = {}) {
    const { method = 'ListArticles', count, ...extra } = meta;
    logger.info('Articles listed', { method, count, ...extra });
    callback(null, data);
  }

  static uploadUrlGenerated(callback, data, meta = {}) {
    const { method = 'GetUploadUrl', ...extra } = meta;
    logger.info('Upload URL generated', { method, ...extra });
    callback(null, data);
  }
}
