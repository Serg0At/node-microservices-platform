import grpc from '@grpc/grpc-js';
import { notificationClient } from '../../config/grpc-clients.js';
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
    notificationClient[method](request, metadata, (err, response) => {
      if (err) return reject(grpcToGraphQLError(err));
      resolve(response);
    });
  });
}

export function getNotifications({ user_id, limit, offset, type_filter, read_filter }, userAgent) {
  return callRpc('GetNotifications', { user_id, limit, offset, type_filter, read_filter }, createMetadata(userAgent));
}

export function getUnreadCount({ user_id }, userAgent) {
  return callRpc('GetUnreadCount', { user_id }, createMetadata(userAgent));
}

export function markAsRead({ notification_id, user_id }, userAgent) {
  return callRpc('MarkAsRead', { notification_id, user_id }, createMetadata(userAgent));
}

export function markAllAsRead({ user_id }, userAgent) {
  return callRpc('MarkAllAsRead', { user_id }, createMetadata(userAgent));
}

export function deleteNotification({ notification_id, user_id }, userAgent) {
  return callRpc('DeleteNotification', { notification_id, user_id }, createMetadata(userAgent));
}
