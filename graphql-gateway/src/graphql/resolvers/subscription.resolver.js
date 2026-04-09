import * as subscriptionGrpc from '../../grpc/clients/subscription-client.js';

function mapSubscription(s) {
  if (!s) return null;
  return {
    id: s.id,
    userId: s.user_id,
    subType: s.sub_type,
    freeTrial: s.free_trial,
    status: s.status,
    startedAt: s.started_at,
    endedAt: s.ended_at,
    gracePeriodEnd: s.grace_period_end,
    issuedBy: s.issued_by,
    createdAt: s.created_at,
    updatedAt: s.updated_at,
  };
}

function mapProration(p) {
  if (!p) return null;
  return {
    remainingDays: p.remaining_days,
    remainingValueCents: p.remaining_value_cents,
    newPlanPriceCents: p.new_plan_price_cents,
    discountCents: p.discount_cents,
    finalPriceCents: p.final_price_cents,
  };
}

function mapTierCount(tc) {
  if (!tc) return null;
  return {
    tier: tc.tier,
    count: tc.count,
  };
}

export const subscriptionResolvers = {
  Query: {
    async mySubscription(_, __, { token, userAgent }) {
      const res = await subscriptionGrpc.getSubscription({ access_token: token }, userAgent);
      return {
        success: res.success,
        subscription: mapSubscription(res.subscription),
      };
    },

    async subscriptionStats(_, __, { token, userAgent }) {
      const res = await subscriptionGrpc.getSubscriptionStats({ access_token: token }, userAgent);
      return {
        success: res.success,
        totalActive: res.total_active,
        totalExpired: res.total_expired,
        totalCanceled: res.total_canceled,
        totalTerminated: res.total_terminated,
        byTier: (res.by_tier || []).map(mapTierCount),
      };
    },

    async validatePromoCode(_, { code, planType, durationMonths }, { token, userAgent }) {
      const res = await subscriptionGrpc.validatePromoCode(
        { access_token: token, code, plan_type: planType, duration_months: durationMonths },
        userAgent,
      );
      return {
        success: res.success,
        valid: res.valid,
        discountType: res.discount_type,
        discountValue: res.discount_value,
        discountAmountCents: res.discount_amount_cents,
        finalPriceCents: res.final_price_cents,
        message: res.message,
      };
    },
  },

  Mutation: {
    async createCheckout(_, { planType, paymentMethod, durationMonths, promoCode }, { token, userAgent }) {
      const res = await subscriptionGrpc.createCheckout(
        {
          access_token: token,
          plan_type: planType,
          payment_method: paymentMethod,
          duration_months: durationMonths,
          promo_code: promoCode || '',
        },
        userAgent,
      );
      return {
        success: res.success,
        paymentUrl: res.payment_url,
        orderId: res.order_id,
        expiresIn: res.expires_in,
        proration: mapProration(res.proration),
      };
    },

    async cancelSubscription(_, __, { token, userAgent }) {
      const res = await subscriptionGrpc.cancelSubscription({ access_token: token }, userAgent);
      return {
        success: res.success,
        subscription: mapSubscription(res.subscription),
      };
    },

    async restoreSubscription(_, __, { token, userAgent }) {
      const res = await subscriptionGrpc.restoreSubscription({ access_token: token }, userAgent);
      return {
        success: res.success,
        subscription: mapSubscription(res.subscription),
      };
    },
  },
};
