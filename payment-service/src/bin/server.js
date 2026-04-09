import "dotenv/config";
import grpc from "@grpc/grpc-js";
import logger from "../utils/logger.util.js";
import { loadPaymentProto } from "./loader.js";
import { PaymentController } from "../controllers/index.js";

export const startGrpc = async () => {
  let proto;
  try {
    proto = loadPaymentProto();
  } catch (err) {
    logger.error("Failed to load payment proto", { error: err.message, stack: err.stack });
    throw err;
  }
  const server = new grpc.Server();

  server.addService(proto.PaymentService.service, {
    CreatePayment: PaymentController.createPayment.bind(PaymentController),
    GetTransaction: PaymentController.getTransaction.bind(PaymentController),
    ListTransactions: PaymentController.listTransactions.bind(PaymentController),
  });

  const port = process.env.SERVICE_PORT || 50057;

  await new Promise((res, rej) =>
    server.bindAsync(
      `0.0.0.0:${port}`,
      grpc.ServerCredentials.createInsecure(),
      (err) => {
        if (err) return rej(err);
        logger.info(`gRPC server started on ${port}`);
        res();
      }
    )
  );

  const shutdown = () => {
    logger.info("gRPC shutdown signal received");
    server.tryShutdown((err) => {
      if (err) {
        logger.error("gRPC force shutdown due to errors", { error: err.message, stack: err.stack });
        server.forceShutdown();
        process.exit(1);
      } else {
        logger.info("gRPC graceful shutdown completed");
        process.exit(0);
      }
    });
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
};
