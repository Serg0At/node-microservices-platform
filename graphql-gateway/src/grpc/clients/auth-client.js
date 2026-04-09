import grpc from '@grpc/grpc-js';
import { authClient } from '../../config/grpc-clients.js';
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
    authClient[method](request, metadata, (err, response) => {
      if (err) return reject(grpcToGraphQLError(err));
      resolve(response);
    });
  });
}

export function registerUser({ email, username, password_hash, fingerprint, ip }, userAgent) {
  return callRpc('RegisterUser', { email, username, password_hash, fingerprint: fingerprint || '', ip: ip || '' }, createMetadata(userAgent));
}

export function loginUser({ email_username, password_hash }, userAgent) {
  return callRpc('LoginUser', { email_username, password_hash }, createMetadata(userAgent));
}

export function oidcLogin({ code, provider, state }, userAgent) {
  return callRpc('OIDCLogin', { code, provider, state }, createMetadata(userAgent));
}

export function forgotPassword({ email }, userAgent) {
  return callRpc('ForgotPassword', { email }, createMetadata(userAgent));
}

export function verifyResetCode({ email, code }, userAgent) {
  return callRpc('VerifyResetCode', { email, code }, createMetadata(userAgent));
}

export function resetPassword({ email, code, new_pass }, userAgent) {
  return callRpc('ResetPassword', { email, code, new_pass }, createMetadata(userAgent));
}

export function requestPasswordChange({ access_token }, userAgent) {
  return callRpc('RequestPasswordChange', { access_token }, createMetadata(userAgent));
}

export function confirmPasswordChange({ token, new_pass }, userAgent) {
  return callRpc('ConfirmPasswordChange', { token, new_pass }, createMetadata(userAgent));
}

export function setup2FA({ access_token }, userAgent) {
  return callRpc('Setup2FA', { access_token }, createMetadata(userAgent));
}

export function verify2FA({ code, access_token }, userAgent) {
  return callRpc('Verify2FA', { code, access_token }, createMetadata(userAgent));
}

export function verifyEmail({ token }, userAgent) {
  return callRpc('VerifyEmail', { token }, createMetadata(userAgent));
}

export function refreshTokens({ refresh_token }, userAgent) {
  return callRpc('RefreshTokens', { refresh_token }, createMetadata(userAgent));
}

export function logout({ refresh_token }, userAgent) {
  return callRpc('Logout', { refresh_token }, createMetadata(userAgent));
}
