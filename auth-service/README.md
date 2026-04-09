# Auth Service

Authentication and authorization microservice for the Arbex platform. Handles user registration, login, token management, 2FA (TOTP), Google OIDC, password reset, and email verification.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Node.js (ES modules) |
| Transport | gRPC (`@grpc/grpc-js`, `@grpc/proto-loader`) |
| Database | PostgreSQL via Knex.js (`users`, `user_2fa`, `oauth_accounts`) |
| Cache | Redis (ioredis) — sessions, refresh tokens, reset codes, verification tokens |
| Messaging | RabbitMQ (amqplib) — topic exchange for user events |
| Auth | RS256 JWT access tokens, opaque refresh tokens (Redis, 30-day TTL) |
| 2FA | TOTP via `otplib`, QR codes via `qrcode` |
| Resilience | Circuit breakers via `opossum` |
| Validation | Joi schemas |
| Logging | Winston |

## Architecture

```text
GraphQL Gateway
      |
      | gRPC (:50051)
      v
 Auth Service
      |
      ├── PostgreSQL   (users, 2FA secrets, OAuth accounts)
      ├── Redis        (sessions, refresh tokens, reset codes, verification tokens)
      └── RabbitMQ     (auth-events → notification-service, subscription-service, user-service)
```

## gRPC API (port 50051)

Defined in `proto/auth.proto`:

| RPC | Auth | Description |
|-----|------|-------------|
| `RegisterUser` | None | Create account with email/username/password |
| `LoginUser` | None | Email or username + password login (rejects banned, returns `requires_2fa` if enabled) |
| `OIDCLogin` | None | Google OAuth login via authorization code |
| `ForgotPassword` | None | Send password reset code to email |
| `VerifyResetCode` | None | Validate reset code without consuming it |
| `ResetPassword` | None | Reset password using email + code |
| `RequestPasswordChange` | Token | Authenticated user requests password change (sends email) |
| `ConfirmPasswordChange` | Token | Confirm password change via token from email |
| `Setup2FA` | Token | Generate TOTP QR code, secret, and backup codes |
| `Verify2FA` | Token | Validate TOTP code, returns tokens with `acr: '2fa'` claim |
| `VerifyEmail` | None | Confirm email via magic link token |
| `RefreshTokens` | None | Rotate access + refresh tokens (rejects banned users) |
| `Logout` | Token | Revoke refresh token and end session |

## Project Structure

```text
src/
├── app.js                     # Entry point — boots Redis, RabbitMQ, DB, then gRPC server
├── bin/
│   ├── server.js              # gRPC server setup and graceful shutdown
│   └── loader.js              # Proto file loader (keepCase: true)
├── config/
│   ├── variables.config.js    # Centralized env config
│   ├── db.js                  # Database connection
│   └── knex.config.js         # Knex configuration
├── controllers/               # gRPC handlers (call, callback pattern)
├── services/                  # Business logic (auth, oauth, twofa)
├── models/                    # Knex query builders (Auth, OAuth, TwoFa)
├── middlewares/
│   ├── schemas/               # Joi validation schemas
│   └── validation.js
├── rabbit/                    # RabbitMQ publisher
├── redis/                     # Redis client + operations
└── utils/                     # JWT, crypto, error-handler, success-handler, circuit-breaker, logger
proto/auth.proto               # All RPC definitions
migrations/                    # create_tables.js / drop_tables.js
```

## Getting Started

### Prerequisites

- Node.js 20+
- Docker & Docker Compose

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

### 3. Generate RSA keys

```bash
mkdir -p keys
openssl genrsa -out keys/access_private.pem 2048
openssl rsa -in keys/access_private.pem -pubout -out keys/access_public.pem
```

### 4. Start infrastructure

```bash
docker compose up -d
```

### 5. Run migrations

```bash
npm run migrate
```

### 6. Start the service

