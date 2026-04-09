import { SubscriptionModel, PromoCodeModel } from '../models/index.js';
import { subscriptionCacheOps } from '../redis/subscriptionCache.js';
import { dbBreaker, redisBreaker } from '../utils/circuit-breaker.util.js';
import { publishEvent } from '../rabbit/publisher.js';
import { createPayment } from '../grpc/payment-client.js';
import { getPlanPrice } from '../config/pricing.config.js';
import logger from '../utils/logger.util.js';
import db from '../config/db.js';
import ErrorHandler from '../utils/error-handler.util.js';
import { v4 as uuidv4 } from 'uuid';

const { errors } = ErrorHandler;

export default class SubscriptionService {
  /**
   * Get the current subscription for a user.
   */
  static async getSubscription(userId) {
    const subscription = await dbBreaker.fire(() =>
      SubscriptionModel.findLatestByUserId(userId)
    );

    if (!subscription) {
      throw new errors.ResourceNotFoundError('No subscription found for this user');
    }

    return {
      success: true,
      subscription: SubscriptionService._formatSubscription(subscription),
    };
  }

  /**
   * Check if a user has access at a given level.
   * Internal only — no token required.
   */
  static async checkAccess(userId, requiredLevel) {
    // Try cache first
    let subscription = null;
    try {
      subscription = await redisBreaker.fire(() =>
        subscriptionCacheOps.getSubscription(userId)
      );
    } catch {
      // cache miss or error, fall through to DB
    }

    if (!subscription) {
      subscription = await dbBreaker.fire(() =>
        SubscriptionModel.findActiveByUserId(userId)
      );

      if (subscription) {
        try {
          await redisBreaker.fire(() =>
            subscriptionCacheOps.setSubscription(userId, subscription)
          );
        } catch {
          // non-critical
        }
      }
    }

    if (!subscription || subscription.status !== 'active') {
      return {
        has_access: requiredLevel === 0,
        current_level: 0,
        status: subscription ? subscription.status : 'none',
      };
    }

    return {
      has_access: subscription.sub_type >= requiredLevel,
      current_level: subscription.sub_type,
      status: subscription.status,
    };
  }

  /**
   * Create a checkout session for upgrading/purchasing a subscription.
   */
  static async createCheckout(userId, planType, paymentMethod, durationMonths, promoCode) {
    const newPlanPrice = getPlanPrice(planType, durationMonths);
    if (newPlanPrice === null) {
      throw new errors.InputValidationError('Invalid plan type or duration');
    }

    // Check for existing active subscription (proration)
    const existing = await dbBreaker.fire(() =>
      SubscriptionModel.findActiveByUserId(userId)
    );

    let proration = null;
    let finalAmount = newPlanPrice;

    if (existing && existing.sub_type > 0) {
      // Cannot downgrade via checkout
      if (planType <= existing.sub_type) {
        throw new errors.ConflictError('Cannot downgrade via checkout. Cancel first or choose a higher plan.');
      }

      // Calculate proration
      const now = Date.now();
      const endedAt = new Date(existing.ended_at).getTime();
      const startedAt = new Date(existing.started_at).getTime();

      const remainingDays = Math.max(0, Math.ceil((endedAt - now) / (1000 * 60 * 60 * 24)));
      const totalDays = Math.max(1, Math.ceil((endedAt - startedAt) / (1000 * 60 * 60 * 24)));

      const currentPlanPrice = getPlanPrice(existing.sub_type, durationMonths) || getPlanPrice(existing.sub_type, 1);
      const dailyRate = currentPlanPrice / totalDays;
      const remainingValue = Math.round(remainingDays * dailyRate);
      const discount = remainingValue;
      finalAmount = Math.max(0, newPlanPrice - discount);

      proration = {
        remaining_days: remainingDays,
        remaining_value_cents: remainingValue,
        new_plan_price_cents: newPlanPrice,
        discount_cents: discount,
        final_price_cents: finalAmount,
      };
    }

    // Apply promo code discount
    if (promoCode) {
      const promoDiscount = await SubscriptionService._applyPromoCode(promoCode, planType, durationMonths, finalAmount);
      finalAmount = promoDiscount.final_price_cents;

      // Increment usage
      await dbBreaker.fire(() => PromoCodeModel.incrementUsedCount(promoCode));

      if (proration) {
        proration.discount_cents += promoDiscount.discount_amount_cents;
        proration.final_price_cents = finalAmount;
      } else {
        proration = {
          remaining_days: 0,
          remaining_value_cents: 0,
          new_plan_price_cents: newPlanPrice,
          discount_cents: promoDiscount.discount_amount_cents,
          final_price_cents: finalAmount,
        };
      }
    }

    const orderId = uuidv4();

    // Call payment service via gRPC
    let paymentResult;
    try {
      paymentResult = await createPayment({
        user_id: String(userId),
        plan_type: planType,
        payment_method: paymentMethod,
        currency: 'USD',
        amount: finalAmount,
        duration_months: durationMonths,
        order_id: orderId,
      });
    } catch (err) {
      logger.error('Payment service call failed', { error: err.message, userId, planType });
      throw new errors.MicroserviceError('Payment service unavailable');
    }

    return {
      success: true,
      payment_url: paymentResult.payment_url || '',
      order_id: orderId,
      expires_in: paymentResult.expires_in || 1800,
      proration: proration || {
        remaining_days: 0,
        remaining_value_cents: 0,
        new_plan_price_cents: newPlanPrice,
        discount_cents: 0,
        final_price_cents: finalAmount,
      },
    };
  }

