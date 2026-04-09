import { TransactionModel } from '../models/index.js';
import * as cryptomusProvider from '../providers/cryptomus.provider.js';
import * as fondyProvider from '../providers/fondy.provider.js';
import { publishEvent } from '../rabbit/publisher.js';
import { checkAndSetIdempotency, removeIdempotency } from '../redis/idempotencyCache.js';
import { dbBreaker, redisBreaker, rabbitBreaker, providerBreaker } from '../utils/circuit-breaker.util.js';
import ErrorHandler from '../utils/error-handler.util.js';
import logger from '../utils/logger.util.js';

const providers = {
  crypto: cryptomusProvider,
  card: fondyProvider,
};

const providerNames = {
  crypto: 'cryptomus',
  card: 'fondy',
};

export default class PaymentService {
  /**
   * Create a payment via Cryptomus (crypto) or Fondy (card).
   */
  static async createPayment({ user_id, plan_type, payment_method, currency, amount, duration_months, order_id }) {
    const provider = providers[payment_method];
    if (!provider) {
      throw new ErrorHandler.errors.InputValidationError(`Unsupported payment method: ${payment_method}`);
    }

    const providerName = providerNames[payment_method];

    // Create transaction record in DB
    const transaction = await dbBreaker.fire(async () => {
      return TransactionModel.create({
        user_id,
        provider: providerName,
        provider_order_id: order_id,
        amount,
        currency: currency || 'USD',
        status: 'pending',
        plan_type,
        duration_months: duration_months || 1,
      });
    });

    // Create payment with provider
    let providerResult;
    try {
      providerResult = await providerBreaker.fire(async () => {
        return provider.createPayment({
          amount,
          orderId: order_id,
          planType: plan_type,
          durationMonths: duration_months || 1,
        });
      });
    } catch (err) {
      // Update transaction to failed if provider call fails
      await dbBreaker.fire(async () => {
        return TransactionModel.updateStatus(transaction.id, 'failed', {
          metadata: { error: err.message },
        });
      });
      throw err;
    }

    // Update transaction with provider payment ID if available
    if (providerResult.providerPaymentId) {
      await dbBreaker.fire(async () => {
        return TransactionModel.updateByProviderOrderId(order_id, {
          provider_payment_id: providerResult.providerPaymentId,
        });
      });
    }

    return {
      success: true,
      payment_url: providerResult.paymentUrl,
      order_id: providerResult.orderId,
      expires_in: providerResult.expiresIn,
    };
  }

  /**
   * Get a single transaction by ID.
   */
  static async getTransaction(id) {
    const transaction = await dbBreaker.fire(async () => {
      return TransactionModel.findById(id);
    });

    if (!transaction) {
      throw new ErrorHandler.errors.ResourceNotFoundError('Transaction not found');
    }

    return {
      success: true,
      transaction: PaymentService._formatTransaction(transaction),
    };
  }

  /**
   * List transactions for a user with optional status filter and pagination.
   */
  static async listTransactions({ user_id, status, page = 1, limit = 20 }) {
    const offset = (page - 1) * limit;

    const [transactions, total] = await dbBreaker.fire(async () => {
      return Promise.all([
        TransactionModel.findByUserId(user_id, { limit, offset, status: status || undefined }),
        TransactionModel.countByUserId(user_id, { status: status || undefined }),
      ]);
    });

    return {
      success: true,
      transactions: transactions.map(PaymentService._formatTransaction),
      total,
    };
  }

