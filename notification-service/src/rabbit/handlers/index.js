import handleUserRegistered from './user.registered.js';
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
 */
const handlers = {
  'user.registered': handleUserRegistered,
  'user.verify_email': handleUserVerifyEmail,
  'user.forgot_password': handleUserForgotPassword,
  'user.change_password_request': handleUserForgotPassword,
  'user.password_changed': handleUserPasswordChanged,
  'user.logged_in': handleUserLoggedIn,
  'user.2fa_enabled': handleUser2faEnabled,
  'subscription.activated': handleSubscriptionActivated,
  'subscription.expiry_reminder_7d': handleSubscriptionExpiryReminder,
  'subscription.expiry_reminder_1d': handleSubscriptionExpiryReminder,
  'article.created': handleArticleCreated,
};

export default handlers;
