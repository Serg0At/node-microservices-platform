import crypto from 'crypto';
import config from '../config/variables.config.js';
import logger from '../utils/logger.util.js';

const { CRYPTOMUS } = config;
const { WEBHOOK } = config;

/**
 * Generate Cryptomus signature for outgoing requests.
 */
const generateCryptomusSign = (body) => {
  return crypto
    .createHash('md5')
    .update(Buffer.from(JSON.stringify(body)).toString('base64') + CRYPTOMUS.API_KEY)
    .digest('hex');
};

/**
 * Sort object keys alphabetically (for webhook validation).
 */
const sortObjectKeys = (obj) => {
  return Object.keys(obj).sort().reduce((sorted, key) => {
    sorted[key] = obj[key];
    return sorted;
  }, {});
};

/**
 * Validate incoming Cryptomus webhook signature.
 * Cryptomus signs with MD5 of base64(sorted JSON body) + API_KEY.
 */
export const validateWebhook = (body, headers) => {
  const sign = headers['sign'];
  if (!sign) {
    throw new Error('Missing Cryptomus signature header');
  }

  const hash = crypto
    .createHash('md5')
    .update(Buffer.from(JSON.stringify(sortObjectKeys(body))).toString('base64') + CRYPTOMUS.API_KEY)
    .digest('hex');

  if (hash !== sign) {
    throw new Error('Invalid Cryptomus signature');
  }

  return true;
};

/**
 * Map Cryptomus status to internal status.
 */
export const mapStatus = (cryptomusStatus) => {
  const statusMap = {
    paid: 'succeeded',
    paid_over: 'succeeded',
    wrong_amount: 'failed',
    cancel: 'failed',
    fail: 'failed',
  };

  return statusMap[cryptomusStatus] || null;
};

/**
 * Determine the RabbitMQ event routing key from internal status.
 */
export const mapEventKey = (internalStatus) => {
  const eventMap = {
    succeeded: 'payment.succeeded',
    failed: 'payment.failed',
  };

  return eventMap[internalStatus] || null;
};

/**
 * Create a Cryptomus payment invoice.
 */
export const createPayment = async ({ amount, orderId }) => {
  const body = {
    amount: (amount / 100).toFixed(2),
    currency: 'USD',
    order_id: orderId,
    url_callback: `${WEBHOOK.BASE_URL}/webhook/cryptomus`,
    url_return: `${WEBHOOK.FRONTEND_SUCCESS_URL}`,
    lifetime: CRYPTOMUS.PAYMENT_LIFETIME,
  };

  const response = await fetch('https://api.cryptomus.com/v1/payment', {
    method: 'POST',
    headers: {
      'merchant': CRYPTOMUS.MERCHANT_ID,
      'sign': generateCryptomusSign(body),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    logger.error('Cryptomus API error', { status: response.status, body: errorText });
    throw new Error(`Cryptomus API error: ${response.status}`);
  }

  const data = await response.json();

  if (!data.result || !data.result.url) {
    logger.error('Cryptomus invalid response', { data });
    throw new Error('Cryptomus returned invalid response');
  }

  return {
    paymentUrl: data.result.url,
    providerPaymentId: data.result.uuid,
    orderId: data.result.order_id,
    expiresIn: CRYPTOMUS.PAYMENT_LIFETIME,
  };
};
