import 'dotenv/config';

const config = {
  /* =========================
     SERVER
  ========================= */
  SERVER: {
    NAME: process.env.SERVICE_NAME || 'admin-service',
    ENV: process.env.SERVICE_ENV || 'production',
    PORT: Number(process.env.SERVICE_PORT) || 50055,
    LOG_LEVEL: process.env.SERVICE_LOG_LEVEL || 'info',
  },

  /* =========================
     POSTGRESQL
  ========================= */
  PSQL: {
    HOST: process.env.PSQL_HOST,
    PORT: Number(process.env.PSQL_PORT || 5432),
    USER: process.env.PSQL_USER,
    DATABASE: process.env.PSQL_DATABASE,
    PASSWORD: process.env.PSQL_PASSWORD,
    SSL: process.env.PSQL_SSL === 'true'
      ? { rejectUnauthorized: process.env.NODE_ENV !== 'development' }
      : false,
  },

  /* =========================
     REDIS
  ========================= */
  REDIS: {
    URL: process.env.REDIS_URL,
    HOST: process.env.REDIS_HOST,
    PORT: Number(process.env.REDIS_PORT || 6379),
    PASSWORD: process.env.REDIS_PASSWORD && process.env.REDIS_PASSWORD !== '0' ? process.env.REDIS_PASSWORD : null,
    DB: Number(process.env.REDIS_DB || 0),

    TTL: {
      DASHBOARD_STATS: Number(process.env.REDIS_DASHBOARD_STATS_TTL || 60),
    },
  },

  /* =========================
     JWT (public key only)
  ========================= */
  TOKENS: {
    ACCESS: {
      ALG: process.env.JWT_ACCESS_ALG || 'RS256',
      PUBLIC_KEY_PATH: process.env.JWT_ACCESS_PUBLIC_KEY_PATH,
    },
  },

  /* =========================
     gRPC
  ========================= */
  GRPC: {
    MAX_MESSAGE_SIZE: Number(process.env.GRPC_MAX_MESSAGE_SIZE || 4 * 1024 * 1024),
    NEWS_SERVICE_URL: process.env.NEWS_SERVICE_URL || 'localhost:50054',
    NOTIFICATION_SERVICE_URL: process.env.NOTIFICATION_SERVICE_URL || 'localhost:50053',
    SUBSCRIPTION_SERVICE_URL: process.env.SUBSCRIPTION_SERVICE_URL || 'localhost:50056',
  },
};

export default config;