  /**
   * Cancel the user's active subscription.
   * Sets status to 'canceled'. Subscription remains until ended_at.
   */
  static async cancelSubscription(userId) {
    const subscription = await dbBreaker.fire(() =>
      SubscriptionModel.findActiveByUserId(userId)
    );

    if (!subscription) {
      throw new errors.ResourceNotFoundError('No active subscription to cancel');
    }

    const updated = await dbBreaker.fire(() =>
      db.transaction(trx =>
        SubscriptionModel.updateById(subscription.id, { status: 'canceled' }, trx)
      )
    );

    // Invalidate cache
    try {
      await redisBreaker.fire(async () => {
        await subscriptionCacheOps.invalidateSubscription(userId);
        await subscriptionCacheOps.invalidateStats();
      });
    } catch {
      // non-critical
    }

    // Publish event
    try {
      await publishEvent('subscription.canceled', {
        user_id: String(userId),
        ended_at: updated.ended_at?.toISOString?.() || String(updated.ended_at),
      });
    } catch (err) {
      logger.warn('Failed to publish subscription.canceled event', { error: err.message, userId });
    }

    return {
      success: true,
      subscription: SubscriptionService._formatSubscription(updated),
    };
  }

  /**
   * Restore a canceled subscription (reactivate it).
   */
  static async restoreSubscription(userId) {
    const subscription = await dbBreaker.fire(() =>
      db('subscriptions')
        .where({ user_id: userId })
        .whereIn('status', ['canceled', 'expired'])
        .orderBy('created_at', 'desc')
        .first()
    );

    if (!subscription) {
      throw new errors.ResourceNotFoundError('No canceled or expired subscription to restore');
    }

    // Check if ended_at has passed — if so, cannot restore
    const now = new Date();
    if (subscription.status === 'canceled' && new Date(subscription.ended_at) < now) {
      throw new errors.ConflictError('Subscription period has already ended. Cannot restore.');
    }

    if (subscription.status === 'expired' && subscription.grace_period_end && new Date(subscription.grace_period_end) < now) {
      throw new errors.ConflictError('Grace period has ended. Cannot restore.');
    }

    const updated = await dbBreaker.fire(() =>
      db.transaction(trx =>
        SubscriptionModel.updateById(subscription.id, {
          status: 'active',
          grace_period_end: null,
        }, trx)
      )
    );

    // Invalidate cache
    try {
      await redisBreaker.fire(async () => {
        await subscriptionCacheOps.invalidateSubscription(userId);
        await subscriptionCacheOps.invalidateStats();
      });
    } catch {
      // non-critical
    }

    // Publish event
    try {
      await publishEvent('subscription.reactivated', {
        user_id: String(userId),
        sub_type: updated.sub_type,
        ended_at: updated.ended_at?.toISOString?.() || String(updated.ended_at),
      });
    } catch (err) {
      logger.warn('Failed to publish subscription.reactivated event', { error: err.message, userId });
    }

    return {
      success: true,
      subscription: SubscriptionService._formatSubscription(updated),
    };
  }

