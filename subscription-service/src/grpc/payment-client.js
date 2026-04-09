import grpc from '@grpc/grpc-js';
import protoLoader from '@grpc/proto-loader';
import path from 'path';
import { fileURLToPath } from 'url';
import config from '../config/variables.config.js';
import logger from '../utils/logger.util.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let paymentClient = null;

const getPaymentClient = () => {
  if (paymentClient) return paymentClient;

  const protoPath = config.PAYMENT_SERVICE.PROTO_PATH
    || path.join(__dirname, '../../../payment-service/proto/payment.proto');

  const pkgDef = protoLoader.loadSync(protoPath, {
    keepCase: true,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true,
  });

  const paymentProto = grpc.loadPackageDefinition(pkgDef).payment;

  const host = config.PAYMENT_SERVICE.HOST;
  const port = config.PAYMENT_SERVICE.PORT;

  paymentClient = new paymentProto.PaymentService(
    `${host}:${port}`,
    grpc.credentials.createInsecure()
  );

  logger.info('Payment gRPC client initialized', { host, port });
  return paymentClient;
};

/**
 * Call payment service to create a payment.
 * @param {object} params - { user_id, plan_type, payment_method, currency, amount, duration_months, order_id }
 * @returns {Promise<object>} Payment service response
 */
export const createPayment = (params) => {
  return new Promise((resolve, reject) => {
    const client = getPaymentClient();

    client.CreatePayment(params, { deadline: new Date(Date.now() + 10000) }, (err, response) => {
      if (err) {
        logger.error('Payment gRPC call failed', { error: err.message, code: err.code });
        return reject(err);
      }
      resolve(response);
    });
  });
};
