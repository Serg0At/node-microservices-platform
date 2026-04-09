import 'dotenv/config';

const config = {
  /* =========================
     SERVER
  ========================= */
  SERVER: {
    NAME: process.env.SERVICE_NAME || 'notification-service',
    ENV: process.env.SERVICE_ENV || 'production',
    PORT: Number(process.env.SERVICE_PORT) || 50053,
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
      UNREAD_COUNT: Number(process.env.REDIS_UNREAD_COUNT_TTL || 300),
      RECENT_NOTIFICATIONS: Number(process.env.REDIS_RECENT_NOTIFICATIONS_TTL || 3600),
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

    EXCHANGE: {
      NAME: process.env.RMQ_EXCHANGE || 'auth-events',
      TYPE: process.env.RMQ_EXCHANGE_TYPE || 'topic',
    },

    QUEUE: {
      NAME: process.env.RMQ_QUEUE || 'notification-service.events.queue',
      BIND_PATTERN: process.env.RMQ_BIND_PATTERN || 'user.*',
    },

    SUBSCRIPTION_EXCHANGE: {
      NAME: process.env.RMQ_SUBSCRIPTION_EXCHANGE || 'subscription-events',
      TYPE: process.env.RMQ_EXCHANGE_TYPE || 'topic',
    },

    SUBSCRIPTION_QUEUE: {
      NAME: process.env.RMQ_SUBSCRIPTION_QUEUE || 'notification-service.subscription.queue',
      BIND_PATTERN: process.env.RMQ_SUBSCRIPTION_BIND_PATTERN || 'subscription.*',
    },

    NEWS_EXCHANGE: {
      NAME: process.env.RMQ_NEWS_EXCHANGE || 'news-events',
      TYPE: process.env.RMQ_EXCHANGE_TYPE || 'topic',
    },

    NEWS_QUEUE: {
      NAME: process.env.RMQ_NEWS_QUEUE || 'notification-service.news.queue',
      BIND_PATTERN: process.env.RMQ_NEWS_BIND_PATTERN || 'article.*',
    },

    PREFETCH: Number(process.env.RMQ_PREFETCH || 10),

    RETRY: {
      MAX_RETRIES: Number(process.env.RMQ_MAX_RETRIES || 3),
      RETRY_DELAY: Number(process.env.RMQ_RETRY_DELAY || 5000),
      RECONNECT_INTERVAL: Number(process.env.RMQ_RECONNECT_INTERVAL || 3000),
    },
  },

  /* =========================
     SMTP
  ========================= */
  SMTP: {
    HOST: process.env.SMTP_HOST,
    PORT: Number(process.env.SMTP_PORT || 587),
    SECURE: process.env.SMTP_SECURE === 'true',
    USER: process.env.SMTP_USER,
    PASSWORD: process.env.SMTP_PASSWORD,
    FROM_NAME: process.env.SMTP_FROM_NAME || 'Arbex',
    FROM_EMAIL: process.env.SMTP_FROM_EMAIL || 'noreply@arbex.com',
  },

  /* =========================
     NOTIFICATION
  ========================= */
  NOTIFICATION: {
    ARCHIVE_DAYS: Number(process.env.NOTIFICATION_ARCHIVE_DAYS || 90),
    ARCHIVE_INTERVAL_MS: Number(process.env.NOTIFICATION_ARCHIVE_INTERVAL_MS || 86400000),
    MAX_RETRIES: Number(process.env.NOTIFICATION_MAX_RETRIES || 3),
    RECENT_MAX: 50,
  },

  /* =========================
     FRONTEND
  ========================= */
  FRONTEND: {
    URL: process.env.FRONTEND_URL || 'http://localhost:3000',
  },

  /* =========================
     gRPC
  ========================= */
  GRPC: {
    MAX_MESSAGE_SIZE: Number(process.env.GRPC_MAX_MESSAGE_SIZE || 4 * 1024 * 1024),
  },
};

export default config;
