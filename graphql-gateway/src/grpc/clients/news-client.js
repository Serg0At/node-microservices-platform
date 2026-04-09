import grpc from '@grpc/grpc-js';
import { newsClient } from '../../config/grpc-clients.js';
import { grpcToGraphQLError } from '../../utils/error-formatter.js';

function createMetadata(userAgent) {
  const metadata = new grpc.Metadata();
  if (userAgent) {
    metadata.set('user-agent', userAgent);
  }
  return metadata;
}

function callRpc(method, request, metadata) {
  return new Promise((resolve, reject) => {
    newsClient[method](request, metadata, (err, response) => {
      if (err) return reject(grpcToGraphQLError(err));
      resolve(response);
    });
  });
}

// Articles
export function createArticle({ access_token, title, content, category_id, tags, cover_image_url, status }, userAgent) {
  return callRpc('CreateArticle', { access_token, title, content, category_id, tags, cover_image_url, status }, createMetadata(userAgent));
}

export function updateArticle({ access_token, id, title, content, category_id, tags, cover_image_url, status }, userAgent) {
  return callRpc('UpdateArticle', { access_token, id, title, content, category_id, tags, cover_image_url, status }, createMetadata(userAgent));
}

export function deleteArticle({ access_token, id }, userAgent) {
  return callRpc('DeleteArticle', { access_token, id }, createMetadata(userAgent));
}

export function getArticle({ id, slug }, userAgent) {
  return callRpc('GetArticle', { id, slug }, createMetadata(userAgent));
}

export function listArticles({ page, limit, category_id, status, sort_by, sort_order, author_id }, userAgent) {
  return callRpc('ListArticles', { page, limit, category_id, status, sort_by, sort_order, author_id }, createMetadata(userAgent));
}

export function searchArticles({ query, page, limit, category_id }, userAgent) {
  return callRpc('SearchArticles', { query, page, limit, category_id }, createMetadata(userAgent));
}

// Categories
export function createCategory({ access_token, name, description, parent_id }, userAgent) {
  return callRpc('CreateCategory', { access_token, name, description, parent_id }, createMetadata(userAgent));
}

export function updateCategory({ access_token, id, name, description, parent_id }, userAgent) {
  return callRpc('UpdateCategory', { access_token, id, name, description, parent_id }, createMetadata(userAgent));
}

export function deleteCategory({ access_token, id }, userAgent) {
  return callRpc('DeleteCategory', { access_token, id }, createMetadata(userAgent));
}

export function listCategories({ parent_id }, userAgent) {
  return callRpc('ListCategories', { parent_id }, createMetadata(userAgent));
}

// Media
export function getUploadUrl({ access_token, filename, content_type, article_id }, userAgent) {
  return callRpc('GetUploadUrl', { access_token, filename, content_type, article_id }, createMetadata(userAgent));
}
