# Admin Service — Project Guide

## Overview
gRPC-based admin microservice (Node.js, ES modules). Part of the Arbex microservices platform with a GraphQL gateway as the consumer. Handles dashboard analytics, user management, role updates, and bans.

## Tech Stack
- **Transport**: gRPC (`@grpc/grpc-js`, `@grpc/proto-loader`) — proto at `proto/admin.proto`
- **Database**: PostgreSQL via Knex.js — reads/writes to shared `arbex_auth` database (users, articles, categories tables)
- **Cache**: Redis (ioredis) — dashboard stats caching (60s TTL)
- **Auth**: RS256 JWT verification (public key only) + admin role enforcement
- **Resilience**: Circuit breakers via `opossum` (dbBreaker: 8s timeout, redisBreaker: 2s timeout, grpcBreaker: 10s timeout)
- **Outbound gRPC**: Calls news-service (article create/delete) and notification-service (send/bulk send) with access_token passthrough
- **Validation**: Joi schemas in middleware layer
- **Logging**: Winston

## Project Structure
```
src/
├── bin/            # gRPC server bootstrap + proto loader
├── config/         # variables.config.js (all env vars), db.js, knex.config.js
├── controllers/    # gRPC handlers (call, callback pattern)
├── grpc/
│   └── clients/    # Outbound gRPC clients (news-client.js, notification-client.js)
├── middlewares/    # Joi validation (schemas/ + validation.js)
├── models/         # Knex query builders (User.js)
├── services/       # Business logic (admin.service.js)
├── redis/          # Redis client + adminCache operations
├── utils/          # jwt, error-handler, success-handler, circuit-breaker, logger
└── app.js          # Entry point — boots Redis, then gRPC server
proto/admin.proto   # All RPC definitions
```

## Key Patterns

### gRPC Handler Pattern
Controllers follow: `static async methodName(call, callback)` → validate → call service → SuccessHandler / ErrorHandler

### Admin Role Enforcement
Every service method calls `requireAdmin(JwtUtil.verifyAccessToken(accessToken))` which:
1. Verifies JWT with RS256 public key
2. Checks `decoded.role === 1` (admin)
3. Throws `UnauthorizedError` or `Forbidden` on failure

### Error Handling
Custom error classes in `error-handler.util.js` map to gRPC status codes:
- `ConflictError` → `ALREADY_EXISTS`
- `Forbidden` → `PERMISSION_DENIED`
- `InputValidationError` → `INVALID_ARGUMENT`
- `ResourceNotFoundError` → `NOT_FOUND`
- `UnauthorizedError` → `UNAUTHENTICATED`

### Cache Strategy
Dashboard stats use read-through caching:
1. Try Redis cache via `redisBreaker.fire()`
2. Cache miss → parallel DB queries via `dbBreaker.fire()`
3. Fire-and-forget cache population
4. 60s TTL on `admin:dashboard:stats` key

### Ban System
- Admin service writes `banned_at` + `ban_reason` to users table via `BanUser`/`UnbanUser` RPCs
- Auth service checks `banned_at` during login and token refresh (blocks banned users)
- Ban columns are defined in auth-service's migration (auth owns the users table)
- Cannot ban yourself or other admins

## gRPC RPCs (port 50055)
| RPC | Description |
|-----|-------------|
| `GetDashboardStats` | Aggregate stats (users, articles, categories, views, today counts) |
| `ListUsers` | Paginated list with search, role filter, ban status filter |
| `GetUser` | Single user by ID |
| `UpdateUserRole` | Change role (0=user, 1=admin), cannot change own role |
| `BanUser` | Ban user with optional reason, cannot ban admins or self |
| `UnbanUser` | Remove ban from user |
| `CreateArticle` | Create article (proxied to news-service) |
| `DeleteArticle` | Delete article (proxied to news-service) |
| `AdminSendNotification` | Send notification to single user (proxied to notification-service) |
| `AdminSendBulkNotification` | Send notification to multiple users (fan-out via notification-service) |

## Database
Reads/writes to shared `arbex_auth` PostgreSQL database. Does NOT own the schema — auth-service manages migrations.

Tables accessed:
- `users` — all operations
- `articles` — dashboard stats (count, today count, view sum)
- `categories` — dashboard stats (count)

## NPM Scripts
- `npm run dev` — development with nodemon
- `npm start` — production

## Bulk Notification — Current Limitations & Future Plan

### Current approach

`sendBulkNotification` queries all eligible users (or uses an explicit recipient list), then sends individual gRPC calls to notification-service in batches of 50 via `Promise.allSettled`. Works reliably for ~500 recipients. Beyond that, the gateway→admin-service gRPC call risks timing out while the admin-service loop continues silently.

### Known limitations

- **No retry** — failed sends are counted but never retried
- **No progress visibility** — admin gets no feedback until the entire operation finishes (or times out)
- **No cancellation** — once started, the batch loop runs to completion
- **Memory** — `getAllEmails()` loads all user rows at once

### Future: queue-based architecture

Replace the synchronous batch loop with a message queue (RabbitMQ or similar):

```text
Admin → admin-service
      → creates bulk_job record (status: pending)
      → publishes job to queue
      → returns job_id immediately

Queue consumer (notification-service worker):
      → reads job, chunks recipients
      → sends one email per recipient with retry (3 attempts, exponential backoff)
      → updates job progress in DB (sent/failed/total)
      → marks job complete/failed when done

Admin panel:
      → polls job status via GetBulkJobStatus RPC
      → shows progress bar, sent/failed counts
```

This requires: RabbitMQ infrastructure, a `bulk_jobs` table (job_id, status, total, sent, failed, created_at), a consumer/worker process in notification-service, and a new `GetBulkJobStatus` RPC in admin-service.

## Related Services
- **GraphQL Gateway**: Consumer of this service's gRPC API, enforces `@requireRole(role: ADMIN)` directive
- **Auth Service**: Owns the users table, enforces ban checks on login/refresh
- **News Service**: Article CRUD — admin-service proxies create/delete calls with access_token passthrough (news-service validates admin role independently)
- **Notification Service**: Email/in-app notifications — admin-service calls `SendNotification` for single and bulk sends (type: `manual`, uses `manual.hbs` template)