  /**
   * Admin: set a subscription for a user (create or replace).
   */
  static async adminSetSubscription(targetUserId, subType, durationMonths, issuedBy) {
    const now = new Date();
    const endedAt = new Date(now);
    endedAt.setMonth(endedAt.getMonth() + durationMonths);

    // Terminate any existing active subscription
    const existing = await dbBreaker.fire(() =>
      SubscriptionModel.findActiveByUserId(targetUserId)
    );

    if (existing) {
      await dbBreaker.fire(() =>
        db.transaction(trx =>
          SubscriptionModel.updateById(existing.id, { status: 'terminated', sub_type: 0 }, trx)
        )
      );
    }

    // Create new subscription
    const subscription = await dbBreaker.fire(() =>
      db.transaction(trx =>
        SubscriptionModel.create({
          user_id: targetUserId,
          sub_type: subType,
          free_trial: true, // admin-set counts as trial consumed
          status: 'active',
          started_at: now,
          ended_at: endedAt,
          issued_by: issuedBy,
        }, trx)
      )
    );

    // Invalidate cache
    try {
      await redisBreaker.fire(async () => {
        await subscriptionCacheOps.invalidateSubscription(targetUserId);
        await subscriptionCacheOps.invalidateStats();
      });
    } catch {
      // non-critical
    }

    // Publish event
    try {
      await publishEvent('subscription.activated', {
        user_id: String(targetUserId),
        sub_type: subscription.sub_type,
        started_at: subscription.started_at?.toISOString?.() || String(subscription.started_at),
        ended_at: subscription.ended_at?.toISOString?.() || String(subscription.ended_at),
        issued_by: issuedBy,
      });
    } catch (err) {
      logger.warn('Failed to publish subscription.activated event', { error: err.message, userId: targetUserId });
    }

    return {
      success: true,
      subscription: SubscriptionService._formatSubscription(subscription),
    };
  }

  /**
   * Admin: remove (terminate) a user's active subscription.
   */
  static async adminRemoveSubscription(targetUserId, reason) {
    const subscription = await dbBreaker.fire(() =>
      SubscriptionModel.findActiveByUserId(targetUserId)
    );

    if (!subscription) {
      throw new errors.ResourceNotFoundError('No active subscription found for this user');
    }

    await dbBreaker.fire(() =>
      db.transaction(trx =>
        SubscriptionModel.updateById(subscription.id, { status: 'terminated', sub_type: 0 }, trx)
      )
    );

    // Invalidate cache
    try {
      await redisBreaker.fire(async () => {
        await subscriptionCacheOps.invalidateSubscription(targetUserId);
        await subscriptionCacheOps.invalidateStats();
      });
    } catch {
      // non-critical
    }

    // Publish event
    try {
      await publishEvent('subscription.terminated', {
        user_id: String(targetUserId),
        reason: reason || 'Admin removal',
      });
    } catch (err) {
      logger.warn('Failed to publish subscription.terminated event', { error: err.message, userId: targetUserId });
    }

    return {
      success: true,
      message: 'Subscription removed',
    };
  }

  /**
   * Get subscription statistics (admin).
   */
  static async getSubscriptionStats() {
    // Try cache first
    let stats = null;
    try {
      stats = await redisBreaker.fire(() => subscriptionCacheOps.getStats());
    } catch {
      // cache miss or error
    }

    if (stats) {
      return { success: true, ...stats };
    }

    stats = await dbBreaker.fire(() => SubscriptionModel.getStats());

    // Cache the result
    try {
      await redisBreaker.fire(() => subscriptionCacheOps.setStats(stats));
    } catch {
      // non-critical
    }

    return { success: true, ...stats };
  }

