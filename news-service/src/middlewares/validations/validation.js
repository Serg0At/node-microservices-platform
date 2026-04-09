import { ArticleSchemas } from './schemas/index.js';

const article = new ArticleSchemas();

export default class Validation {
  // ── Articles ────────────────────────────────────
  static validateCreateArticle(data) {
    return article.CreateArticleScheme.validate(data, { abortEarly: false });
  }

  static validateDeleteArticle(data) {
    return article.DeleteArticleScheme.validate(data, { abortEarly: false });
  }

  static validateGetArticle(data) {
    return article.GetArticleScheme.validate(data, { abortEarly: false });
  }

  static validateListArticles(data) {
    return article.ListArticlesScheme.validate(data, { abortEarly: false });
  }

  static validateSearchArticles(data) {
    return article.SearchArticlesScheme.validate(data, { abortEarly: false });
  }

  static validateGetUploadUrl(data) {
    return article.GetUploadUrlScheme.validate(data, { abortEarly: false });
  }

  static validateGetArticleStats(data) {
    return article.GetArticleStatsScheme.validate(data, { abortEarly: false });
  }
}
