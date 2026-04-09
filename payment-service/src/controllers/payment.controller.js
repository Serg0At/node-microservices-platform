import PaymentService from '../services/payment.service.js';
import { SuccessHandler, ErrorHandler } from '../utils/index.js';
import { Validation } from '../middlewares/validations/index.js';

export default class PaymentController {
  static async createPayment(call, callback) {
    const meta = { method: 'CreatePayment' };
    try {
      const { user_id, plan_type, payment_method, currency, amount, duration_months, order_id } = call.request;

      const { error: validationError } = Validation.validateCreatePayment({
        user_id, plan_type, payment_method, currency, amount, duration_months, order_id,
      });
      if (validationError) {
        return ErrorHandler.invalidArgument(callback, validationError.details.map(d => d.message).join('; '), meta);
      }

      const result = await PaymentService.createPayment({
        user_id, plan_type, payment_method, currency, amount, duration_months, order_id,
      });

      SuccessHandler.paymentCreated(callback, result, { ...meta, orderId: order_id, provider: payment_method });
    } catch (error) {
      ErrorHandler.handle(callback, error, meta);
    }
  }

  static async getTransaction(call, callback) {
    const meta = { method: 'GetTransaction' };
    try {
      const { access_token, id } = call.request;

      const { error: validationError } = Validation.validateGetTransaction({ access_token, id });
      if (validationError) {
        return ErrorHandler.invalidArgument(callback, validationError.details.map(d => d.message).join('; '), meta);
      }

      const result = await PaymentService.getTransaction(id);

      SuccessHandler.ok(callback, result, { ...meta, transactionId: id });
    } catch (error) {
      ErrorHandler.handle(callback, error, meta);
    }
  }

  static async listTransactions(call, callback) {
    const meta = { method: 'ListTransactions' };
    try {
      const { access_token, user_id, status, page, limit } = call.request;

      const { error: validationError } = Validation.validateListTransactions({
        access_token, user_id, status, page, limit,
      });
      if (validationError) {
        return ErrorHandler.invalidArgument(callback, validationError.details.map(d => d.message).join('; '), meta);
      }

      const result = await PaymentService.listTransactions({ user_id, status, page, limit });

      SuccessHandler.ok(callback, result, { ...meta, userId: user_id });
    } catch (error) {
      ErrorHandler.handle(callback, error, meta);
    }
  }
}
