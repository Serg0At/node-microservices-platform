# Admin Service

Administration microservice for the Arbex platform. Provides admin-only operations for dashboard analytics, user management, article management, subscription control, promo codes, and notifications. Proxies calls to news-service, subscription-service, and notification-service with admin role enforcement.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Node.js (ES modules) |
| Transport | gRPC (`@grpc/grpc-js`, `@grpc/proto-loader`) |
| Database | PostgreSQL via Knex.js (shared `arbex_auth` database) |
| Cache | Redis (ioredis) — dashboard stats caching (60s TTL) |
| Auth | RS256 JWT verification (public key only) + admin role check |
| Resilience | Circuit breakers via `opossum` (DB: 8s, Redis: 2s, gRPC: 10s) |
| Validation | Joi schemas |
| Logging | Winston |

## Architecture

```text
GraphQL Gateway
      |
      | gRPC (:50055)
      v
 Admin Service
      |
      ├── PostgreSQL            (users, articles, categories — shared with auth-service)
      ├── Redis                 (dashboard stats cache)
      ├── subscription-service  (gRPC :50056 — subscription set/remove, stats, promo codes)
      ├── news-service          (gRPC :50054 — article create/delete, upload URL, stats)
      └── notification-service  (gRPC :50053 — send/bulk notifications)
```

## gRPC API (port 50055)

Defined in `proto/admin.proto`. All RPCs require `access_token` with admin role (`role=1`).

| RPC | Description |
|-----|-------------|
| **Dashboard** | |
| `GetDashboardStats` | Aggregate stats (total users, banned, articles, categories, views, today counts) |
| **User Management** | |
| `ListUsers` | Paginated user list with search, role, and ban status filters |
| `GetUser` | Get single user by ID |
| `UpdateUserRole` | Change user role (0=user, 1=admin) — cannot change own role |
| `BanUser` | Ban a user with optional reason — cannot ban admins or self |
| `UnbanUser` | Remove ban from a user |
| **News Management** (proxied to news-service) | |
| `CreateArticle` | Create article with type, categories, cover image |
| `DeleteArticle` | Delete article by ID |
| `GetUploadUrl` | Get presigned upload URL for media |
| `GetArticleStats` | Article statistics (total, by type, total views) |
| **Subscriptions** (proxied to subscription-service) | |
| `AdminSetSubscription` | Set subscription for any user by type and duration |
| `AdminRemoveSubscription` | Remove/terminate a user's subscription |
| `GetSubscriptionStats` | Subscription stats (active, expired, canceled, terminated, by tier) |
| **Promo Codes** (proxied to subscription-service) | |
| `CreatePromoCode` | Create promotional discount code |
| `ListPromoCodes` | List promo codes with pagination and active filter |
| `DeactivatePromoCode` | Deactivate a promo code |
| **Notifications** (proxied to notification-service) | |
| `AdminSendNotification` | Send email/in-app notification to a single user |
| `AdminSendBulkNotification` | Send notification to multiple users (batched, 50 at a time) |

## Project Structure

```text
src/
├── app.js                     # Entry point — boots Redis, then gRPC server
├── bin/
│   ├── server.js              # gRPC server setup and graceful shutdown
│   └── loader.js              # Proto file loader (keepCase: true)
├── config/
│   ├── variables.config.js    # Centralized env config
│   ├── db.js                  # Database connection
│   └── knex.config.js         # Knex configuration
├── controllers/               # gRPC handlers (call, callback pattern)
├── services/                  # Business logic (admin.service.js)
├── models/                    # Knex query builders (User.js)
├── grpc/
│   └── clients/               # Outbound gRPC clients
│       ├── news-client.js
│       ├── notification-client.js
│       └── subscription-client.js
├── middlewares/
│   └── validations/
│       ├── schemas/           # Joi validation schemas
│       └── validation.js
├── redis/                     # Redis client + cache operations
└── utils/                     # JWT, error-handler, success-handler, circuit-breaker, logger
proto/
├── admin.proto                # Service RPC definitions
├── news.proto                 # News service proto (for client)
├── notification.proto         # Notification service proto (for client)
└── subscription.proto         # Subscription service proto (for client)
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
# Edit .env with your values
```

### 3. Start infrastructure

```bash
docker compose up -d
```

### 4. Start the service

```bash
npm run dev
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `SERVICE_NAME` | `admin-service` | Service identifier |
| `SERVICE_ENV` | `production` | Environment |
| `SERVICE_PORT` | `50055` | gRPC server port |
| `SERVICE_LOG_LEVEL` | `info` | Winston log level |
| `PSQL_HOST` | — | PostgreSQL host |
| `PSQL_PORT` | `5432` | PostgreSQL port |
| `PSQL_USER` | — | PostgreSQL user |
| `PSQL_PASSWORD` | — | PostgreSQL password |
| `PSQL_DATABASE` | — | Database name (shared with auth-service) |
| `PSQL_SSL` | `false` | Enable SSL for PostgreSQL |
| `REDIS_URL` | — | Redis connection URL |
| `REDIS_HOST` | — | Redis host (fallback) |
| `REDIS_PORT` | `6379` | Redis port |
| `REDIS_PASSWORD` | — | Redis password |
| `REDIS_DB` | `0` | Redis database index |
| `REDIS_DASHBOARD_STATS_TTL` | `60` | Dashboard cache TTL (seconds) |
| `JWT_ACCESS_PUBLIC_KEY_PATH` | — | RS256 public key path |
| `JWT_ACCESS_ALG` | `RS256` | JWT signing algorithm |
| `NEWS_SERVICE_URL` | `localhost:50054` | News gRPC service address |
| `NOTIFICATION_SERVICE_URL` | `localhost:50053` | Notification gRPC service address |
| `SUBSCRIPTION_SERVICE_URL` | `localhost:50056` | Subscription gRPC service address |
| `GRPC_MAX_MESSAGE_SIZE` | `4194304` | Max gRPC message size (bytes) |

## Ban System

The ban feature spans two services:

- **Admin service** — exposes `BanUser`/`UnbanUser` RPCs, writes `banned_at` + `ban_reason` to the users table
- **Auth service** — checks `banned_at` during login and token refresh, blocks banned users from authenticating

The `banned_at` and `ban_reason` columns are defined in the auth-service migration since auth-service owns the users table.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start with nodemon (development) |
| `npm start` | Start in production mode |
| `npm run debug` | Start with Node.js inspector |
| `npm run reload` | Kill port 50055 and restart dev |
| `npm run proto:check` | Verify proto files |
| `npm run lint` | ESLint check |
| `npm run lint:fix` | ESLint auto-fix |
| `npm run format` | Prettier format |
| `npm run check-format` | Prettier check |

## Author

Serg
