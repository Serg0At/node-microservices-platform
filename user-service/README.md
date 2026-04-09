# User Service

User profile management microservice for the Arbex platform. Owns user profile data (display name, avatar), exposes gRPC RPCs for reading and updating profiles, and stores avatars in MinIO (S3-compatible).

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Node.js (ES modules) |
| Transport | gRPC (`@grpc/grpc-js`, `@grpc/proto-loader`) |
| Database | PostgreSQL via Knex.js (`profiles` table) |
| Cache | Redis (ioredis) — profile caching (5 min TTL) |
| Messaging | RabbitMQ (amqplib) — consumes auth-events, publishes user events |
| Media Storage | MinIO (S3-compatible) via `@aws-sdk/client-s3` — avatar uploads |
| Auth | RS256 JWT verification (public key only) |
| Resilience | Circuit breakers via `opossum` |
| Validation | Joi schemas |
| Logging | Winston |

## Architecture

```text
GraphQL Gateway
      |
      | gRPC (:50052)
      v
 User Service
      |
      ├── PostgreSQL   (profiles table)
      ├── Redis        (profile cache — 5 min TTL)
      ├── RabbitMQ     (consumes auth-events, publishes user events)
      └── MinIO        (avatar storage)
```

## gRPC API (port 50052)

Defined in `proto/user.proto`:

| RPC | Auth | Description |
|-----|------|-------------|
| `GetProfile` | None | Fetch a user's public profile by user ID |
| `UpdateProfile` | Token | Update username and/or display name |
| `UploadAvatar` | Token | Upload avatar image (accepts raw bytes) |

## RabbitMQ Events

### Consumed

| Routing Key | Action |
|-------------|--------|
| `user.registered` | Creates a profile row when a new user registers via auth-service |

### Published

| Routing Key | Trigger |
|-------------|---------|
| `user.profile_updated` | Non-username profile fields changed |
| `user.username_changed` | Username changed (auth-service syncs this) |

## Project Structure

```text
src/
├── app.js                     # Entry point
├── bin/
│   ├── server.js              # gRPC server setup and graceful shutdown
│   └── loader.js              # Proto file loader
├── config/
│   ├── variables.config.js    # Centralized env config
│   ├── db.js                  # Database connection
│   └── knex.config.js         # Knex configuration
├── controllers/               # gRPC RPC handlers
├── services/                  # Business logic
├── models/                    # Knex query builders (profiles table)
├── middlewares/                # Joi validation middleware
├── rabbit/                    # RabbitMQ consumer (auth-events)
├── redis/                     # Redis client + profile caching
└── utils/                     # JWT, error handling, logger, circuit breakers
proto/user.proto               # gRPC service definition
migrations/                    # Database table creation/teardown
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

### 3. Add JWT public key

```bash
mkdir -p keys
cp ../auth-service/keys/access_public.pem ./keys/
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
| `SERVICE_NAME` | `user-service` | Service identifier |
| `SERVICE_ENV` | `production` | Environment |
| `SERVICE_PORT` | `50052` | gRPC server port |
| `SERVICE_LOG_LEVEL` | `info` | Winston log level |
| `PSQL_HOST` | — | PostgreSQL host |
| `PSQL_PORT` | `5432` | PostgreSQL port |
| `PSQL_USER` | — | PostgreSQL user |
| `PSQL_PASSWORD` | — | PostgreSQL password |
| `PSQL_DATABASE` | — | Database name |
| `PSQL_SSL` | `false` | Enable SSL for PostgreSQL |
| `REDIS_URL` | — | Redis connection URL |
| `REDIS_PROFILE_CACHE_TTL` | `300` | Profile cache TTL — 5 min (seconds) |
| `JWT_ACCESS_ALG` | `RS256` | JWT signing algorithm |
| `JWT_ACCESS_PUBLIC_KEY_PATH` | — | RS256 public key path |
| `RABBITMQ_HOST` | — | RabbitMQ host |
| `RABBITMQ_PORT` | `5672` | RabbitMQ port |
| `RABBITMQ_USER` | — | RabbitMQ username |
| `RABBITMQ_PASSWORD` | — | RabbitMQ password |
| `RMQ_EXCHANGE` | `auth-events` | Auth events exchange to consume |
| `RMQ_EXCHANGE_TYPE` | `topic` | Exchange type |
| `MINIO_ENDPOINT` | `http://minio:9000` | MinIO endpoint URL |
| `MINIO_PUBLIC_URL` | `http://localhost:9000` | Public MinIO URL (for avatar URLs) |
| `MINIO_ACCESS_KEY` | `minioadmin` | MinIO access key |
| `MINIO_SECRET_KEY` | `minioadmin` | MinIO secret key |
| `MINIO_BUCKET` | `arbex-assets` | MinIO bucket name |
| `MINIO_REGION` | `us-east-1` | MinIO region |
| `GRPC_MAX_MESSAGE_SIZE` | `4194304` | Max gRPC message size (bytes) |

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start with nodemon (development) |
| `npm start` | Start in production mode |
| `npm run debug` | Start with Node.js inspector |
| `npm run reload` | Kill port 50052 and restart dev |
| `npm run migrate` | Run database migrations |
| `npm run migrate-down` | Drop database tables |
| `npm run seed:avatars` | Seed default avatars to MinIO |
| `npm run seed:avatars:force` | Force reseed avatars |
| `npm run proto:check` | Verify proto files |
| `npm run lint` | ESLint check |
| `npm run lint:fix` | ESLint auto-fix |
| `npm run format` | Prettier format |
| `npm run check-format` | Prettier check |

## Author

Serg
