import 'dotenv/config';

const config = {
  /* =========================
     ADMIN
  ========================= */
  ADMIN: {
    EMAIL: process.env.ADMIN_EMAIL,
    PASSWORD: process.env.ADMIN_PASSWORD,
  },

  /* =========================
     SERVER
  ========================= */
  SERVER: {
    NAME: process.env.SERVICE_NAME || 'auth-service',
    ENV: process.env.SERVICE_ENV || 'production',
    PORT: Number(process.env.SERVICE_PORT) || 50051,
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
      USER_SESSIONS: Number(process.env.REDIS_USER_SESSIONS_TTL || 604800),
      RESET_CODE: Number(process.env.REDIS_RESET_CODE_TTL || 900),
      USER_CACHE: Number(process.env.REDIS_USER_CACHE_TTL || 300),
      REFRESH_TOKEN: Number(process.env.REDIS_REFRESH_TOKEN_TTL || 2592000),
      CHANGE_PASSWORD_TOKEN: Number(process.env.REDIS_CHANGE_PASSWORD_TOKEN_TTL || 900),
    },
  },

  /* =========================
     TOKENS / JWT
  ========================= */
  TOKENS: {
    ACCESS: {
      ALG: process.env.JWT_ACCESS_ALG || 'RS256',
      PRIVATE_KEY_PATH: process.env.JWT_ACCESS_PRIVATE_KEY_PATH,
      PUBLIC_KEY_PATH: process.env.JWT_ACCESS_PUBLIC_KEY_PATH,
      TTL: process.env.ACCESS_TOKEN_ACTIVE_TIME || '15m',
    },

    REFRESH: {
      TTL: Number(process.env.REDIS_REFRESH_TOKEN_TTL || 2592000), // 30 days in seconds
    },

    ISSUER: process.env.JWT_ISSUER || 'auth-service',
    AUDIENCE: process.env.JWT_AUDIENCE || 'graphql-gateway',
  },

/* =========================
     SECURITY
  ========================= */
  SECURITY: {
    BCRYPT_SALT_ROUNDS: Number(process.env.BCRYPT_SALT_ROUNDS || 12),
    PASSWORD_MIN_LENGTH: Number(process.env.PASSWORD_MIN_LENGTH || 8),
    PASSWORD_REQUIRE_SPECIAL: process.env.PASSWORD_REQUIRE_SPECIAL === 'true',
    ENCRYPTION_KEY: process.env.ENCRYPTION_KEY,
  },

  /* =========================
     SESSIONS / DEVICES
  ========================= */
  SESSIONS: {
    FINGERPRINT_HASH: process.env.SESSION_FINGERPRINT_HASH || 'sha256',
    MAX_DEVICES: Number(process.env.SESSION_MAX_DEVICES || 5),
  },

  /* =========================
     2FA / TOTP
  ========================= */
  TOTP: {
    ISSUER: process.env.TOTP_ISSUER || 'AuthService',
    DIGITS: Number(process.env.TOTP_DIGITS || 6),
    PERIOD: Number(process.env.TOTP_PERIOD || 30),
    BACKUP_CODES_COUNT: Number(process.env.TOTP_BACKUP_CODES_COUNT || 5),
  },

  /* =========================
     EMAIL / PASSWORD RESET
  ========================= */
  EMAIL: {
    VERIFY_TOKEN_TTL: Number(process.env.EMAIL_VERIFY_TOKEN_TTL || 86400),
    RESET_CODE_LENGTH: Number(process.env.PASSWORD_RESET_CODE_LENGTH || 6),
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
      USERNAME_SYNC: 'auth-service.username-sync.queue',
    },

    RETRY: {
      MAX_RETRIES: Number(process.env.RMQ_MAX_RETRIES || 3),
      RETRY_DELAY: Number(process.env.RMQ_RETRY_DELAY || 5000),
      RECONNECT_INTERVAL: Number(process.env.RMQ_RECONNECT_INTERVAL || 3000),
    },

    ROUTING_KEYS: {
      USER_REGISTERED: 'user.registered',
      USER_LOGGED_IN: 'user.logged_in',
      USER_PASSWORD_CHANGED: 'user.password_changed',
      USER_PROFILE_UPDATED: 'user.profile_updated',
      USER_VERIFY_EMAIL: 'user.verify_email',
      USER_FORGOT_PASSWORD: 'user.forgot_password',
      USER_2FA_ENABLED: 'user.2fa_enabled',
      USER_USERNAME_CHANGED: 'user.username_changed',
      USER_CHANGE_PASSWORD_REQUEST: 'user.change_password_request',
    },

    SUBSCRIPTION_EXCHANGE: {
      NAME: process.env.RMQ_SUBSCRIPTION_EXCHANGE || 'subscription-events',
      TYPE: 'topic',
      QUEUE: 'auth-service.subscription.queue',
      BIND_PATTERN: 'subscription.*',
    },
  },

  /* =========================
     GOOGLE OAUTH / OIDC
  ========================= */
  GOOGLE_OAUTH: {
    CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
    CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
    CALLBACK_URL: process.env.GOOGLE_CALLBACK_URL,
    STATE_TTL: Number(process.env.OIDC_STATE_TTL || 300),
  },

  /* =========================
     gRPC
  ========================= */
  GRPC: {
    MAX_MESSAGE_SIZE: Number(process.env.GRPC_MAX_MESSAGE_SIZE || 4 * 1024 * 1024),
    KEEPALIVE_MS: Number(process.env.GRPC_KEEPALIVE_MS || 30000),
    SHARED_SECRET: process.env.INTERNAL_GRPC_SHARED_SECRET,
    TRUSTED_GATEWAY: process.env.TRUSTED_GATEWAY_SERVICE || 'graphql-gateway',
  },

  
};

export default config;
