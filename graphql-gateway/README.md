# GraphQL Gateway

Apollo Server v4 GraphQL gateway for the Arbex microservices platform. Single HTTP entry point for all client applications — proxies requests to six backend gRPC services.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Apollo Server v4 + Express v4 |
| Transport to backends | gRPC (`@grpc/grpc-js`, `@grpc/proto-loader`) |
| Auth | RS256 JWT verification (public key only) |
| Validation | Joi (`abortEarly: false`) |
| Logging | Winston (console + file transports) |
| Rate Limiting | `express-rate-limit` + custom `@rateLimit` directive |
| Security | Helmet, CORS |

## Architecture

```text
Client Apps (Web, Mobile)
        |
        | HTTP POST /graphql
        v
  GraphQL Gateway (:4000)
        |
        ├── auth-service          (gRPC :50051)
        ├── user-service          (gRPC :50052)
        ├── notification-service  (gRPC :50053)
        ├── news-service          (gRPC :50054)
        ├── admin-service         (gRPC :50055)
        └── subscription-service  (gRPC :50056)
```

## GraphQL Directives

| Directive | Description |
|-----------|-------------|
| `@auth` | Blocks unauthenticated access — requires valid JWT |
| `@requireRole(role: ADMIN)` | Requires admin role (role=1) in JWT |
| `@rateLimit(max, window)` | Per-IP rate limiting on specific mutations |

## Resolvers

| File | Domain | Key Operations |
|------|--------|---------------|
| `auth.resolver.js` | Authentication | Register, login, OIDC, 2FA, password reset, token refresh, logout |
| `user.resolver.js` | User profiles | Get/update profile, upload avatar |
| `news.resolver.js` | Articles & categories | CRUD articles, search, categories, media upload |
| `notification.resolver.js` | Notifications | List, mark read, delete, unread count |
| `subscription.resolver.js` | Subscriptions | Get subscription, checkout with promo codes, cancel, restore, validate promo |
| `admin.resolver.js` | Admin panel | Dashboard stats, user management, ban/unban, article stats, subscription management, promo code CRUD, send notifications |

## Project Structure

```text
src/
├── app.js                          # Express + Apollo Server setup
├── config/
│   ├── variables.config.js         # Environment variables
│   └── grpc-clients.js             # Proto loading + gRPC client singletons
├── graphql/
│   ├── typeDefs/
│   │   └── schema.graphql          # Full GraphQL schema
│   ├── resolvers/
│   │   ├── admin.resolver.js       # Admin operations (17 resolvers)
│   │   ├── auth.resolver.js        # Auth mutations (13 operations)
│   │   ├── news.resolver.js        # News queries + mutations
│   │   ├── notification.resolver.js # Notification operations
│   │   ├── subscription.resolver.js # Subscription + promo code operations
│   │   └── user.resolver.js        # User profile operations
│   └── directives/
│       ├── auth.directive.js        # @auth directive
│       ├── rate-limit.directive.js  # @rateLimit directive
│       └── require-role.directive.js # @requireRole directive
├── grpc/
│   ├── clients/
│   │   ├── admin-client.js          # Admin service (17 RPCs)
│   │   ├── auth-client.js           # Auth service (12 RPCs)
│   │   ├── news-client.js           # News service RPCs
│   │   ├── notification-client.js   # Notification service RPCs
│   │   ├── subscription-client.js   # Subscription service RPCs
│   │   └── user-client.js           # User service RPCs
│   └── protos/                      # Proto files (synced from each service)
│       ├── admin.proto
│       ├── auth.proto
│       ├── news.proto
│       ├── notification.proto
│       ├── subscription.proto
│       └── user.proto
├── middlewares/
│   ├── auth-context.js              # JWT extraction → Apollo context
│   └── validations/
│       ├── validation.js            # Validation class (static methods)
│       └── schemas/
│           ├── admin.schemas.js
│           ├── auth.schemas.js
│           ├── news.schemas.js
│           ├── notification.schemas.js
│           └── user.schemas.js
└── utils/
    ├── audit.js                     # Admin action audit logging
    ├── error-formatter.js           # gRPC → GraphQL error mapping
    ├── jwt-verify.js                # RS256 public key verification
    └── logger.js                    # Winston logger (console + file)
```

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/graphql` | GraphQL API |
| GET | `/health` | Health check — `{ "status": "ok" }` |

## Getting Started

### Prerequisites

- Node.js 18+
- Running backend services (auth, user, notification, news, admin, subscription)
- RSA public key for JWT verification

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

### 3. Add JWT public key

```bash
mkdir -p keys
cp ../auth-service/keys/access_public.pem ./keys/
```

### 4. Start the server

```bash
# Development (with hot reload)
npm run dev

# Production
npm start
```

The gateway starts at `http://localhost:4000/graphql`.

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `SERVICE_PORT` | `4000` | HTTP server port |
| `SERVICE_ENV` | `development` | Environment |
| `AUTH_SERVICE_URL` | `localhost:50051` | Auth gRPC service address |
| `USER_SERVICE_URL` | `localhost:50052` | User gRPC service address |
| `NOTIFICATION_SERVICE_URL` | `localhost:50053` | Notification gRPC service address |
| `NEWS_SERVICE_URL` | `localhost:50054` | News gRPC service address |
| `ADMIN_SERVICE_URL` | `localhost:50055` | Admin gRPC service address |
| `SUBSCRIPTION_SERVICE_URL` | `localhost:50056` | Subscription gRPC service address |
| `JWT_ACCESS_PUBLIC_KEY_PATH` | `./keys/access_public.pem` | Path to RS256 public key |
| `JWT_ACCESS_ALG` | `RS256` | JWT signing algorithm |
| `JWT_AUDIENCE` | `graphql-gateway` | Expected JWT audience claim |
| `JWT_ISSUER` | `auth-service` | Expected JWT issuer claim |
| `RATE_LIMIT_WINDOW_MS` | `60000` | Express rate limit window (ms) |
| `RATE_LIMIT_MAX` | `100` | Max requests per window |
| `CORS_ORIGIN` | `http://localhost:3000` | Allowed CORS origin |
| `LOG_LEVEL` | `info` | Winston log level |

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start with --watch (development) |
| `npm start` | Start in production mode |

## Author

Serg
