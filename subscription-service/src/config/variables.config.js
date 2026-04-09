import 'dotenv/config';

const config = {
  /* =========================
     SERVER
  ========================= */
  SERVER: {
    NAME: process.env.SERVICE_NAME || 'subscription-service',
    ENV: process.env.SERVICE_ENV || 'production',
    PORT: Number(process.env.SERVICE_PORT) || 50056,
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
      SUBSCRIPTION: Number(process.env.REDIS_SUBSCRIPTION_TTL || 300),
      STATS: Number(process.env.REDIS_STATS_TTL || 600),
    },
  },

  /* =========================
     RABBITMQ
  ========================= */
  RABBITMQ: {
    HOST: process.env.RABBITMQ_HOST,
    PORT: Number(process.env.RABBITMQ_PORT || 5672),
    USER: process.env.RABBITMQ_USER,
    PASSWORD: process.env.RABBITMQ_PASSWORD,

    AUTH_EXCHANGE: {
      NAME: process.env.RMQ_AUTH_EXCHANGE || 'auth-events',
      TYPE: process.env.RMQ_EXCHANGE_TYPE || 'topic',
    },

    PAYMENT_EXCHANGE: {
      NAME: process.env.RMQ_PAYMENT_EXCHANGE || 'payment-events',
      TYPE: process.env.RMQ_EXCHANGE_TYPE || 'topic',
    },

    PUBLISH_EXCHANGE: {
      NAME: process.env.RMQ_PUBLISH_EXCHANGE || 'subscription-events',
      TYPE: process.env.RMQ_EXCHANGE_TYPE || 'topic',
    },

    AUTH_QUEUE: {
      NAME: process.env.RMQ_AUTH_QUEUE || 'subscription-service.auth.queue',
      BIND_PATTERN: process.env.RMQ_AUTH_BIND_PATTERN || 'user.registered',
    },

    PAYMENT_QUEUE: {
      NAME: process.env.RMQ_PAYMENT_QUEUE || 'subscription-service.payment.queue',
      BIND_PATTERN: process.env.RMQ_PAYMENT_BIND_PATTERN || 'payment.*',
    },

    PREFETCH: Number(process.env.RMQ_PREFETCH || 10),

    RETRY: {
      MAX_RETRIES: Number(process.env.RMQ_MAX_RETRIES || 3),
      RETRY_DELAY: Number(process.env.RMQ_RETRY_DELAY || 5000),
      RECONNECT_INTERVAL: Number(process.env.RMQ_RECONNECT_INTERVAL || 3000),
    },
  },

  /* =========================
     PAYMENT SERVICE gRPC
  ========================= */
  PAYMENT_SERVICE: {
    HOST: process.env.PAYMENT_SERVICE_HOST || 'localhost',
    PORT: Number(process.env.PAYMENT_SERVICE_PORT || 50055),
    PROTO_PATH: process.env.PAYMENT_PROTO_PATH || '',
  },

  /* =========================
     EXPIRY WORKER
  ========================= */
  EXPIRY: {
    INTERVAL_MS: Number(process.env.EXPIRY_INTERVAL_MS || 3600000),
    GRACE_PERIOD_DAYS: Number(process.env.GRACE_PERIOD_DAYS || 3),
  },

  /* =========================
     gRPC
  ========================= */
  GRPC: {
    MAX_MESSAGE_SIZE: Number(process.env.GRPC_MAX_MESSAGE_SIZE || 4 * 1024 * 1024),
  },
};

export default config;
