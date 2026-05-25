import NotificationService from '../../services/notification.service.js';
import { getUserById } from '../../grpc/auth-client.js';
import config from '../../config/variables.config.js';
import logger from '../../utils/logger.util.js';

const planNames = { 1: 'Lite', 2: 'Standard', 3: 'PRO' };

export default async function handleSubscriptionActivated(payload) {
  const { user_id, sub_type, ended_at, issued_by, is_trial } = payload;

  // Treat the event as a trial if the explicit flag is set, or fall back
  // to inferring from `issued_by` for backwards compatibility with any
  // events still in-flight from before the flag was added.
  const trial = is_trial === true || (is_trial === undefined && issued_by === 'System');

  logger.info('subscription.activated received', {
    user_id,
    sub_type,
    issued_by,
    is_trial: trial,
  });

  let user;
  try {
    user = await getUserById(user_id);
  } catch (err) {
    logger.error('Failed to fetch user for subscription.activated', {
      userId: user_id,
      error: err.message,
    });
    return;
  }

  const endedAt = ended_at
    ? new Date(ended_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    : '';

  const template = trial ? 'trial-started' : 'subscription-activated';
  const subject = trial
    ? 'Your free trial has started'
    : 'Your Arbex subscription is now active!';
  const type = trial ? 'trial_started' : 'subscription_activated';

  logger.info('Dispatching subscription email', {
    user_id,
    template,
    is_trial: trial,
  });

  await NotificationService.createAndSend({
    userId: user_id,
    email: user.email,
    type,
    channel: 'email',
    template,
    subject,
    context: {
      username: user.username || 'there',
      planName: planNames[sub_type] || 'Standard',
      endedAt,
      dashboardUrl: config.FRONTEND.URL,
    },
    payload,
  });
}
