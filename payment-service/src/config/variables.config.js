import 'dotenv/config';

const config = {
  /* =========================
     SERVER
  ========================= */
  SERVER: {
    NAME: process.env.SERVICE_NAME || 'payment-service',
    ENV: process.env.SERVICE_ENV || 'production',
    PORT: Number(process.env.SERVICE_PORT) || 50057,
    HTTP_PORT: Number(process.env.WEBHOOK_HTTP_PORT) || 3001,
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
      IDEMPOTENCY: Number(process.env.REDIS_IDEMPOTENCY_TTL || 86400),
    },
  },

  /* =========================
     RABBITMQ
  ========================= */
  RABBITMQ: {
    EXCHANGE: {
      NAME: process.env.RMQ_EXCHANGE || 'payment-events',
      TYPE: process.env.RMQ_EXCHANGE_TYPE || 'topic',
    },

    RETRY: {
      MAX_RETRIES: Number(process.env.RMQ_MAX_RETRIES || 3),
      RETRY_DELAY: Number(process.env.RMQ_RETRY_DELAY || 5000),
      RECONNECT_INTERVAL: Number(process.env.RMQ_RECONNECT_INTERVAL || 3000),
    },
  },

  /* =========================
     CRYPTOMUS
  ========================= */
  CRYPTOMUS: {
    MERCHANT_ID: process.env.CRYPTOMUS_MERCHANT_ID,
    API_KEY: process.env.CRYPTOMUS_API_KEY,
    PAYMENT_LIFETIME: Number(process.env.CRYPTOMUS_PAYMENT_LIFETIME || 3600),
  },

  /* =========================
     FONDY
  ========================= */
  FONDY: {
    MERCHANT_ID: process.env.FONDY_MERCHANT_ID,
    MERCHANT_PASSWORD: process.env.FONDY_MERCHANT_PASSWORD,
    PAYMENT_LIFETIME: Number(process.env.FONDY_PAYMENT_LIFETIME || 3600),
  },

  /* =========================
     WEBHOOK
  ========================= */
  WEBHOOK: {
    BASE_URL: process.env.WEBHOOK_BASE_URL || 'https://arbex.io',
    FRONTEND_SUCCESS_URL: process.env.FRONTEND_SUCCESS_URL || 'https://arbex.io/subscription/success',
    FRONTEND_CANCEL_URL: process.env.FRONTEND_CANCEL_URL || 'https://arbex.io/subscription/cancel',
  },

  /* =========================
     gRPC
  ========================= */
  GRPC: {
    MAX_MESSAGE_SIZE: Number(process.env.GRPC_MAX_MESSAGE_SIZE || 4 * 1024 * 1024),
  },
};

export default config;
