# Subscription Service

Subscription management microservice for the Arbex platform. Handles user subscriptions, free trials, plan upgrades with proration, automatic expiry with grace periods, payment checkout, and promotional discount codes.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Node.js (ES modules) |
| Transport | gRPC (`@grpc/grpc-js`, `@grpc/proto-loader`) |
| Database | PostgreSQL via Knex.js |
| Cache | Redis (ioredis) — subscription & stats caching |
| Message Queue | RabbitMQ (amqplib) — event-driven architecture |
| Auth | RS256 JWT verification (public key only) |
| Resilience | Circuit breakers via `opossum` |
| Validation | Joi schemas |
| Logging | Winston |

## Architecture

```text
GraphQL Gateway ──gRPC(:50056)──> Subscription Service
Admin Service ──gRPC(:50056)──>       |
                                      ├── PostgreSQL   (subscriptions, promo_codes tables)
                                      ├── Redis        (subscription + stats cache)
                                      ├── RabbitMQ     (event consumer + publisher)
                                      └── Payment Service (gRPC — checkout)
```

## gRPC API (port 50056)

Defined in `proto/subscription.proto`:

| RPC | Auth | Description |
|-----|------|-------------|
| **User-facing** | | |
| `GetSubscription` | Token | Get current subscription for authenticated user |
| `CreateCheckout` | Token | Create payment checkout with proration + optional promo code |
| `CancelSubscription` | Token | Cancel an active subscription |
| `RestoreSubscription` | Token | Restore a canceled/expired subscription |
| `ValidatePromoCode` | Token | Validate promo code and preview discount |
| **Internal** | | |
| `CheckAccess` | None | Check if user has required subscription level |
| **Admin** | | |
| `AdminSetSubscription` | Token | Set subscription for any user by type and duration |
| `AdminRemoveSubscription` | Token | Remove/terminate a user's subscription |
| `GetSubscriptionStats` | Token | Subscription statistics by status and tier |
| `CreatePromoCode` | Token | Create promotional discount code |
| `ListPromoCodes` | Token | List promo codes with pagination and active filter |
| `DeactivatePromoCode` | Token | Deactivate a promo code |

## Subscription Types

| Value | Name | Monthly Price |
|-------|------|--------------|
| 0 | None | — |
| 1 | Lite | $9.99 |
| 2 | Standard | $19.99 |
| 3 | PRO | $39.99 |

Duration discounts: 3 months (10%), 6 months (20%), 12 months (30%).

## Promo Code System

- **Discount types**: `percentage` or `fixed` (in cents)
- **Restrictions**: applicable tiers, minimum duration, max usage, expiry date
- **Applied during checkout**: after proration calculation, before payment service call
- **Validation**: public `ValidatePromoCode` RPC returns discount preview without applying

## Events

### Consumed

| Exchange | Event | Action |
|----------|-------|--------|
| `auth-events` | `user.registered` | Create initial subscription record (type=None) |
| `payment-events` | `payment.succeeded` | Activate subscription from checkout |
| `payment-events` | `payment.refunded` | Handle refund logic |

### Published to `subscription-events`

| Event | Trigger |
|-------|---------|
| `subscription.activated` | New subscription or upgrade |
| `subscription.expired` | Past end date |
| `subscription.grace_warning` | Entered grace period |
| `subscription.terminated` | Grace period ended |
| `subscription.canceled` | User canceled |
| `subscription.reactivated` | Restored after cancellation |

## Project Structure

```text
src/
├── app.js                          # Entry point
├── bin/                            # gRPC server bootstrap + proto loader
├── config/
│   ├── variables.config.js         # Centralized env config
│   ├── pricing.config.js           # Plan pricing + duration discounts
│   ├── db.js                       # Database connection
│   └── knex.config.js              # Knex configuration
├── controllers/
│   └── subscription.controller.js  # All 12 RPC handlers
├── services/
│   └── subscription.service.js     # Core business logic
├── models/
│   ├── Subscription.js             # Subscription query builders
│   └── PromoCode.js                # Promo code query builders
├── middlewares/
│   └── validations/
│       ├── schemas/                # Joi validation schemas
│       └── validation.js
├── grpc/                           # Outbound gRPC clients (payment-service)
├── redis/                          # Redis cache layer
├── rabbit/                         # RabbitMQ consumer + publisher
├── workers/                        # Background jobs (expiry worker)
└── utils/                          # JWT, error-handler, circuit-breaker, logger
proto/subscription.proto            # All RPC definitions
migrations/                         # Knex migrations (subscriptions, promo_codes)
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

### 3. Run migrations

```bash
npm run migrate
```

### 4. Start the service

```bash
npm run dev
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `SERVICE_NAME` | `subscription-service` | Service identifier |
| `SERVICE_ENV` | — | Environment |
| `SERVICE_PORT` | `50056` | gRPC server port |
| `SERVICE_LOG_LEVEL` | — | Winston log level |
| `PSQL_HOST` | — | PostgreSQL host |
| `PSQL_PORT` | `5432` | PostgreSQL port |
| `PSQL_USER` | — | PostgreSQL user |
| `PSQL_PASSWORD` | — | PostgreSQL password |
| `PSQL_DATABASE` | — | Database name |
| `PSQL_SSL` | `false` | Enable SSL for PostgreSQL |
| `REDIS_URL` | — | Redis connection URL |
| `REDIS_HOST` | `localhost` | Redis host (fallback) |
| `REDIS_PORT` | `6379` | Redis port |
| `REDIS_PASSWORD` | — | Redis password |
| `REDIS_DB` | `0` | Redis database index |
| `REDIS_SUBSCRIPTION_TTL` | `300` | Subscription cache TTL (seconds) |
| `REDIS_STATS_TTL` | `600` | Stats cache TTL (seconds) |
| `RABBITMQ_HOST` | — | RabbitMQ host |
| `RABBITMQ_PORT` | `5672` | RabbitMQ port |
| `RABBITMQ_USER` | — | RabbitMQ username |
| `RABBITMQ_PASSWORD` | — | RabbitMQ password |
| `RMQ_AUTH_EXCHANGE` | — | Auth events exchange |
| `RMQ_PAYMENT_EXCHANGE` | — | Payment events exchange |
| `RMQ_PUBLISH_EXCHANGE` | — | Subscription events exchange |
| `RMQ_PREFETCH` | `10` | Consumer prefetch count |
| `RMQ_MAX_RETRIES` | `3` | Max retry attempts |
| `RMQ_RETRY_DELAY` | `5000` | Retry delay (ms) |
| `PAYMENT_SERVICE_HOST` | `localhost` | Payment gRPC host |
| `PAYMENT_SERVICE_PORT` | `50055` | Payment gRPC port |
| `EXPIRY_INTERVAL_MS` | `3600000` | Expiry worker interval (1 hour) |
| `GRACE_PERIOD_DAYS` | `3` | Grace period before termination |
| `JWT_ACCESS_PUBLIC_KEY_PATH` | — | RS256 public key path |
| `GRPC_MAX_MESSAGE_SIZE` | `4194304` | Max gRPC message size (bytes) |

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start with nodemon (development) |
| `npm start` | Start in production mode |
| `npm run debug` | Start with Node.js inspector |
| `npm run reload` | Kill port 50056 and restart dev |
| `npm run migrate` | Run database migrations |
| `npm run migrate:down` | Rollback migrations |
| `npm run proto:check` | Verify proto files |
| `npm run lint` | ESLint check |
| `npm run lint:fix` | ESLint auto-fix |
| `npm run format` | Prettier format |
| `npm run check-format` | Prettier check |

## Author

Serg
