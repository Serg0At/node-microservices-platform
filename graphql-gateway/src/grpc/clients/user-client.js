import grpc from '@grpc/grpc-js';
import { userClient } from '../../config/grpc-clients.js';
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
    userClient[method](request, metadata, (err, response) => {
      if (err) return reject(grpcToGraphQLError(err));
      resolve(response);
    });
  });
}

export function getProfile({ user_id }, userAgent) {
  return callRpc('GetProfile', { user_id }, createMetadata(userAgent));
}

export function updateProfile({ access_token, username, display_name }, userAgent) {
  return callRpc('UpdateProfile', { access_token, username, display_name }, createMetadata(userAgent));
}

export function uploadAvatar({ access_token, image_data, content_type, file_name }, userAgent) {
  return callRpc('UploadAvatar', { access_token, image_data, content_type, file_name }, createMetadata(userAgent));
}
