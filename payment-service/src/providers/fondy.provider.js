import crypto from 'crypto';
import config from '../config/variables.config.js';
import logger from '../utils/logger.util.js';

const { FONDY } = config;
const { WEBHOOK } = config;

const planNames = { 1: 'Lite', 2: 'Standard', 3: 'PRO' };
const durationLabels = { 1: '1 Month', 3: '3 Months', 6: '6 Months', 12: '1 Year' };

/**
 * Generate Fondy signature.
 */
const generateFondySignature = (params) => {
  const sorted = Object.keys(params)
    .filter(k => params[k] !== '' && params[k] !== undefined)
    .sort()
    .map(k => params[k])
    .join('|');

  return crypto
    .createHash('sha1')
    .update(FONDY.MERCHANT_PASSWORD + '|' + sorted)
    .digest('hex');
};

/**
 * Validate incoming Fondy webhook signature.
 */
export const validateWebhook = (data) => {
  const sorted = Object.keys(data)
    .filter(k => k !== 'signature' && k !== 'response_signature_string' && data[k] !== '' && data[k] !== undefined)
    .sort()
    .map(k => data[k])
    .join('|');

  const expected = crypto
    .createHash('sha1')
    .update(FONDY.MERCHANT_PASSWORD + '|' + sorted)
    .digest('hex');

  if (expected !== data.signature) {
    throw new Error('Invalid Fondy signature');
  }

  return true;
};

/**
 * Map Fondy status to internal status.
 */
export const mapStatus = (fondyStatus) => {
  const statusMap = {
    approved: 'succeeded',
    declined: 'failed',
    expired: 'expired',
    reversed: 'refunded',
  };

  return statusMap[fondyStatus] || null;
};

/**
 * Determine the RabbitMQ event routing key from internal status.
 */
export const mapEventKey = (internalStatus) => {
  const eventMap = {
    succeeded: 'payment.succeeded',
    failed: 'payment.failed',
    expired: 'payment.failed',
    refunded: 'payment.refunded',
  };

  return eventMap[internalStatus] || null;
};

/**
 * Create a Fondy checkout session.
 */
export const createPayment = async ({ amount, orderId, planType, durationMonths }) => {
  const params = {
    order_id: orderId,
    merchant_id: FONDY.MERCHANT_ID,
    order_desc: `Arbex ${planNames[planType] || 'Plan'} — ${durationLabels[durationMonths] || `${durationMonths} Month(s)`}`,
    amount: amount.toString(),
    currency: 'USD',
    server_callback_url: `${WEBHOOK.BASE_URL}/webhook/fondy`,
    response_url: WEBHOOK.FRONTEND_SUCCESS_URL,
    lang: 'en',
    lifetime: FONDY.PAYMENT_LIFETIME,
  };

  params.signature = generateFondySignature(params);

  const response = await fetch('https://pay.fondy.eu/api/checkout/url/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ request: params }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    logger.error('Fondy API error', { status: response.status, body: errorText });
    throw new Error(`Fondy API error: ${response.status}`);
  }

  const data = await response.json();

  if (!data.response || !data.response.checkout_url) {
    logger.error('Fondy invalid response', { data });
    throw new Error('Fondy returned invalid response');
  }

  return {
    paymentUrl: data.response.checkout_url,
    providerPaymentId: null,
    orderId,
    expiresIn: FONDY.PAYMENT_LIFETIME,
  };
};
