import NotificationService from '../../services/notification.service.js';
import { getUserById } from '../../grpc/auth-client.js';
import logger from '../../utils/logger.util.js';

const planNames = { 1: 'Lite', 2: 'Standard', 3: 'PRO' };

export default async function handleSubscriptionExpiryReminder(payload) {
  const { user_id, sub_type, ended_at, days_left } = payload;

  let user;
  try {
    user = await getUserById(user_id);
  } catch (err) {
    logger.error('Failed to fetch user for expiry reminder', { userId: user_id, error: err.message });
    return;
  }

  const endedAt = ended_at
    ? new Date(ended_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    : '';

  const daysLeft = days_left === 1 ? 'tomorrow' : `in ${days_left} days`;
  const subject = `Your Arbex subscription expires ${daysLeft}`;

  await NotificationService.createAndSend({
    userId: user_id,
    email: user.email,
    type: 'subscription_expiry_reminder',
    channel: 'both',
    template: 'subscription-expiry-reminder',
    subject,
    context: {
      username: user.username || 'there',
      planName: planNames[sub_type] || 'Pro',
      endedAt,
      daysLeft,
      renewUrl: process.env.FRONTEND_URL || 'https://arbex.io',
      body: subject,
    },
    payload,
  });
}