  /**
   * Handle trial creation from user.registered event.
   */
  static async createTrialSubscription(userId, trialSignals) {
    // Check if user already has any subscription with trial used
    const trialUsed = await dbBreaker.fire(() =>
      SubscriptionModel.hasUsedTrial(userId)
    );

    if (trialUsed) {
      logger.info('Trial already used, skipping', { userId });
      return null;
    }

    // Check for existing active subscription
    const existing = await dbBreaker.fire(() =>
      SubscriptionModel.findActiveByUserId(userId)
    );

    if (existing) {
      logger.info('User already has active subscription, skipping trial', { userId });
      return null;
    }

    // Determine trial duration based on abuse signals
    const abuseDetected = trialSignals && (
      trialSignals.fingerprint_seen === true ||
      trialSignals.ip_seen === true ||
      trialSignals.disposable_email === true
    );
    const trialDays = abuseDetected ? 1 : 3;

    const now = new Date();
    const endedAt = new Date(now);
    endedAt.setDate(endedAt.getDate() + trialDays);

    const subscription = await dbBreaker.fire(() =>
      db.transaction(trx =>
        SubscriptionModel.create({
          user_id: userId,
          sub_type: 2, // Standard trial
          free_trial: false, // false = unused (will be set to true when actual payment occurs)
          status: 'active',
          started_at: now,
          ended_at: endedAt,
          issued_by: 'System',
        }, trx)
      )
    );

    // Invalidate cache
    try {
      await redisBreaker.fire(async () => {
        await subscriptionCacheOps.invalidateSubscription(userId);
        await subscriptionCacheOps.invalidateStats();
      });
    } catch {
      // non-critical
    }

    // Publish event
    try {
      await publishEvent('subscription.activated', {
        user_id: String(userId),
        sub_type: subscription.sub_type,
        started_at: subscription.started_at?.toISOString?.() || String(subscription.started_at),
        ended_at: subscription.ended_at?.toISOString?.() || String(subscription.ended_at),
        issued_by: 'System',
      });
    } catch (err) {
      logger.warn('Failed to publish subscription.activated event', { error: err.message, userId });
    }

    logger.info('Trial subscription created', { userId, trialDays });
    return subscription;
  }

  /**
   * Handle payment.succeeded event — create or upgrade subscription.
   */
  static async handlePaymentSucceeded({ user_id, plan_type, duration_months }) {
    const userId = user_id;
    const now = new Date();
    const endedAt = new Date(now);
    endedAt.setMonth(endedAt.getMonth() + (duration_months || 1));

    // Terminate any existing active subscription
    const existing = await dbBreaker.fire(() =>
      SubscriptionModel.findActiveByUserId(userId)
    );

    if (existing) {
      await dbBreaker.fire(() =>
        db.transaction(trx =>
          SubscriptionModel.updateById(existing.id, { status: 'terminated', sub_type: 0 }, trx)
        )
      );
    }

    // Create new subscription
    const subscription = await dbBreaker.fire(() =>
      db.transaction(trx =>
        SubscriptionModel.create({
          user_id: userId,
          sub_type: plan_type,
          free_trial: true, // trial consumed on any payment
          status: 'active',
          started_at: now,
          ended_at: endedAt,
          issued_by: 'Payment',
        }, trx)
      )
    );

    // Invalidate cache
    try {
      await redisBreaker.fire(async () => {
        await subscriptionCacheOps.invalidateSubscription(userId);
        await subscriptionCacheOps.invalidateStats();
      });
    } catch {
      // non-critical
    }

    // Publish event
    try {
      await publishEvent('subscription.activated', {
        user_id: String(userId),
        sub_type: subscription.sub_type,
        started_at: subscription.started_at?.toISOString?.() || String(subscription.started_at),
        ended_at: subscription.ended_at?.toISOString?.() || String(subscription.ended_at),
        issued_by: 'Payment',
      });
    } catch (err) {
      logger.warn('Failed to publish subscription.activated event', { error: err.message, userId });
    }

    logger.info('Subscription created from payment', { userId, planType: plan_type, durationMonths: duration_months });
    return subscription;
  }

