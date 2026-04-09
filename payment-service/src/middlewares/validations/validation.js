import { PaymentSchemas } from './schemas/index.js';

const schemas = new PaymentSchemas();

export default class Validation {
  static validateCreatePayment(data) {
    return schemas.CreatePaymentScheme.validate(data, { abortEarly: false });
  }

  static validateGetTransaction(data) {
    return schemas.GetTransactionScheme.validate(data, { abortEarly: false });
  }

  static validateListTransactions(data) {
    return schemas.ListTransactionsScheme.validate(data, { abortEarly: false });
  }
}
