import { SubscriptionModel } from '../models/index.js';
import { subscriptionCacheOps } from '../redis/subscriptionCache.js';
import { dbBreaker, redisBreaker } from '../utils/circuit-breaker.util.js';
import { publishEvent } from '../rabbit/publisher.js';
import config from '../config/variables.config.js';
import logger from '../utils/logger.util.js';

let timer = null;

/**
 * Start the periodic subscription expiry worker.
 * Runs hourly to:
 * 1. Expire active subscriptions past their end date
 * 2. Terminate expired subscriptions past their grace period
 * 3. Send grace period warnings
 */
export const startExpiryWorker = () => {
  const intervalMs = config.EXPIRY.INTERVAL_MS;
  const graceDays = config.EXPIRY.GRACE_PERIOD_DAYS;

  logger.info('Expiry worker started', { intervalMs, graceDays });

  const run = async () => {
    try {
      // Step 1: active → expired
      const expired = await dbBreaker.fire(() =>
        SubscriptionModel.expireActive(graceDays)
      );

      for (const sub of expired) {
        logger.info('Subscription expired', { userId: sub.user_id, subType: sub.sub_type });

        // Invalidate cache for this user
        try {
          await redisBreaker.fire(() =>
            subscriptionCacheOps.invalidateSubscription(sub.user_id)
          );
        } catch {
          // non-critical
        }

        // Publish event
        try {
          await publishEvent('subscription.expired', {
            user_id: String(sub.user_id),
            sub_type: sub.sub_type,
            grace_period_end: sub.grace_period_end?.toISOString?.() || String(sub.grace_period_end || ''),
          });
        } catch (err) {
          logger.warn('Failed to publish subscription.expired event', { error: err.message, userId: sub.user_id });
        }
      }

      if (expired.length > 0) {
        logger.info('Expired active subscriptions', { count: expired.length });
      }

      // Step 2: expired → terminated
      const terminated = await dbBreaker.fire(() =>
        SubscriptionModel.terminateExpired()
      );

      for (const sub of terminated) {
        logger.info('Subscription terminated', { userId: sub.user_id });

        // Invalidate cache
        try {
          await redisBreaker.fire(() =>
            subscriptionCacheOps.invalidateSubscription(sub.user_id)
          );
        } catch {
          // non-critical
        }

        // Publish event
        try {
          await publishEvent('subscription.terminated', {
            user_id: String(sub.user_id),
          });
        } catch (err) {
          logger.warn('Failed to publish subscription.terminated event', { error: err.message, userId: sub.user_id });
        }
      }

      if (terminated.length > 0) {
        logger.info('Terminated expired subscriptions', { count: terminated.length });
      }

      // Step 3: 7-day expiry reminders
      const expiring7d = await dbBreaker.fire(() =>
        SubscriptionModel.findExpiringInDays(7)
      );

      for (const sub of expiring7d) {
        try {
          await publishEvent('subscription.expiry_reminder_7d', {
            user_id: String(sub.user_id),
            sub_type: sub.sub_type,
            ended_at: sub.ended_at?.toISOString?.() || String(sub.ended_at),
            days_left: 7,
          });
        } catch (err) {
          logger.warn('Failed to publish expiry_reminder_7d', { error: err.message, userId: sub.user_id });
        }
      }

      if (expiring7d.length > 0) {
        logger.info('Sent 7-day expiry reminders', { count: expiring7d.length });
      }

      // Step 4: 1-day expiry reminders
      const expiring1d = await dbBreaker.fire(() =>
        SubscriptionModel.findExpiringInDays(1)
      );

      for (const sub of expiring1d) {
        try {
          await publishEvent('subscription.expiry_reminder_1d', {
            user_id: String(sub.user_id),
            sub_type: sub.sub_type,
            ended_at: sub.ended_at?.toISOString?.() || String(sub.ended_at),
            days_left: 1,
          });
        } catch (err) {
          logger.warn('Failed to publish expiry_reminder_1d', { error: err.message, userId: sub.user_id });
        }
      }

      if (expiring1d.length > 0) {
        logger.info('Sent 1-day expiry reminders', { count: expiring1d.length });
      }

      // Step 5: grace warning
      const graceWarnings = await dbBreaker.fire(() =>
        SubscriptionModel.findGraceWarnings()
      );

      for (const sub of graceWarnings) {
        try {
          await publishEvent('subscription.grace_warning', {
            user_id: String(sub.user_id),
            grace_period_end: sub.grace_period_end?.toISOString?.() || String(sub.grace_period_end || ''),
          });
        } catch (err) {
          logger.warn('Failed to publish subscription.grace_warning event', { error: err.message, userId: sub.user_id });
        }
      }

      if (graceWarnings.length > 0) {
        logger.info('Sent grace period warnings', { count: graceWarnings.length });
      }

      // Invalidate stats cache if any changes
      if (expired.length > 0 || terminated.length > 0) {
        try {
          await redisBreaker.fire(() => subscriptionCacheOps.invalidateStats());
        } catch {
          // non-critical
        }
      }
    } catch (err) {
      logger.error('Expiry worker failed', { error: err.message, stack: err.stack });
    }

    timer = setTimeout(run, intervalMs);
  };

  // Run first check after a short delay (let the service fully boot)
  timer = setTimeout(run, 10000);
};

export const stopExpiryWorker = () => {
  if (timer) {
    clearTimeout(timer);
    timer = null;
    logger.info('Expiry worker stopped');
  }
};
