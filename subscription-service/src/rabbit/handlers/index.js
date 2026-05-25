import handleUserEmailVerified from './user.email_verified.js';
import handlePaymentSucceeded from './payment.succeeded.js';
import handlePaymentRefunded from './payment.refunded.js';

/**
 * Maps routing keys to their handler functions.
 * Trial provisioning is wired to `user.email_verified`, not `user.registered`,
 * so unverified accounts cannot consume trial entitlements.
 */
const handlers = {
  'user.email_verified': handleUserEmailVerified,
  'payment.succeeded': handlePaymentSucceeded,
  'payment.refunded': handlePaymentRefunded,
};

export default handlers;
