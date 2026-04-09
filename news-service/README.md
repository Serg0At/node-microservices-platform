# News Service

News and blog content management microservice for the Arbex platform. Manages articles, categories, media uploads (S3/MinIO), and full-text search.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Node.js (ES modules) |
| Transport | gRPC (`@grpc/grpc-js`, `@grpc/proto-loader`) |
| Database | PostgreSQL via Knex.js (`articles`, `categories`) |
| Cache | Redis (ioredis) — article, list, search, and category caches |
| Messaging | RabbitMQ (amqplib) — topic exchange `news-events` |
| Media Storage | S3-compatible (MinIO) via `@aws-sdk/client-s3` — presigned upload URLs |
| Auth | RS256 JWT verification (public key only — does not issue tokens) |
| Search | PostgreSQL full-text search (GIN index on `to_tsvector`) |
| Resilience | Circuit breakers via `opossum` (DB, Redis, RabbitMQ, S3) |
| Validation | Joi schemas |
| Logging | Winston |

## Architecture

```text
GraphQL Gateway
      |
      | gRPC (:50054)
      v
 News Service
      |
      ├── PostgreSQL   (articles, categories — with GIN full-text index)
      ├── Redis        (article cache, list cache, search cache)
      ├── RabbitMQ     (news-events → article lifecycle events)
      └── S3/MinIO     (media file storage — presigned upload URLs)
```

## gRPC API (port 50054)

Defined in `proto/news.proto`:

| RPC | Auth | Description |
|-----|------|-------------|
| `CreateArticle` | Admin | Create article with title, content, categories, cover image |
| `DeleteArticle` | Admin | Delete article by ID |
| `GetArticle` | None | Get article by ID or slug |
| `ListArticles` | None | Paginated list with category, status, author, sort filters |
| `SearchArticles` | None | Full-text search across title and content |
| `GetUploadUrl` | Token | Get presigned S3 upload URL for media |
| `GetArticleStats` | Admin | Aggregate stats (total, by type, total views) |

## Article Status Values

| Value | Status |
|-------|--------|
| 0 | Draft |
| 1 | Published |
| 2 | Archived |

## Authorization

- **Articles**: Any authenticated user can create. Only the author (or admin `role=1`) can update/delete.
- **Categories**: Admin-only for create/update/delete. Public listing.
- **Media**: Any authenticated user can request upload URLs.

## Project Structure

```text
src/
├── app.js                     # Entry point — boots Redis, RabbitMQ, S3, then gRPC server
├── bin/
│   ├── server.js              # gRPC server setup and graceful shutdown
│   └── loader.js              # Proto file loader (keepCase: true)
├── config/
│   ├── variables.config.js    # Centralized env config
│   ├── db.js                  # Database connection
│   └── knex.config.js         # Knex configuration
├── controllers/
│   ├── article.controller.js  # Article + Media RPC handlers
│   └── category.controller.js # Category RPC handlers
├── services/
│   ├── article.service.js     # CRUD, list, search with caching
│   ├── category.service.js    # CRUD with admin-only access
│   └── media.service.js       # S3 presigned URL generation
├── models/                    # Knex query builders (Article.js, Category.js)
├── middlewares/               # Joi validation (schemas/ + validation.js)
├── rabbit/                    # RabbitMQ publisher (news-events exchange)
├── redis/                     # Redis client + cache operations
├── s3/                        # S3/MinIO client + presigned URL helper
└── utils/                     # JWT (verify only), error-handler, success-handler, circuit-breaker, logger, slug
proto/news.proto               # All RPC definitions
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
| `SERVICE_NAME` | `news-service` | Service identifier |
| `SERVICE_ENV` | `production` | Environment |
| `SERVICE_PORT` | `50054` | gRPC server port |
| `SERVICE_LOG_LEVEL` | `info` | Winston log level |
| `PSQL_HOST` | — | PostgreSQL host |
| `PSQL_PORT` | `5432` | PostgreSQL port |
| `PSQL_USER` | — | PostgreSQL user |
| `PSQL_PASSWORD` | — | PostgreSQL password |
| `PSQL_DATABASE` | — | Database name |
| `PSQL_SSL` | `false` | Enable SSL for PostgreSQL |
| `REDIS_URL` | — | Redis connection URL |
| `REDIS_ARTICLE_CACHE_TTL` | `900` | Article cache TTL — 15 min (seconds) |
| `REDIS_LATEST_LIST_TTL` | `300` | List cache TTL — 5 min (seconds) |
| `REDIS_SEARCH_CACHE_TTL` | `300` | Search cache TTL — 5 min (seconds) |
| `RABBITMQ_HOST` | — | RabbitMQ host |
| `RABBITMQ_PORT` | `5672` | RabbitMQ port |
| `RABBITMQ_USER` | — | RabbitMQ username |
| `RABBITMQ_PASSWORD` | — | RabbitMQ password |
| `RMQ_EXCHANGE` | `news-events` | News events exchange |
| `RMQ_EXCHANGE_TYPE` | `topic` | Exchange type |
| `S3_ENDPOINT` | — | S3/MinIO endpoint URL |
| `S3_REGION` | `us-east-1` | S3 region |
| `S3_ACCESS_KEY` | — | S3 access key |
| `S3_SECRET_KEY` | — | S3 secret key |
| `S3_BUCKET` | `news-media-bucket` | S3 bucket name |
| `S3_PRESIGNED_EXPIRES` | `3600` | Presigned URL expiry (seconds) |
| `S3_FORCE_PATH_STYLE` | `true` | Force path-style URLs (required for MinIO) |
| `JWT_ACCESS_PUBLIC_KEY_PATH` | — | RS256 public key path |
| `JWT_ACCESS_ALG` | `RS256` | JWT signing algorithm |
| `GRPC_MAX_MESSAGE_SIZE` | `4194304` | Max gRPC message size (bytes) |

## Redis Cache Strategy

| Key Pattern | TTL | Description |
|------------|-----|-------------|
| `news:article:{id}` | 15 min | Single article cache |
| `news:latest:{page}:{limit}` | 5 min | Paginated article list |
| `news:popular:{category}` | 30 min | Popular articles by category |
| `news:search:{md5hash}` | 5 min | Search result cache |

On article create/update/delete: invalidates specific article cache + all list/search caches.

## RabbitMQ Events

Published on `news-events` topic exchange:

| Routing Key | Payload |
|-------------|---------|
| `article.created` | `{ article_id, title, slug, author_id, status }` |
| `article.updated` | `{ article_id, title, slug, changes }` |
| `article.published` | `{ article_id, title, slug }` (when status changes to 1) |
| `article.deleted` | `{ article_id }` |

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start with nodemon (development) |
| `npm start` | Start in production mode |
| `npm run debug` | Start with Node.js inspector |
| `npm run reload` | Kill port 50054 and restart dev |
| `npm run migrate` | Run database migrations |
| `npm run migrate-down` | Drop database tables |
| `npm run proto:check` | Verify proto files |
| `npm test` | Run tests (Jest) |
| `npm run test:watch` | Run tests in watch mode |
| `npm run lint` | ESLint check |
| `npm run lint:fix` | ESLint auto-fix |
| `npm run format` | Prettier format |
| `npm run check-format` | Prettier check |

## Author

Serg
