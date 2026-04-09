import handleUserRegistered from './user.registered.js';
import handlePaymentSucceeded from './payment.succeeded.js';
import handlePaymentRefunded from './payment.refunded.js';

/**
 * Maps routing keys to their handler functions.
 */
const handlers = {
  'user.registered': handleUserRegistered,
  'payment.succeeded': handlePaymentSucceeded,
  'payment.refunded': handlePaymentRefunded,
};

export default handlers;
