import "dotenv/config";
import grpc from "@grpc/grpc-js";
import logger from "../utils/logger.util.js";
import { loadSubscriptionProto } from "./loader.js";
import { SubscriptionController } from "../controllers/index.js";

export const startGrpc = async () => {
  let proto;
  try {
    proto = loadSubscriptionProto();
  } catch (err) {
    logger.error("Failed to load subscription proto", { error: err.message, stack: err.stack });
    throw err;
  }
  const server = new grpc.Server();

  server.addService(proto.SubscriptionService.service, {
    GetSubscription: SubscriptionController.getSubscription.bind(SubscriptionController),
    CheckAccess: SubscriptionController.checkAccess.bind(SubscriptionController),
    CreateCheckout: SubscriptionController.createCheckout.bind(SubscriptionController),
    CancelSubscription: SubscriptionController.cancelSubscription.bind(SubscriptionController),
    RestoreSubscription: SubscriptionController.restoreSubscription.bind(SubscriptionController),
    AdminSetSubscription: SubscriptionController.adminSetSubscription.bind(SubscriptionController),
    AdminRemoveSubscription: SubscriptionController.adminRemoveSubscription.bind(SubscriptionController),
    GetSubscriptionStats: SubscriptionController.getSubscriptionStats.bind(SubscriptionController),
    // Promo codes
    CreatePromoCode: SubscriptionController.createPromoCode.bind(SubscriptionController),
    ListPromoCodes: SubscriptionController.listPromoCodes.bind(SubscriptionController),
    DeactivatePromoCode: SubscriptionController.deactivatePromoCode.bind(SubscriptionController),
    ValidatePromoCode: SubscriptionController.validatePromoCode.bind(SubscriptionController),
  });

  const port = process.env.SERVICE_PORT || 50056;

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
