import handleUserVerifyEmail from './user.verify_email.js';
import handleUserForgotPassword from './user.forgot_password.js';
import handleUserPasswordChanged from './user.password_changed.js';
import handleUserLoggedIn from './user.logged_in.js';
import handleUser2faEnabled from './user.2fa_enabled.js';
import handleSubscriptionActivated from './subscription.activated.js';
import handleSubscriptionExpiryReminder from './subscription.expiry_reminder.js';
import handleArticleCreated from './article.created.js';

/**
 * Maps routing keys to their handler functions.
 * Note: `user.registered` intentionally has no handler — welcome email was
 * removed. The single onboarding email is `user.verify_email`.
 */
const noop = async () => {};

const handlers = {
  'user.registered': noop,
  'user.verify_email': handleUserVerifyEmail,
  'user.forgot_password': handleUserForgotPassword,
  'user.change_password_request': handleUserForgotPassword,
  'user.password_changed': handleUserPasswordChanged,
  'user.logged_in': handleUserLoggedIn,
  'user.2fa_enabled': handleUser2faEnabled,
  'user.email_verified': noop,
  'subscription.activated': handleSubscriptionActivated,
  'subscription.expiry_reminder_7d': handleSubscriptionExpiryReminder,
  'subscription.expiry_reminder_1d': handleSubscriptionExpiryReminder,
  'article.created': handleArticleCreated,
};

export default handlers;