  /**
   * Handle payment.refunded event — cancel subscription.
   */
  static async handlePaymentRefunded({ user_id }) {
    const userId = user_id;

    const subscription = await dbBreaker.fire(() =>
      SubscriptionModel.findActiveByUserId(userId)
    );

    if (!subscription) {
      logger.warn('No active subscription found for refunded payment', { userId });
      return null;
    }

    const updated = await dbBreaker.fire(() =>
      db.transaction(trx =>
        SubscriptionModel.updateById(subscription.id, { status: 'canceled' }, trx)
      )
    );

    // Invalidate cache
    try {
      await redisBreaker.fire(async () => {
        await subscriptionCacheOps.invalidateSubscription(userId);
        await subscriptionCacheOps.invalidateStats();
      });
    } catch {
      // non-critical
    }

    // Publish event
    try {
      await publishEvent('subscription.canceled', {
        user_id: String(userId),
        ended_at: updated.ended_at?.toISOString?.() || String(updated.ended_at),
      });
    } catch (err) {
      logger.warn('Failed to publish subscription.canceled event', { error: err.message, userId });
    }

    logger.info('Subscription canceled due to refund', { userId });
    return updated;
  }

  // ─────────────────────── Promo Codes ───────────────────────

  /**
   * Create a new promo code (admin).
   */
  static async createPromoCode({ code, discount_type, discount_value, max_uses, applicable_tiers, min_duration_months, valid_until }) {
    const upperCode = code.toUpperCase().trim();

    const existing = await dbBreaker.fire(() => PromoCodeModel.findByCode(upperCode));
    if (existing) {
      throw new errors.ConflictError('Promo code already exists');
    }

    const data = {
      code: upperCode,
      discount_type,
      discount_value,
      max_uses: max_uses || 0,
      applicable_tiers: applicable_tiers && applicable_tiers.length > 0 ? applicable_tiers : null,
      min_duration_months: min_duration_months || 0,
      valid_from: new Date(),
      valid_until: valid_until ? new Date(valid_until) : null,
      active: true,
    };

    const promoCode = await dbBreaker.fire(() =>
      db.transaction(trx => PromoCodeModel.create(data, trx))
    );

    logger.info('Promo code created', { code: upperCode, discount_type, discount_value });

    return {
      success: true,
      promo_code: SubscriptionService._formatPromoCode(promoCode),
    };
  }

  /**
   * List promo codes (admin).
   */
  static async listPromoCodes({ page, limit, active_only }) {
    const result = await dbBreaker.fire(() =>
      PromoCodeModel.list({ page: page || 1, limit: limit || 20, activeOnly: active_only || false })
    );

    return {
      success: true,
      promo_codes: result.promo_codes.map(SubscriptionService._formatPromoCode),
      total: result.total,
    };
  }

  /**
   * Deactivate a promo code (admin).
   */
  static async deactivatePromoCode(code) {
    const upperCode = code.toUpperCase().trim();
    const existing = await dbBreaker.fire(() => PromoCodeModel.findByCode(upperCode));
    if (!existing) {
      throw new errors.ResourceNotFoundError('Promo code not found');
    }
    if (!existing.active) {
      throw new errors.ConflictError('Promo code is already deactivated');
    }

    await dbBreaker.fire(() =>
      db.transaction(trx => PromoCodeModel.deactivate(upperCode, trx))
    );

    logger.info('Promo code deactivated', { code: upperCode });

    return { success: true, message: 'Promo code deactivated' };
  }

  /**
   * Validate a promo code and calculate the discount for a given plan.
   */
  static async validatePromoCode(code, planType, durationMonths) {
    const planPrice = getPlanPrice(planType, durationMonths);
    if (planPrice === null) {
      throw new errors.InputValidationError('Invalid plan type or duration');
    }

    const result = await SubscriptionService._resolvePromoDiscount(code, planType, durationMonths, planPrice);

    return {
      success: true,
      valid: result.valid,
      discount_type: result.discount_type || '',
      discount_value: result.discount_value || 0,
      discount_amount_cents: result.discount_amount_cents || 0,
      final_price_cents: result.final_price_cents || planPrice,
      message: result.message,
    };
  }

