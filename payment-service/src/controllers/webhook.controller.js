import PaymentService from '../services/payment.service.js';
import logger from '../utils/logger.util.js';

export default class WebhookController {
  /**
   * POST /webhook/cryptomus
   */
  static async handleCryptomus(req, res) {
    try {
      await PaymentService.processCryptomusWebhook(req.body, req.headers);
      res.status(200).json({ success: true });
    } catch (error) {
      logger.error('Cryptomus webhook error', { error: error.message, stack: error.stack });
      // Always return 200 to avoid provider retries on signature/validation errors
      res.status(200).json({ success: false, error: error.message });
    }
  }

  /**
   * POST /webhook/fondy
   */
  static async handleFondy(req, res) {
    try {
      await PaymentService.processFondyWebhook(req.body);
      res.status(200).json({ success: true });
    } catch (error) {
      logger.error('Fondy webhook error', { error: error.message, stack: error.stack });
      // Always return 200 to avoid provider retries on signature/validation errors
      res.status(200).json({ success: false, error: error.message });
    }
  }
}
