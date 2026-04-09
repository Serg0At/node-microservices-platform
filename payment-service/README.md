# Payment Service

Payment microservice for the Arbex platform. Handles cryptocurrency payments via Cryptomus and card payments via Fondy. Runs both a gRPC server for internal communication and an HTTP server for payment provider webhooks.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Node.js (ES modules) |
| Transport | gRPC (`@grpc/grpc-js`, `@grpc/proto-loader`) + Express (webhooks) |
| Database | PostgreSQL via Knex.js (`transactions` table) |
| Cache | Redis (ioredis) — idempotency key caching |
| Messaging | RabbitMQ (amqplib) — publishes payment events |
| Crypto Payments | Cryptomus API |
| Card Payments | Fondy API |
| Resilience | Circuit breakers via `opossum` |
| Validation | Joi schemas |
| Logging | Winston |

## Architecture

```text
Subscription Service
      |
      | gRPC (:50057)
      v
 Payment Service ── HTTP (:3001) ──> Webhook endpoints
      |
      ├── PostgreSQL   (transactions)
      ├── Redis        (idempotency cache)
      ├── RabbitMQ     (payment-events → subscription-service)
      ├── Cryptomus    (crypto payment API)
      └── Fondy        (card payment API)
```

## Ports

| Port | Protocol | Description |
|------|----------|-------------|
| `50057` | gRPC | Internal API (CreatePayment, GetTransaction, ListTransactions) |
| `3001` | HTTP | Webhook endpoints for payment providers |

## gRPC API (port 50057)

Defined in `proto/payment.proto`:

| RPC | Description |
|-----|-------------|
| `CreatePayment` | Initiate a payment via crypto (Cryptomus) or card (Fondy) |
| `GetTransaction` | Get a single transaction by ID |
| `ListTransactions` | Paginated transaction list for a user |

## Webhook Endpoints (port 3001)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/webhook/cryptomus` | Cryptomus payment callbacks |
| POST | `/webhook/fondy` | Fondy payment callbacks |
| GET | `/health` | Health check — `{ "status": "ok" }` |

Both webhook handlers always return HTTP 200 to prevent provider retries, then process asynchronously.

## RabbitMQ Events

Published on `payment-events` topic exchange:

| Routing Key | Description |
|-------------|-------------|
| `payment.succeeded` | Payment completed successfully |
| `payment.failed` | Payment failed or expired |
| `payment.refunded` | Payment was refunded |

## Project Structure

```text
src/
├── app.js                        # Entry point — boots Redis, RabbitMQ, gRPC, HTTP
├── bin/
│   ├── server.js                 # gRPC server (port 50057)
│   ├── http.js                   # Express webhook server (port 3001)
│   └── loader.js                 # Proto file loader
├── config/
│   ├── variables.config.js       # Centralized env config
│   ├── db.js                     # Database connection
│   └── knex.config.js            # Knex configuration
├── controllers/
│   ├── payment.controller.js     # gRPC handlers (CreatePayment, Get/ListTransactions)
│   └── webhook.controller.js     # HTTP handlers (Cryptomus, Fondy webhooks)
├── providers/
│   ├── cryptomus.provider.js     # Cryptomus API client
│   └── fondy.provider.js         # Fondy API client
├── services/
│   └── payment.service.js        # Business logic + webhook processing
├── models/
│   └── Transaction.js            # Knex query builder for transactions
├── rabbit/
│   └── publisher.js              # RabbitMQ event publisher
├── redis/
│   ├── redisClient.js            # Redis connection
│   └── idempotencyCache.js       # Idempotency key caching
├── middlewares/
│   └── validations/              # Joi validation schemas
└── utils/                        # Circuit breaker, error handler, logger
proto/payment.proto               # gRPC service definition
migrations/                       # Database table creation/teardown
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

### 3. Start infrastructure

```bash
docker compose up -d
```

### 4. Run migrations

```bash
npm run migrate
```

### 5. Start the service

```bash
npm run dev
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `SERVICE_NAME` | `payment-service` | Service identifier |
| `SERVICE_ENV` | `production` | Environment |
| `SERVICE_PORT` | `50057` | gRPC server port |
| `WEBHOOK_HTTP_PORT` | `3001` | HTTP webhook server port |
| `SERVICE_LOG_LEVEL` | `info` | Winston log level |
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
| `REDIS_IDEMPOTENCY_TTL` | `86400` | Idempotency key TTL — 24 hours (seconds) |
| `RMQ_EXCHANGE` | `payment-events` | Payment events exchange |
| `RMQ_EXCHANGE_TYPE` | `topic` | Exchange type |
| `RMQ_MAX_RETRIES` | `3` | Max retry attempts |
| `RMQ_RETRY_DELAY` | `5000` | Retry delay (ms) |
| `CRYPTOMUS_MERCHANT_ID` | — | Cryptomus merchant ID |
| `CRYPTOMUS_API_KEY` | — | Cryptomus API key |
| `CRYPTOMUS_PAYMENT_LIFETIME` | `3600` | Crypto payment lifetime (seconds) |
| `FONDY_MERCHANT_ID` | — | Fondy merchant ID |
| `FONDY_MERCHANT_PASSWORD` | — | Fondy merchant password |
| `FONDY_PAYMENT_LIFETIME` | `3600` | Card payment lifetime (seconds) |
| `WEBHOOK_BASE_URL` | `https://arbex.io` | Base URL for webhook callbacks |
| `FRONTEND_SUCCESS_URL` | `https://arbex.io/subscription/success` | Redirect after successful payment |
| `FRONTEND_CANCEL_URL` | `https://arbex.io/subscription/cancel` | Redirect after canceled payment |
| `GRPC_MAX_MESSAGE_SIZE` | `4194304` | Max gRPC message size (bytes) |

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start with nodemon (development) |
| `npm start` | Start in production mode |
| `npm run debug` | Start with Node.js inspector |
| `npm run reload` | Kill ports 50057 & 3001 and restart dev |
| `npm run migrate` | Run database migrations |
| `npm run migrate:down` | Drop database tables |
| `npm run proto:check` | Verify proto files |
| `npm run lint` | ESLint check |
| `npm run lint:fix` | ESLint auto-fix |
| `npm run format` | Prettier format |
| `npm run check-format` | Prettier check |

## Author

Serg
