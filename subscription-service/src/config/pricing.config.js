import 'dotenv/config';

/**
 * Plan pricing loaded from environment variables.
 * All values in cents.
 *
 * Sub types: 0=None, 1=Lite, 2=Standard, 3=PRO
 * Duration keys: 1, 3, 6, 12 (months)
 */
const pricing = {
  currency: process.env.PLAN_CURRENCY || 'USD',

  plans: {
    1: { // Lite
      1:  Number(process.env.PLAN_LITE_PRICE_1M || 999),
      3:  Number(process.env.PLAN_LITE_PRICE_3M || 2697),
      6:  Number(process.env.PLAN_LITE_PRICE_6M || 4794),
      12: Number(process.env.PLAN_LITE_PRICE_12M || 8388),
    },
    2: { // Standard
      1:  Number(process.env.PLAN_STANDARD_PRICE_1M || 1999),
      3:  Number(process.env.PLAN_STANDARD_PRICE_3M || 5397),
      6:  Number(process.env.PLAN_STANDARD_PRICE_6M || 9594),
      12: Number(process.env.PLAN_STANDARD_PRICE_12M || 16790),
    },
    3: { // PRO
      1:  Number(process.env.PLAN_PRO_PRICE_1M || 3999),
      3:  Number(process.env.PLAN_PRO_PRICE_3M || 10797),
      6:  Number(process.env.PLAN_PRO_PRICE_6M || 19194),
      12: Number(process.env.PLAN_PRO_PRICE_12M || 33590),
    },
  },

  discounts: {
    3:  Number(process.env.PLAN_DISCOUNT_3M || 10),
    6:  Number(process.env.PLAN_DISCOUNT_6M || 20),
    12: Number(process.env.PLAN_DISCOUNT_12M || 30),
  },
};

/**
 * Get the price in cents for a given plan type and duration.
 * @param {number} planType - 1=Lite, 2=Standard, 3=PRO
 * @param {number} durationMonths - 1, 3, 6, or 12
 * @returns {number|null} Price in cents or null if invalid
 */
export const getPlanPrice = (planType, durationMonths) => {
  const plan = pricing.plans[planType];
  if (!plan) return null;
  const price = plan[durationMonths];
  return price !== undefined ? price : null;
};

/**
 * Get the monthly base price for proration calculations.
 * @param {number} planType - 1=Lite, 2=Standard, 3=PRO
 * @returns {number|null} Monthly price in cents or null if invalid
 */
export const getMonthlyPrice = (planType) => {
  const plan = pricing.plans[planType];
  if (!plan) return null;
  return plan[1];
};

export default pricing;
