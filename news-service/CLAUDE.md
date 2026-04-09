# News Service — Project Guide

## Overview
gRPC-based news and blog content management microservice (Node.js, ES modules). Part of a larger microservices architecture with a GraphQL gateway as the consumer. Manages articles (blog/news) and media uploads. Admin-only publishing — users are read-only consumers.

## Tech Stack
- **Transport**: gRPC (`@grpc/grpc-js`, `@grpc/proto-loader`) — proto at `proto/news.proto`
- **Database**: PostgreSQL via Knex.js (table: `articles`)
- **Cache**: Redis (ioredis) — article cache, list cache, search cache
- **Messaging**: RabbitMQ (amqplib) — topic exchange `news-events` for article lifecycle events
- **Media Storage**: S3-compatible (MinIO) via `@aws-sdk/client-s3` — pre-signed upload URLs
- **Auth**: JWT verification only (RS256 public key from auth-service) — this service does NOT issue tokens
- **Resilience**: Circuit breakers via `opossum` (dbBreaker, redisBreaker, rabbitBreaker, s3Breaker)
- **Validation**: Joi schemas in middleware layer
- **Logging**: Winston (structured JSON for Filebeat ingestion)
- **Search**: PostgreSQL full-text search (GIN index on `to_tsvector`)

## Project Structure
```
src/
├── bin/            # gRPC server bootstrap + proto loader
├── config/         # variables.config.js (all env vars), db.js, knex.config.js
├── controllers/    # gRPC handlers (call, callback pattern)
│   └── article.controller.js   # Article + Media + Stats RPC handlers
├── middlewares/    # Joi validation (schemas/ + validation.js)
├── models/         # Knex query builders (Article.js)
├── services/       # Business logic
│   ├── article.service.js      # Create, delete, list, search, stats
│   └── media.service.js        # S3 pre-signed URL generation (admin-only)
├── rabbit/         # RabbitMQ publisher (news-events exchange)
├── redis/          # Redis client + cache operations (redisOps)
├── s3/             # S3/MinIO client + pre-signed URL helper
├── utils/          # jwt (verify only), error-handler, success-handler, circuit-breaker, logger, slug
└── app.js          # Entry point — boots Redis, RabbitMQ, S3, then gRPC server
proto/news.proto    # All RPC definitions
migrations/         # create_tables.js / drop_tables.js
```

## Key Patterns

### gRPC Handler Pattern
Controllers follow: `static async methodName(call, callback)` → validate → call service → SuccessHandler / ErrorHandler

### Error Handling
Custom error classes in `error-handler.util.js` map to gRPC status codes:
- `ConflictError` → ALREADY_EXISTS
- `Forbidden` → PERMISSION_DENIED
- `InputValidationError` → INVALID_ARGUMENT
- `UnauthorizedError` → UNAUTHENTICATED
- `ResourceNotFoundError` → NOT_FOUND
- PostgreSQL constraint errors auto-mapped via PG error codes

### Redis Key Patterns
- `news:article:{id}` — single article cache (TTL: 15min)
- `news:latest:{page}:{limit}` — paginated article list (TTL: 5min)
- `news:search:{md5hash}` — search result cache (TTL: 5min)

### RabbitMQ Events
Published via `publishNewsEvent(routingKey, payload)` on `news-events` topic exchange:
- `article.created` — { article_id, title, slug, author_id, type, ts }
- `article.deleted` — { article_id, ts }

### Article Type Values
- `blog` — Blog post
- `news` — News article

### Authorization
- **Articles**: Admin-only (`role === 1`) for create and delete. Public read (list, get, search).
- **Media**: Admin-only (`role === 1`) for upload URL generation.
- **Stats**: Admin-only (`role === 1`) for dashboard statistics.
- JWT tokens are **verified only** — this service uses the auth-service's public key.

### Full-Text Search
PostgreSQL GIN index on `to_tsvector('english', title || content)`. Uses `plainto_tsquery` for user queries and `ts_rank` for relevance scoring.

### Slug Generation
Auto-generated from title via `slugify`. Uniqueness ensured by appending `-N` suffix if slug exists.

### View Count
Incremented on every `GetArticle` call (fire-and-forget, non-blocking). Cached articles still trigger view count increment in the database.

### Cache Invalidation Strategy
- On article create/delete: invalidate the specific article cache + all list/search caches
- Uses `KEYS` pattern scan for bulk invalidation (acceptable at low-moderate traffic)

### Audit Logging
Admin actions (article create/delete) are logged as structured JSON via Winston with `action`, `admin_id`, `article_id`, and `title` fields. Designed for Filebeat ingestion.

## NPM Scripts
- `npm run dev` — development with nodemon
- `npm run start` — production
- `npm run migrate` / `npm run migrate-down` — DB migrations
- `npm run reload` — kill port 50054 + restart dev
- `npm test` — Jest with ES module support
- `npm run test:watch` — Jest watch mode

## Important Notes
- Proto is loaded once at startup (`src/bin/loader.js`) with `keepCase: true` — restart server after proto changes
- This service only **verifies** JWTs (public key), it does NOT issue them
- S3 uploads use pre-signed PUT URLs — the client uploads directly to S3/MinIO
- Articles have no edit/update capability — create or delete only
- Articles have no draft/archive status — all articles are published immediately on creation
- No tags, no categories — article `type` (blog/news) is the only grouping

## Related Services
- **Auth Service**: Issues JWTs — this service uses its public key to verify tokens
- **GraphQL Gateway**: Consumer of this service's gRPC API
- **User Service**: Provides author profiles (username, display_name, avatar)
- **Subscription Service**: Manages subscriptions — admin dashboard fetches stats from it
- **Notification Service**: May consume `article.created` events to notify subscribers
