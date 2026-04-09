import "dotenv/config";
import grpc from "@grpc/grpc-js";
import logger from "../utils/logger.util.js";
import { loadAdminProto } from "./loader.js";
import { AdminController } from "../controllers/index.js";

export const startGrpc = async () => {
  let proto;
  try {
    proto = loadAdminProto();
  } catch (err) {
    logger.error("Failed to load admin proto", { error: err.message, stack: err.stack });
    throw err;
  }
  const server = new grpc.Server();

  server.addService(proto.AdminService.service, {
    GetDashboardStats: AdminController.getDashboardStats.bind(AdminController),
    ListUsers: AdminController.listUsers.bind(AdminController),
    GetUser: AdminController.getUser.bind(AdminController),
    UpdateUserRole: AdminController.updateUserRole.bind(AdminController),
    BanUser: AdminController.banUser.bind(AdminController),
    UnbanUser: AdminController.unbanUser.bind(AdminController),
    CreateArticle: AdminController.createArticle.bind(AdminController),
    DeleteArticle: AdminController.deleteArticle.bind(AdminController),
    GetUploadUrl: AdminController.getUploadUrl.bind(AdminController),
    GetArticleStats: AdminController.getArticleStats.bind(AdminController),
    AdminSetSubscription: AdminController.adminSetSubscription.bind(AdminController),
    AdminRemoveSubscription: AdminController.adminRemoveSubscription.bind(AdminController),
    GetSubscriptionStats: AdminController.getSubscriptionStats.bind(AdminController),
    // Promo codes
    CreatePromoCode: AdminController.createPromoCode.bind(AdminController),
    ListPromoCodes: AdminController.listPromoCodes.bind(AdminController),
    DeactivatePromoCode: AdminController.deactivatePromoCode.bind(AdminController),
    // Notifications
    AdminSendNotification: AdminController.adminSendNotification.bind(AdminController),
    AdminSendBulkNotification: AdminController.adminSendBulkNotification.bind(AdminController),
  });

  const port = process.env.SERVICE_PORT || 50055;

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