  /**
   * Internal: resolve promo code and calculate discount.
   * Returns { valid, discount_type, discount_value, discount_amount_cents, final_price_cents, message }
   */
  static async _resolvePromoDiscount(code, planType, durationMonths, priceBeforePromo) {
    const upperCode = code.toUpperCase().trim();
    const promo = await dbBreaker.fire(() => PromoCodeModel.findByCode(upperCode));

    if (!promo) {
      return { valid: false, message: 'Promo code not found' };
    }
    if (!promo.active) {
      return { valid: false, message: 'Promo code is no longer active' };
    }
    if (promo.max_uses > 0 && promo.used_count >= promo.max_uses) {
      return { valid: false, message: 'Promo code has reached its maximum usage limit' };
    }
    if (promo.valid_until && new Date(promo.valid_until) < new Date()) {
      return { valid: false, message: 'Promo code has expired' };
    }
    if (promo.valid_from && new Date(promo.valid_from) > new Date()) {
      return { valid: false, message: 'Promo code is not yet valid' };
    }
    if (promo.applicable_tiers && promo.applicable_tiers.length > 0 && !promo.applicable_tiers.includes(planType)) {
      return { valid: false, message: 'Promo code is not applicable to this plan' };
    }
    if (promo.min_duration_months > 0 && durationMonths < promo.min_duration_months) {
      return { valid: false, message: `Promo code requires a minimum duration of ${promo.min_duration_months} months` };
    }

    let discountAmount;
    if (promo.discount_type === 'percentage') {
      discountAmount = Math.round(priceBeforePromo * promo.discount_value / 100);
    } else {
      discountAmount = promo.discount_value;
    }

    const finalPrice = Math.max(0, priceBeforePromo - discountAmount);

    return {
      valid: true,
      discount_type: promo.discount_type,
      discount_value: promo.discount_value,
      discount_amount_cents: discountAmount,
      final_price_cents: finalPrice,
      message: 'Promo code applied',
    };
  }

  /**
   * Internal: apply promo code during checkout. Throws on invalid.
   */
  static async _applyPromoCode(code, planType, durationMonths, priceBeforePromo) {
    const result = await SubscriptionService._resolvePromoDiscount(code, planType, durationMonths, priceBeforePromo);
    if (!result.valid) {
      throw new errors.InputValidationError(result.message);
    }
    return result;
  }

  /**
   * Format a promo code record for gRPC response.
   */
  static _formatPromoCode(p) {
    return {
      id: String(p.id),
      code: p.code,
      discount_type: p.discount_type,
      discount_value: p.discount_value,
      max_uses: p.max_uses,
      used_count: p.used_count,
      applicable_tiers: p.applicable_tiers || [],
      min_duration_months: p.min_duration_months,
      valid_from: p.valid_from?.toISOString?.() || String(p.valid_from || ''),
      valid_until: p.valid_until?.toISOString?.() || String(p.valid_until || ''),
      active: p.active,
      created_at: p.created_at?.toISOString?.() || String(p.created_at || ''),
      updated_at: p.updated_at?.toISOString?.() || String(p.updated_at || ''),
    };
  }

  /**
   * Format a subscription record for gRPC response.
   */
  static _formatSubscription(s) {
    return {
      id: String(s.id),
      user_id: String(s.user_id),
      sub_type: s.sub_type,
      free_trial: s.free_trial,
      status: s.status,
      started_at: s.started_at?.toISOString?.() || String(s.started_at || ''),
      ended_at: s.ended_at?.toISOString?.() || String(s.ended_at || ''),
      grace_period_end: s.grace_period_end?.toISOString?.() || String(s.grace_period_end || ''),
      issued_by: s.issued_by,
      created_at: s.created_at?.toISOString?.() || String(s.created_at || ''),
      updated_at: s.updated_at?.toISOString?.() || String(s.updated_at || ''),
    };
  }
}