```bash
npm run dev
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `SERVICE_NAME` | `auth-service` | Service identifier |
| `SERVICE_ENV` | `production` | Environment |
| `SERVICE_PORT` | `50051` | gRPC server port |
| `SERVICE_LOG_LEVEL` | `info` | Winston log level |
| `ADMIN_EMAIL` | — | Initial admin user email |
| `ADMIN_PASSWORD` | — | Initial admin user password |
| `PSQL_HOST` | — | PostgreSQL host |
| `PSQL_PORT` | `5432` | PostgreSQL port |
| `PSQL_USER` | — | PostgreSQL user |
| `PSQL_PASSWORD` | — | PostgreSQL password |
| `PSQL_DATABASE` | — | Database name |
| `PSQL_SSL` | `false` | Enable SSL for PostgreSQL |
| `REDIS_URL` | — | Redis connection URL |
| `REDIS_HOST` | — | Redis host (fallback) |
| `REDIS_PORT` | `6379` | Redis port |
| `REDIS_PASSWORD` | — | Redis password |
| `REDIS_DB` | `0` | Redis database index |
| `REDIS_USER_SESSIONS_TTL` | `604800` | Session TTL — 7 days (seconds) |
| `REDIS_RESET_CODE_TTL` | `900` | Reset code TTL — 15 min (seconds) |
| `REDIS_USER_CACHE_TTL` | `300` | User cache TTL — 5 min (seconds) |
| `REDIS_REFRESH_TOKEN_TTL` | `2592000` | Refresh token TTL — 30 days (seconds) |
| `REDIS_CHANGE_PASSWORD_TOKEN_TTL` | `900` | Password change token TTL — 15 min (seconds) |
| `JWT_ACCESS_ALG` | `RS256` | JWT signing algorithm |
| `JWT_ACCESS_PRIVATE_KEY_PATH` | — | RS256 private key path |
| `JWT_ACCESS_PUBLIC_KEY_PATH` | — | RS256 public key path |
| `ACCESS_TOKEN_ACTIVE_TIME` | `15m` | Access token lifetime |
| `JWT_ISSUER` | `auth-service` | JWT issuer claim |
| `JWT_AUDIENCE` | `graphql-gateway` | JWT audience claim |
| `BCRYPT_SALT_ROUNDS` | `12` | bcrypt cost factor |
| `PASSWORD_MIN_LENGTH` | `8` | Minimum password length |
| `PASSWORD_REQUIRE_SPECIAL` | `false` | Require special characters |
| `ENCRYPTION_KEY` | — | Key for encrypting sensitive data |
| `SESSION_FINGERPRINT_HASH` | `sha256` | Fingerprint hash algorithm |
| `SESSION_MAX_DEVICES` | `5` | Max concurrent sessions |
| `TOTP_ISSUER` | `AuthService` | 2FA TOTP issuer name |
| `TOTP_DIGITS` | `6` | TOTP code length |
| `TOTP_PERIOD` | `30` | TOTP period (seconds) |
| `TOTP_BACKUP_CODES_COUNT` | `5` | Number of backup codes |
| `EMAIL_VERIFY_TOKEN_TTL` | `86400` | Email verify token TTL — 24 hours (seconds) |
| `PASSWORD_RESET_CODE_LENGTH` | `6` | Reset code length |
| `RABBITMQ_HOST` | — | RabbitMQ host |
| `RABBITMQ_PORT` | `5672` | RabbitMQ port |
| `RABBITMQ_USER` | — | RabbitMQ username |
| `RABBITMQ_PASSWORD` | — | RabbitMQ password |
| `RMQ_EXCHANGE` | `auth-events` | Auth events exchange |
| `RMQ_EXCHANGE_TYPE` | `topic` | Exchange type |
| `RMQ_SUBSCRIPTION_EXCHANGE` | `subscription-events` | Subscription events exchange |
| `GOOGLE_CLIENT_ID` | — | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | — | Google OAuth client secret |
| `GOOGLE_CALLBACK_URL` | — | Google OAuth redirect URI |
| `OIDC_STATE_TTL` | `300` | OIDC state TTL — 5 min (seconds) |
| `GRPC_MAX_MESSAGE_SIZE` | `4194304` | Max gRPC message size (bytes) |
| `GRPC_KEEPALIVE_MS` | `30000` | gRPC keepalive interval (ms) |

## RabbitMQ Events

Published via `publishAuthEvent(routingKey, payload)` on `auth-events` topic exchange:

| Routing Key | Description |
|-------------|-------------|
| `user.registered` | New user signed up |
| `user.logged_in` | User login event |
| `user.password_changed` | Password was changed |
| `user.verify_email` | Email verification requested |
| `user.forgot_password` | Password reset requested |
| `user.2fa_enabled` | 2FA was enabled |

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start with nodemon (development) |
| `npm start` | Start in production mode |
| `npm run debug` | Start with Node.js inspector |
| `npm run reload` | Kill port 50051 and restart dev |
| `npm run migrate` | Run database migrations |
| `npm run migrate-down` | Drop database tables |
| `npm run seed` | Seed database |
| `npm test` | Run tests (Jest) |
| `npm run test:watch` | Run tests in watch mode |
| `npm run lint` | ESLint check |
| `npm run lint:fix` | ESLint auto-fix |
| `npm run format` | Prettier format |
| `npm run check-format` | Prettier check |
| `npm run docker:build` | Build Docker image |
| `npm run compose:up` | Start with Docker Compose |
| `npm run compose:down` | Stop Docker Compose |

## Author

Serg
