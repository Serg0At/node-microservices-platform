import 'dotenv/config';

const config = {
  /* =========================
     SERVER
  ========================= */
  SERVER: {
    NAME: process.env.SERVICE_NAME || 'news-service',
    ENV: process.env.SERVICE_ENV || 'production',
    PORT: Number(process.env.SERVICE_PORT) || 50054,
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
      ARTICLE_CACHE: Number(process.env.REDIS_ARTICLE_CACHE_TTL || 900),
      LATEST_LIST: Number(process.env.REDIS_LATEST_LIST_TTL || 300),
      SEARCH_CACHE: Number(process.env.REDIS_SEARCH_CACHE_TTL || 300),
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
      NAME: process.env.RMQ_EXCHANGE || 'news-events',
      TYPE: process.env.RMQ_EXCHANGE_TYPE || 'topic',
    },

    RETRY: {
      MAX_RETRIES: Number(process.env.RMQ_MAX_RETRIES || 3),
      RETRY_DELAY: Number(process.env.RMQ_RETRY_DELAY || 5000),
      RECONNECT_INTERVAL: Number(process.env.RMQ_RECONNECT_INTERVAL || 3000),
    },

    ROUTING_KEYS: {
      ARTICLE_CREATED: 'article.created',
      ARTICLE_DELETED: 'article.deleted',
    },
  },

  /* =========================
     S3 / MINIO
  ========================= */
  S3: {
    ENDPOINT: process.env.S3_ENDPOINT,
    REGION: process.env.S3_REGION || 'us-east-1',
    ACCESS_KEY: process.env.S3_ACCESS_KEY,
    SECRET_KEY: process.env.S3_SECRET_KEY,
    BUCKET: process.env.S3_BUCKET || 'news-media-bucket',
    PRESIGNED_URL_EXPIRES: Number(process.env.S3_PRESIGNED_EXPIRES || 3600),
    FORCE_PATH_STYLE: process.env.S3_FORCE_PATH_STYLE !== 'false',
  },

  /* =========================
     TOKENS / JWT (verify only)
  ========================= */
  TOKENS: {
    ACCESS: {
      ALG: process.env.JWT_ACCESS_ALG || 'RS256',
      PUBLIC_KEY_PATH: process.env.JWT_ACCESS_PUBLIC_KEY_PATH,
    },
    ISSUER: process.env.JWT_ISSUER || 'auth-service',
    AUDIENCE: process.env.JWT_AUDIENCE || 'graphql-gateway',
  },

  /* =========================
     gRPC
  ========================= */
  GRPC: {
    MAX_MESSAGE_SIZE: Number(process.env.GRPC_MAX_MESSAGE_SIZE || 4 * 1024 * 1024),
    SHARED_SECRET: process.env.INTERNAL_GRPC_SHARED_SECRET,
    TRUSTED_GATEWAY: process.env.TRUSTED_GATEWAY_SERVICE || 'graphql-gateway',
  },

  /* =========================
     PAGINATION
  ========================= */
  PAGINATION: {
    DEFAULT_PAGE: 1,
    DEFAULT_LIMIT: 10,
    MAX_LIMIT: 50,
  },
};

export default config;
