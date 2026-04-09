import SubscriptionService from '../../services/subscription.service.js';
import logger from '../../utils/logger.util.js';

export default async function handlePaymentSucceeded(payload) {
  const { user_id, plan_type, amount, currency, provider, transaction_id, order_id, duration_months } = payload;

  logger.info('Handling payment.succeeded event', { userId: user_id, planType: plan_type, amount, transactionId: transaction_id });

  await SubscriptionService.handlePaymentSucceeded({
    user_id,
    plan_type,
    duration_months,
  });
}
