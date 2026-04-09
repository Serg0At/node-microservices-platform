import "dotenv/config";
import grpc from "@grpc/grpc-js";
import logger from "../utils/logger.util.js";
import { loadAuthProto } from "./loader.js";
import { AuthController, OAuthController } from "../controllers/index.js";

export const startGrpc = async () => {
  let proto;
  try {
    proto = loadAuthProto();
  } catch (err) {
    logger.error("Failed to load auth proto", { error: err.message, stack: err.stack });
    throw err;
  }
  const server = new grpc.Server();

  server.addService(proto.AuthService.service, {
    RegisterUser: AuthController.registerUser.bind(AuthController),
    LoginUser: AuthController.loginUser.bind(AuthController),
    VerifyEmail: AuthController.verifyEmail.bind(AuthController),
    OIDCLogin: OAuthController.oidcLogin.bind(OAuthController),
    RefreshTokens: AuthController.refreshTokens.bind(AuthController),
    ForgotPassword: AuthController.forgotPassword.bind(AuthController),
    VerifyResetCode: AuthController.verifyResetCode.bind(AuthController),
    ResetPassword: AuthController.resetPassword.bind(AuthController),
    RequestPasswordChange: AuthController.requestPasswordChange.bind(AuthController),
    ConfirmPasswordChange: AuthController.confirmPasswordChange.bind(AuthController),
    Setup2FA: AuthController.setup2FA.bind(AuthController),
    Verify2FA: AuthController.verify2FA.bind(AuthController),
    Logout: AuthController.logout.bind(AuthController),
    GetUserById: AuthController.getUserById.bind(AuthController),
  });

  const port = process.env.SERVICE_PORT || 50051;

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
        process.exit(1)
      } else {
        logger.info("gRPC graceful shutdown completed");
        process.exit(0)
      }
    });
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
};

export { startGrpc as startGrpcServer };
