import 'dotenv/config';

const config = {
  /* =========================
     SERVER
  ========================= */
  SERVER: {
    NAME: process.env.SERVICE_NAME || 'user-service',
    ENV: process.env.SERVICE_ENV || 'production',
    PORT: Number(process.env.SERVICE_PORT) || 50052,
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

    TTL: {
      PROFILE_CACHE: Number(process.env.REDIS_PROFILE_CACHE_TTL || 300),
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

    QUEUES: {
      REGISTRATION: 'user-service.auth-events.queue',
    },

    RETRY: {
      MAX_RETRIES: Number(process.env.RMQ_MAX_RETRIES || 3),
      RETRY_DELAY: Number(process.env.RMQ_RETRY_DELAY || 5000),
      RECONNECT_INTERVAL: Number(process.env.RMQ_RECONNECT_INTERVAL || 3000),
    },

    ROUTING_KEYS: {
      USER_REGISTERED: 'user.registered',
      USER_PROFILE_UPDATED: 'user.profile_updated',
      USER_USERNAME_CHANGED: 'user.username_changed',
    },
  },

  /* =========================
     MINIO (S3-compatible)
  ========================= */
  MINIO: {
    ENDPOINT: process.env.MINIO_ENDPOINT || 'http://minio:9000',
    PUBLIC_URL: process.env.MINIO_PUBLIC_URL || 'http://localhost:9000',
    ACCESS_KEY: process.env.MINIO_ACCESS_KEY || 'minioadmin',
    SECRET_KEY: process.env.MINIO_SECRET_KEY || 'minioadmin',
    BUCKET: process.env.MINIO_BUCKET || 'arbex-assets',
    REGION: process.env.MINIO_REGION || 'us-east-1',
    DEFAULT_AVATARS_PREFIX: 'avatars/defaults/',
    USER_AVATARS_PREFIX: 'avatars/users/',
    DEFAULT_AVATAR_COUNT: 20,
    MAX_IMAGE_SIZE: 5 * 1024 * 1024,
  },

  /* =========================
     gRPC
  ========================= */
  GRPC: {
    MAX_MESSAGE_SIZE: Number(process.env.GRPC_MAX_MESSAGE_SIZE || 4 * 1024 * 1024),
  },
};

export default config;
