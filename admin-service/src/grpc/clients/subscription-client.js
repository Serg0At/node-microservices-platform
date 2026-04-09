import grpc from '@grpc/grpc-js';
import protoLoader from '@grpc/proto-loader';
import path from 'path';
import { fileURLToPath } from 'url';
import config from '../../config/variables.config.js';
import logger from '../../utils/logger.util.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const protoPath = path.join(__dirname, '../../../proto/subscription.proto');
const pkgDef = protoLoader.loadSync(protoPath, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});

const subscriptionProto = grpc.loadPackageDefinition(pkgDef).subscription;
const subscriptionClient = new subscriptionProto.SubscriptionService(
  config.GRPC.SUBSCRIPTION_SERVICE_URL,
  grpc.credentials.createInsecure(),
);

logger.info(`Subscription gRPC client connected to ${config.GRPC.SUBSCRIPTION_SERVICE_URL}`);

function callRpc(method, request) {
  return new Promise((resolve, reject) => {
    subscriptionClient[method](request, (err, response) => {
      if (err) return reject(err);
      resolve(response);
    });
  });
}

export function adminSetSubscription({ access_token, user_id, sub_type, duration_months, issued_by }) {
  return callRpc('AdminSetSubscription', { access_token, user_id, sub_type, duration_months, issued_by });
}

export function adminRemoveSubscription({ access_token, user_id, reason }) {
  return callRpc('AdminRemoveSubscription', { access_token, user_id, reason });
}

export function getSubscriptionStats({ access_token }) {
  return callRpc('GetSubscriptionStats', { access_token });
}

export function createPromoCode({ access_token, code, discount_type, discount_value, max_uses, applicable_tiers, min_duration_months, valid_until }) {
  return callRpc('CreatePromoCode', { access_token, code, discount_type, discount_value, max_uses, applicable_tiers, min_duration_months, valid_until });
}

export function listPromoCodes({ access_token, page, limit, active_only }) {
  return callRpc('ListPromoCodes', { access_token, page, limit, active_only });
}

export function deactivatePromoCode({ access_token, code }) {
  return callRpc('DeactivatePromoCode', { access_token, code });
}
