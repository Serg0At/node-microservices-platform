import grpc from '@grpc/grpc-js';
import { subscriptionClient } from '../../config/grpc-clients.js';
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
    subscriptionClient[method](request, metadata, (err, response) => {
      if (err) return reject(grpcToGraphQLError(err));
      resolve(response);
    });
  });
}

export function getSubscription({ access_token }, userAgent) {
  return callRpc('GetSubscription', { access_token }, createMetadata(userAgent));
}

export function checkAccess({ user_id, required_level }, userAgent) {
  return callRpc('CheckAccess', { user_id, required_level }, createMetadata(userAgent));
}

export function createCheckout({ access_token, plan_type, payment_method, duration_months, promo_code }, userAgent) {
  return callRpc('CreateCheckout', { access_token, plan_type, payment_method, duration_months, promo_code: promo_code || '' }, createMetadata(userAgent));
}

export function validatePromoCode({ access_token, code, plan_type, duration_months }, userAgent) {
  return callRpc('ValidatePromoCode', { access_token, code, plan_type, duration_months }, createMetadata(userAgent));
}

export function cancelSubscription({ access_token }, userAgent) {
  return callRpc('CancelSubscription', { access_token }, createMetadata(userAgent));
}

export function restoreSubscription({ access_token }, userAgent) {
  return callRpc('RestoreSubscription', { access_token }, createMetadata(userAgent));
}

export function adminSetSubscription({ access_token, user_id, sub_type, duration_months, issued_by }, userAgent) {
  return callRpc('AdminSetSubscription', { access_token, user_id, sub_type, duration_months, issued_by }, createMetadata(userAgent));
}

export function getSubscriptionStats({ access_token }, userAgent) {
  return callRpc('GetSubscriptionStats', { access_token }, createMetadata(userAgent));
}