  /**
   * Process Cryptomus webhook.
   */
  static async processCryptomusWebhook(body, headers) {
    // Validate signature
    cryptomusProvider.validateWebhook(body, headers);

    const orderId = body.order_id;
    const providerStatus = body.status;

    logger.info('Processing Cryptomus webhook', { orderId, providerStatus });

    // Map provider status to internal status
    const internalStatus = cryptomusProvider.mapStatus(providerStatus);
    if (!internalStatus) {
      logger.warn('Unknown Cryptomus status, ignoring', { orderId, providerStatus });
      return;
    }

    // Idempotency check
    const isDuplicate = await redisBreaker.fire(async () => {
      return checkAndSetIdempotency(orderId);
    });

    if (isDuplicate) return;

    // Find and update transaction
    const transaction = await dbBreaker.fire(async () => {
      return TransactionModel.findByProviderOrderId(orderId);
    });

    if (!transaction) {
      logger.error('Transaction not found for Cryptomus webhook', { orderId });
      await redisBreaker.fire(async () => removeIdempotency(orderId));
      return;
    }

    // Skip if already in a terminal state
    if (['succeeded', 'failed', 'refunded', 'expired'].includes(transaction.status)) {
      logger.warn('Transaction already in terminal state', { orderId, currentStatus: transaction.status });
      return;
    }

    const updateData = {
      status: internalStatus,
      provider_payment_id: body.uuid || transaction.provider_payment_id,
    };

    if (body.payer_currency) {
      updateData.crypto_currency = body.payer_currency;
    }
    if (body.payer_amount) {
      updateData.crypto_amount = body.payer_amount;
    }

    const updated = await dbBreaker.fire(async () => {
      return TransactionModel.updateByProviderOrderId(orderId, updateData);
    });

    // Publish event
    const eventKey = cryptomusProvider.mapEventKey(internalStatus);
    if (eventKey) {
      const eventPayload = PaymentService._buildEventPayload(eventKey, updated, body);
      await rabbitBreaker.fire(async () => {
        return publishEvent(eventKey, eventPayload);
      });
    }

    logger.info('Cryptomus webhook processed', { orderId, internalStatus });
  }

  /**
   * Process Fondy webhook.
   */
  static async processFondyWebhook(body) {
    const data = body.response || body;

    // Validate signature
    fondyProvider.validateWebhook(data);

    const orderId = data.order_id;
    const providerStatus = data.order_status;

    logger.info('Processing Fondy webhook', { orderId, providerStatus });

    // Map provider status to internal status
    const internalStatus = fondyProvider.mapStatus(providerStatus);
    if (!internalStatus) {
      logger.warn('Unknown Fondy status, ignoring', { orderId, providerStatus });
      return;
    }

    // Idempotency check
    const isDuplicate = await redisBreaker.fire(async () => {
      return checkAndSetIdempotency(orderId);
    });

    if (isDuplicate) return;

    // Find and update transaction
    const transaction = await dbBreaker.fire(async () => {
      return TransactionModel.findByProviderOrderId(orderId);
    });

    if (!transaction) {
      logger.error('Transaction not found for Fondy webhook', { orderId });
      await redisBreaker.fire(async () => removeIdempotency(orderId));
      return;
    }

    // Skip if already in a terminal state
    if (['succeeded', 'failed', 'refunded', 'expired'].includes(transaction.status)) {
      logger.warn('Transaction already in terminal state', { orderId, currentStatus: transaction.status });
      return;
    }

    const updateData = {
      status: internalStatus,
      provider_payment_id: data.payment_id ? String(data.payment_id) : transaction.provider_payment_id,
    };

    const updated = await dbBreaker.fire(async () => {
      return TransactionModel.updateByProviderOrderId(orderId, updateData);
    });

    // Publish event
    const eventKey = fondyProvider.mapEventKey(internalStatus);
    if (eventKey) {
      const eventPayload = PaymentService._buildEventPayload(eventKey, updated, data);
      await rabbitBreaker.fire(async () => {
        return publishEvent(eventKey, eventPayload);
      });
    }

    logger.info('Fondy webhook processed', { orderId, internalStatus });
  }

  /**
   * Build RabbitMQ event payload based on routing key.
   */
  static _buildEventPayload(eventKey, transaction, rawData) {
    const base = {
      user_id: String(transaction.user_id),
      plan_type: transaction.plan_type,
      provider: transaction.provider,
      order_id: transaction.provider_order_id,
    };

    switch (eventKey) {
      case 'payment.succeeded':
        return {
          ...base,
          duration_months: transaction.duration_months,
          amount: transaction.amount,
          currency: transaction.currency,
          transaction_id: String(transaction.id),
        };

      case 'payment.failed':
        return {
          ...base,
          error_reason: rawData.error_message || rawData.status || 'unknown',
        };

      case 'payment.refunded':
        return {
          ...base,
          amount: transaction.amount,
          transaction_id: String(transaction.id),
        };

      default:
        return base;
    }
  }

  /**
   * Format a transaction row for gRPC response.
   */
  static _formatTransaction(tx) {
    return {
      id: String(tx.id),
      user_id: String(tx.user_id),
      provider: tx.provider,
      provider_order_id: tx.provider_order_id,
      amount: tx.amount,
      currency: tx.currency,
      status: tx.status,
      plan_type: tx.plan_type,
      duration_months: tx.duration_months,
      created_at: tx.created_at ? tx.created_at.toISOString() : '',
      updated_at: tx.updated_at ? tx.updated_at.toISOString() : '',
    };
  }
}
