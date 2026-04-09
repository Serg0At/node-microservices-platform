import Joi from 'joi';

export default class NewsSchemas {
  CreateArticleScheme = Joi.object({
    title: Joi.string().min(1).max(255).required(),
    content: Joi.string().min(1).required(),
    categoryId: Joi.number().integer().required(),
    tags: Joi.array().items(Joi.string().max(50)).max(10).optional(),
    coverImageUrl: Joi.string().uri().allow('').optional(),
    status: Joi.number().integer().valid(0, 1).optional(),
  });

  UpdateArticleScheme = Joi.object({
    id: Joi.string().required(),
    title: Joi.string().min(1).max(255).optional(),
    content: Joi.string().min(1).optional(),
    categoryId: Joi.number().integer().optional(),
    tags: Joi.array().items(Joi.string().max(50)).max(10).optional(),
    coverImageUrl: Joi.string().uri().allow('').optional(),
    status: Joi.number().integer().valid(0, 1, 2).optional(),
  });

  DeleteArticleScheme = Joi.object({
    id: Joi.string().required(),
  });

  GetArticleScheme = Joi.object({
    id: Joi.string().allow('').optional(),
    slug: Joi.string().allow('').optional(),
  }).or('id', 'slug');

  ListArticlesScheme = Joi.object({
    page: Joi.number().integer().min(1).optional(),
    limit: Joi.number().integer().min(1).max(50).optional(),
    categoryId: Joi.number().integer().optional(),
    status: Joi.number().integer().valid(0, 1, 2).optional(),
    sortBy: Joi.string().valid('published_at', 'created_at').optional(),
    sortOrder: Joi.string().valid('asc', 'desc').optional(),
    authorId: Joi.string().allow('').optional(),
  });

  SearchArticlesScheme = Joi.object({
    query: Joi.string().min(1).max(200).required(),
    page: Joi.number().integer().min(1).optional(),
    limit: Joi.number().integer().min(1).max(50).optional(),
    categoryId: Joi.number().integer().optional(),
  });

  CreateCategoryScheme = Joi.object({
    name: Joi.string().min(1).max(100).required(),
    description: Joi.string().max(500).allow('').optional(),
    parentId: Joi.number().integer().optional(),
  });

  UpdateCategoryScheme = Joi.object({
    id: Joi.number().integer().required(),
    name: Joi.string().min(1).max(100).optional(),
    description: Joi.string().max(500).allow('').optional(),
    parentId: Joi.number().integer().optional(),
  });

  DeleteCategoryScheme = Joi.object({
    id: Joi.number().integer().required(),
  });

  GetUploadUrlScheme = Joi.object({
    filename: Joi.string().max(255).required(),
    contentType: Joi.string().valid('image/png', 'image/jpeg', 'image/webp', 'image/gif').required()
      .messages({ 'any.only': 'Allowed types: png, jpeg, webp, gif' }),
    articleId: Joi.string().allow('').optional(),
  });
}
