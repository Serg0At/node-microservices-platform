import NotificationService from '../../services/notification.service.js';
import { getUserById } from '../../grpc/auth-client.js';
import logger from '../../utils/logger.util.js';

const planNames = { 1: 'Lite', 2: 'Standard', 3: 'PRO' };

export default async function handleSubscriptionActivated(payload) {
  const { user_id, sub_type, ended_at } = payload;

  let user;
  try {
    user = await getUserById(user_id);
  } catch (err) {
    logger.error('Failed to fetch user for subscription.activated', { userId: user_id, error: err.message });
    return;
  }

  const endedAt = ended_at
    ? new Date(ended_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    : '';

  await NotificationService.createAndSend({
    userId: user_id,
    email: user.email,
    type: 'subscription_activated',
    channel: 'email',
    template: 'subscription-activated',
    subject: 'Your Arbex subscription is now active!',
    context: {
      username: user.username || 'there',
      planName: planNames[sub_type] || 'Pro',
      endedAt,
      dashboardUrl: process.env.FRONTEND_URL || 'https://arbex.io',
    },
    payload,
  });
}
