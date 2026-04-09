import SubscriptionService from '../../services/subscription.service.js';
import logger from '../../utils/logger.util.js';

export default async function handlePaymentRefunded(payload) {
  const { user_id, plan_type, amount, provider, transaction_id } = payload;

  logger.info('Handling payment.refunded event', { userId: user_id, planType: plan_type, amount, transactionId: transaction_id });

  await SubscriptionService.handlePaymentRefunded({ user_id });
}
