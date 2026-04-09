import grpc from '@grpc/grpc-js';
import { adminClient } from '../../config/grpc-clients.js';
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
    adminClient[method](request, metadata, (err, response) => {
      if (err) return reject(grpcToGraphQLError(err));
      resolve(response);
    });
  });
}

export function getDashboardStats({ access_token }, userAgent) {
  return callRpc('GetDashboardStats', { access_token }, createMetadata(userAgent));
}

export function listUsers({ access_token, page, limit, search, role, status }, userAgent) {
  return callRpc('ListUsers', { access_token, page, limit, search, role, status }, createMetadata(userAgent));
}

export function getUser({ access_token, user_id }, userAgent) {
  return callRpc('GetUser', { access_token, user_id }, createMetadata(userAgent));
}

export function updateUserRole({ access_token, user_id, role }, userAgent) {
  return callRpc('UpdateUserRole', { access_token, user_id, role }, createMetadata(userAgent));
}

export function banUser({ access_token, user_id, reason }, userAgent) {
  return callRpc('BanUser', { access_token, user_id, reason }, createMetadata(userAgent));
}

export function unbanUser({ access_token, user_id }, userAgent) {
  return callRpc('UnbanUser', { access_token, user_id }, createMetadata(userAgent));
}

export function createArticle({ access_token, title, content, type, cover_image_url, categories }, userAgent) {
  return callRpc('CreateArticle', { access_token, title, content, type, cover_image_url, categories }, createMetadata(userAgent));
}

export function deleteArticle({ access_token, article_id }, userAgent) {
  return callRpc('DeleteArticle', { access_token, article_id }, createMetadata(userAgent));
}

export function getUploadUrl({ access_token, filename, content_type, article_id }, userAgent) {
  return callRpc('GetUploadUrl', { access_token, filename, content_type, article_id }, createMetadata(userAgent));
}

export function getArticleStats({ access_token }, userAgent) {
  return callRpc('GetArticleStats', { access_token }, createMetadata(userAgent));
}

export function adminSetSubscription({ access_token, user_id, sub_type, duration_months, issued_by }, userAgent) {
  return callRpc('AdminSetSubscription', { access_token, user_id, sub_type, duration_months, issued_by }, createMetadata(userAgent));
}

export function adminRemoveSubscription({ access_token, user_id, reason }, userAgent) {
  return callRpc('AdminRemoveSubscription', { access_token, user_id, reason }, createMetadata(userAgent));
}

export function getSubscriptionStats({ access_token }, userAgent) {
  return callRpc('GetSubscriptionStats', { access_token }, createMetadata(userAgent));
}

export function createPromoCode({ access_token, code, discount_type, discount_value, max_uses, applicable_tiers, min_duration_months, valid_until }, userAgent) {
  return callRpc('CreatePromoCode', { access_token, code, discount_type, discount_value, max_uses, applicable_tiers, min_duration_months, valid_until }, createMetadata(userAgent));
}

export function listPromoCodes({ access_token, page, limit, active_only }, userAgent) {
  return callRpc('ListPromoCodes', { access_token, page, limit, active_only }, createMetadata(userAgent));
}

export function deactivatePromoCode({ access_token, code }, userAgent) {
  return callRpc('DeactivatePromoCode', { access_token, code }, createMetadata(userAgent));
}

export function adminSendNotification({ access_token, user_id, email, subject, body, channel }, userAgent) {
  return callRpc('AdminSendNotification', { access_token, user_id, email, subject, body, channel }, createMetadata(userAgent));
}

export function adminSendBulkNotification({ access_token, subject, body, channel, recipients }, userAgent) {
  return callRpc('AdminSendBulkNotification', { access_token, subject, body, channel, recipients }, createMetadata(userAgent));
}
