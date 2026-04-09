import SubscriptionService from '../../services/subscription.service.js';
import logger from '../../utils/logger.util.js';

export default async function handleUserRegistered(payload) {
  const { user_id, trial_signals } = payload;

  logger.info('Handling user.registered event', { userId: user_id });

  await SubscriptionService.createTrialSubscription(user_id, trial_signals || null);
}
