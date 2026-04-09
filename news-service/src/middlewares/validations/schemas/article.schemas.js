import Joi from 'joi';

export default class ArticleSchemas {
  constructor() {
    this.CreateArticleScheme = Joi.object({
      access_token: Joi.string().required(),
      title: Joi.string().min(3).max(500).required(),
      content: Joi.string().allow('', null),
      type: Joi.string().valid('blog', 'news').default('news'),
      categories: Joi.array().items(Joi.string().trim().min(1).max(50)).max(10).default([]),
      cover_image_url: Joi.string().uri().allow('', null),
    });

    this.DeleteArticleScheme = Joi.object({
      access_token: Joi.string().required(),
      id: Joi.string().required(),
    });

    this.GetArticleScheme = Joi.object({
      id: Joi.string().allow('', null),
      slug: Joi.string().allow('', null),
    }).or('id', 'slug');

    this.ListArticlesScheme = Joi.object({
      page: Joi.number().integer().min(1).default(1),
      limit: Joi.number().integer().min(1).max(50).default(10),
      category: Joi.string().trim().max(50).allow('', null),
      author_id: Joi.string().allow('', null),
    });

    this.SearchArticlesScheme = Joi.object({
      query: Joi.string().min(1).max(200).required(),
      page: Joi.number().integer().min(1).default(1),
      limit: Joi.number().integer().min(1).max(50).default(10),
      category: Joi.string().trim().max(50).allow('', null),
      author_id: Joi.string().allow('', null),
    });

    this.GetUploadUrlScheme = Joi.object({
      access_token: Joi.string().required(),
      filename: Joi.string().min(1).max(255).required(),
      content_type: Joi.string().valid('image/jpeg', 'image/png', 'image/webp', 'image/gif').required(),
      article_id: Joi.string().allow('', null),
    });

    this.GetArticleStatsScheme = Joi.object({
      access_token: Joi.string().required(),
    });
  }
}
