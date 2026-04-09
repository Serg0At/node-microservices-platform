import { readFileSync } from 'fs';

const env = process.env;

export const config = {
  port: parseInt(env.SERVICE_PORT || '4000', 10),
  env: env.SERVICE_ENV || 'development',

  grpc: {
    authServiceUrl: env.AUTH_SERVICE_URL || 'localhost:50051',
    userServiceUrl: env.USER_SERVICE_URL || 'localhost:50052',
    notificationServiceUrl: env.NOTIFICATION_SERVICE_URL || 'localhost:50053',
    newsServiceUrl: env.NEWS_SERVICE_URL || 'localhost:50054',
    adminServiceUrl: env.ADMIN_SERVICE_URL || 'localhost:50055',
    subscriptionServiceUrl: env.SUBSCRIPTION_SERVICE_URL || 'localhost:50056',
  },

  jwt: {
    publicKey: readFileSync(env.JWT_ACCESS_PUBLIC_KEY_PATH || './keys/access_public.pem', 'utf8'),
    algorithm: env.JWT_ACCESS_ALG || 'RS256',
    audience: env.JWT_AUDIENCE || 'graphql-gateway',
    issuer: env.JWT_ISSUER || 'auth-service',
  },

  rateLimit: {
    windowMs: parseInt(env.RATE_LIMIT_WINDOW_MS || '60000', 10),
    max: parseInt(env.RATE_LIMIT_MAX || '100', 10),
  },

  cors: {
    origin: env.CORS_ORIGIN || 'http://localhost:3000',
  },
};
