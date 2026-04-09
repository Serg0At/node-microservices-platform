# Node Microservices Platform

A production-ready microservices backend built with Node.js. Features a GraphQL gateway backed by eight independent gRPC services, event-driven communication via RabbitMQ and Kafka, and a full auth system with JWT, 2FA, and Google OAuth.

## Architecture

```
Client Apps (Web / Mobile)
        │
        │ HTTPS
        ▼
┌─────────────────────┐
│   GraphQL Gateway   │  :4000  Apollo Server v4 + Express
└──────────┬──────────┘
           │ gRPC
     ┌─────┴──────────────────────────────────────┐
     │                                            │
     ▼                                            ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐
│ auth-service │  │ user-service │  │ notification-service  │
│   :50051     │  │   :50052     │  │       :50053          │
└──────────────┘  └──────────────┘  └──────────────────────┘
┌──────────────┐  ┌──────────────────────┐  ┌──────────────┐
│ news-service │  │  subscription-service│  │admin-service │
│   :50054     │  │       :50056         │  │   :50055     │
└──────────────┘  └──────────────────────┘  └──────────────┘
                  ┌──────────────┐
                  │payment-service│
                  │  :50057 (gRPC)│
                  │  :3001  (HTTP)│  ← payment provider webhooks
                  └──────────────┘
```

### Infrastructure

| Component | Purpose |
|-----------|---------|
| PostgreSQL | Primary data store — each service owns its tables |
| Redis | Caching, sessions, refresh tokens, idempotency keys |
| RabbitMQ | Service-to-service events via topic exchanges |
| Kafka | Event streaming for data pipelines |
| MinIO | S3-compatible object storage — avatars, article media |

## Services

| Service | Port | Description |
|---------|------|-------------|
| [graphql-gateway](./graphql-gateway) | 4000 | Single HTTP entry point — proxies all requests to backend services via gRPC |
| [auth-service](./auth-service) | 50051 | Registration, login, JWT tokens, 2FA (TOTP), Google OAuth, password reset, email verification |
| [user-service](./user-service) | 50052 | User profiles, avatar uploads (MinIO) |
| [notification-service](./notification-service) | 50053 | In-app notifications + transactional email (SMTP + Handlebars) |
| [news-service](./news-service) | 50054 | Articles, categories, full-text search (PostgreSQL GIN), media via S3 |
| [admin-service](./admin-service) | 50055 | Admin dashboard, user management, ban/unban, stats, proxies to other services |
| [subscription-service](./subscription-service) | 50056 | Subscription plans, free trials, proration, promo codes, grace periods |
| [payment-service](./payment-service) | 50057 / 3001 | Crypto payments (Cryptomus) and card payments (Fondy), webhook processing |

## Key Features

- **GraphQL API** — single endpoint for all client operations with custom `@auth`, `@requireRole`, and `@rateLimit` directives
- **gRPC internally** — all service-to-service communication uses Protocol Buffers over gRPC
- **Event-driven** — RabbitMQ topic exchanges connect services without tight coupling (e.g. auth publishes `user.registered`, user-service and notification-service consume it)
- **Auth** — RS256 JWT access tokens, opaque refresh tokens in Redis, 2FA via TOTP, Google OIDC
- **Resilience** — circuit breakers (`opossum`) on all external calls in every service
- **Payments** — dual provider support (crypto + card), idempotency keys, webhook handlers always return 200 to prevent retries
- **Admin** — dedicated admin service with role enforcement, dashboard stats, promo code management, manual subscription control

## Tech Stack

- **Runtime**: Node.js 20+ (ES modules)
- **API layer**: Apollo Server v4, GraphQL, Express
- **Inter-service**: gRPC (`@grpc/grpc-js`), Protocol Buffers
- **Database**: PostgreSQL + Knex.js
- **Cache**: Redis (ioredis)
- **Messaging**: RabbitMQ (amqplib), Kafka
- **Storage**: MinIO / S3 (`@aws-sdk/client-s3`)
- **Auth**: JWT (RS256 + HS256), bcrypt, TOTP (`otplib`)
- **Validation**: Joi
- **Logging**: Winston
- **Infrastructure**: Docker, Docker Compose

## Getting Started

### Prerequisites

- Node.js 20+
- Docker & Docker Compose

### 1. Start infrastructure

```bash
cd infra
docker compose up -d
```

This starts PostgreSQL, Redis, RabbitMQ, Kafka, and MinIO.

### 2. Install dependencies

```bash
npm run install:all
```

### 3. Configure each service

Each service has an `.env.example` — copy it and fill in the values:

```bash
cp auth-service/.env.example auth-service/.env
cp user-service/.env.example user-service/.env
# ... repeat for each service
```

### 4. Generate RSA keys (auth-service)

```bash
mkdir -p auth-service/keys
openssl genrsa -out auth-service/keys/access_private.pem 2048
openssl rsa -in auth-service/keys/access_private.pem -pubout -out auth-service/keys/access_public.pem

# Copy public key to services that verify tokens
cp auth-service/keys/access_public.pem user-service/keys/
cp auth-service/keys/access_public.pem graphql-gateway/keys/
cp auth-service/keys/access_public.pem news-service/keys/
cp auth-service/keys/access_public.pem subscription-service/keys/
cp auth-service/keys/access_public.pem admin-service/keys/
```

### 5. Run migrations

```bash
npm run migrate:all
```

### 6. Start all services

```bash
npm run dev
```

Or start individual services:

```bash
npm run dev:auth
npm run dev:gateway
# etc.
```

The GraphQL API will be available at `http://localhost:4000/graphql`.

## Project Structure

```
.
├── graphql-gateway/        # Apollo Server — public API entry point
├── auth-service/           # Authentication & authorization
├── user-service/           # User profiles
├── notification-service/   # Emails & in-app notifications
├── news-service/           # Articles & categories
├── admin-service/          # Admin operations
├── subscription-service/   # Subscription plans & billing
├── payment-service/        # Payment processing & webhooks
├── infra/                  # Docker Compose for infrastructure
├── docs/                   # Architecture docs & service specs
└── docker-compose.yml      # Full stack compose file
```

Each service is a standalone Node.js application with its own `package.json`, database migrations, proto definitions, and Docker config. See the individual service READMEs for details.

## Deployment

See [docs/deployment-architecture.md](./docs/deployment-architecture.md) for the full deployment plan — covers infrastructure layout, VPS sizing, network configuration, backup strategy, and scaling phases.

## Author

Serg
