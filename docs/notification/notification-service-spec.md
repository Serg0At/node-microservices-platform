# Notification Service — Project Guide

## Overview
Notification microservice that consumes RabbitMQ events from auth-service (and other services) and delivers notifications via email. Exposes a gRPC API for notification management (CRUD, stats, delivery logs). Designed to support in-app notifications (WebSocket/SSE) in the future.

## Tech Stack
- **Runtime**: Node.js, ES modules
- **Transport**: gRPC (`@grpc/grpc-js`, `@grpc/proto-loader`) — for notification management API
- **Messaging**: RabbitMQ (amqplib) — consumes events from `auth-events` topic exchange
- **Email**: Nodemailer with SMTP transport
- **Templates**: Handlebars (`.hbs` files) for HTML email templates
- **Database**: PostgreSQL via Knex.js — source of truth for all notification records (full audit)
- **Cache**: Redis (ioredis) — hot layer for unread counts and recent notification IDs per user
- **Resilience**: Circuit breakers via `opossum` (dbBreaker, redisBreaker, rabbitBreaker, smtpBreaker)
- **Validation**: Joi schemas in middleware layer
- **Logging**: Winston

## Project Structure
```
src/
├── bin/
│   ├── server.js              # gRPC server bootstrap
│   └── loader.js              # Proto loader
├── config/
│   ├── variables.config.js    # All env vars
│   ├── db.js                  # Knex instance
│   └── knex.config.js         # Knex migration config
├── controllers/
│   └── notification.controller.js  # gRPC handlers
├── middlewares/
│   └── validations/
│       ├── schemas/
│       │   └── notification.schemas.js
│       └── validation.js
├── models/
│   └── Notification.js        # Knex query builder for notifications table
├── services/
│   ├── notification.service.js # Business logic (CRUD, stats)
│   └── email.service.js        # Email sending via Nodemailer
├── rabbit/
│   ├── consumer.js            # Consumes auth-events, dispatches to handlers
│   └── handlers/
│       ├── user.registered.js
│       ├── user.verify_email.js
│       ├── user.forgot_password.js
│       ├── user.logged_in.js
│       ├── user.password_changed.js
│       └── user.2fa_enabled.js
├── redis/
│   ├── client.js              # Redis connection
│   └── notificationCache.js   # Unread counts, recent notification IDs
├── templates/
│   ├── layouts/
│   │   └── base.hbs           # Base HTML layout (header, footer, styles)
│   ├── welcome.hbs            # user.registered
│   ├── verify-email.hbs       # user.verify_email
│   ├── forgot-password.hbs    # user.forgot_password
│   ├── password-changed.hbs   # user.password_changed
│   ├── new-login.hbs          # user.logged_in
│   └── 2fa-enabled.hbs        # user.2fa_enabled
├── utils/
│   ├── logger.util.js
│   ├── error-handler.util.js
│   ├── success-handler.util.js
│   └── circuit-breaker.util.js
├── migrations/
│   ├── create_notifications.js
│   └── create_notification_archive.js
└── app.js                     # Entry point — boots Redis, RabbitMQ, DB, gRPC server
proto/
└── notification.proto         # gRPC service definition
```

## Database

### `notifications` table (source of truth)
| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | `bigserial` | PK | |
| `user_id` | `bigint` | NOT NULL, indexed | Recipient |
| `type` | `varchar(50)` | NOT NULL | Event type: `welcome`, `verify_email`, `forgot_password`, `password_changed`, `new_login`, `2fa_enabled` |
| `channel` | `varchar(20)` | NOT NULL, DEFAULT `'email'` | `email`, `in_app` (future), `push` (future) |
| `title` | `varchar(255)` | NOT NULL | Notification title |
| `body` | `text` | nullable | Preview text / plain text body |
| `recipient_email` | `varchar(255)` | nullable | Email address used for delivery |
| `template` | `varchar(100)` | nullable | Template name used (e.g. `verify-email`) |
| `payload` | `jsonb` | nullable | Full event payload from RabbitMQ |
| `provider_response` | `jsonb` | nullable | SMTP/provider response (messageId, accepted, rejected) |
| `status` | `varchar(20)` | NOT NULL, DEFAULT `'pending'` | `pending`, `sent`, `failed`, `read` |
| `read` | `boolean` | NOT NULL, DEFAULT `false` | For in-app notification bell |
| `retry_count` | `smallint` | NOT NULL, DEFAULT `0` | Number of send attempts |
| `error_message` | `text` | nullable | Last error if status = failed |
| `created_at` | `timestamptz` | NOT NULL, DEFAULT now() | |
| `sent_at` | `timestamptz` | nullable | When email was actually sent |
| `read_at` | `timestamptz` | nullable | When user read the notification |

**Indexes:**
- `(user_id, created_at DESC)` — for listing user notifications
- `(user_id, read)` WHERE `read = false` — for unread count
- `(status)` WHERE `status = 'failed'` — for retry/admin queries
- `(created_at)` — for archival job

### `notification_archive` table (cold storage)
Same schema as `notifications`. Old records (e.g. > 90 days) are moved here by a periodic job. Keeps the main table fast.

## Redis Cache Layer

### Key Patterns
```
notification:unread_count:{userId}     → integer (TTL: 300s)
notification:recent:{userId}           → sorted set of notification IDs by created_at (max 50, TTL: 3600s)
```

### Cache Strategy
- **Unread count**: Cached in Redis. Invalidated on MarkAsRead, new notification created, or DeleteNotification.
- **Recent notifications**: Sorted set with score = Unix timestamp. ZADD on new notification, ZREM on delete. Used for fast bell dropdown without hitting Postgres.
- **Cache-aside pattern**: Read from Redis first. On miss, query Postgres and populate Redis.

## RabbitMQ Integration

### Consumer Setup
- **Exchange**: `auth-events` (topic, durable) — same exchange auth-service publishes to
- **Queue**: `notification-service.events.queue` (durable)
- **Binding patterns**: `user.*` (receives all user events)
- **Prefetch**: 10 (process up to 10 messages concurrently)
- **Ack strategy**: ACK after successful email send + DB insert. NACK + requeue on transient failures. NACK + dead-letter on permanent failures (e.g. invalid payload).

### Events Consumed
| Routing Key | Template | Email Subject | Action |
|-------------|----------|---------------|--------|
| `user.registered` | `welcome.hbs` | "Welcome to Arbex!" | Send welcome email |
| `user.verify_email` | `verify-email.hbs` | "Verify your email" | Send verification link email |
| `user.forgot_password` | `forgot-password.hbs` | "Password reset code" | Send reset code email |
| `user.password_changed` | `password-changed.hbs` | "Password changed" | Send confirmation email |
| `user.logged_in` | `new-login.hbs` | "New login detected" | Send new device login alert |
| `user.2fa_enabled` | `2fa-enabled.hbs` | "2FA enabled" | Send 2FA confirmation email |

### Event Payload (from auth-service)
All events include at minimum: `{ user_id, ts }`. Additional fields vary:
- `user.registered`: `{ user_id, email, username, ts }`
- `user.verify_email`: `{ user_id, email, verification_token, ts }`
- `user.forgot_password`: `{ user_id, email, reset_code, ts }`
- `user.logged_in`: `{ user_id, device, ts }`
- `user.password_changed`: `{ user_id, ts }` (need to fetch email from DB or include in event)
- `user.2fa_enabled`: `{ user_id, email, ts }`

## gRPC Service Definition

```proto
service NotificationService {
  // User-facing
  rpc GetNotifications(GetNotificationsRequest) returns (GetNotificationsResponse);
  rpc GetUnreadCount(GetUnreadCountRequest) returns (GetUnreadCountResponse);
  rpc MarkAsRead(MarkAsReadRequest) returns (MarkAsReadResponse);
  rpc MarkAllAsRead(MarkAllAsReadRequest) returns (MarkAllAsReadResponse);
  rpc DeleteNotification(DeleteNotificationRequest) returns (DeleteNotificationResponse);

  // Admin / system
  rpc SendNotification(SendNotificationRequest) returns (SendNotificationResponse);
  rpc GetNotificationStats(GetNotificationStatsRequest) returns (GetNotificationStatsResponse);
  rpc GetDeliveryLog(GetDeliveryLogRequest) returns (GetDeliveryLogResponse);
}
```

### Key Messages
- **GetNotifications**: `{ user_id, limit, offset, type_filter, read_filter }` → paginated list
- **GetUnreadCount**: `{ user_id }` → `{ count }` (served from Redis)
- **MarkAsRead**: `{ notification_id, user_id }` → updates DB + invalidates Redis cache
- **SendNotification**: `{ user_id, type, channel, payload }` → manual trigger (admin use)
- **GetNotificationStats**: `{ time_range }` → `{ total_sent, total_failed, by_type, by_channel }`
- **GetDeliveryLog**: `{ notification_id }` → full audit record with provider response

## Email Service

### Nodemailer Configuration
```js
{
  host: config.SMTP.HOST,
  port: config.SMTP.PORT,
  secure: config.SMTP.SECURE,        // true for 465, false for 587
  auth: {
    user: config.SMTP.USER,
    pass: config.SMTP.PASSWORD,
  },
}
```

### Template Rendering
- Handlebars templates in `src/templates/`
- Base layout (`layouts/base.hbs`) wraps all emails with consistent header/footer/styles
- Templates are compiled once at startup and cached in memory
- Each template receives the full event payload + common context (service name, year, support email)

## Key Patterns

### Event Handler Pattern
Each handler in `rabbit/handlers/` follows:
```js
export default async function handleUserRegistered(payload) {
  // 1. Render email template
  // 2. Send email via emailService
  // 3. Save notification record to Postgres (full audit)
  // 4. Update Redis cache (unread count, recent list)
  // 5. Return { success, notificationId }
}
```

### gRPC Handler Pattern
Same as auth-service: `static async methodName(call, callback)` → validate → service → SuccessHandler / ErrorHandler

### Error Handling
Same custom error classes pattern as auth-service. Email send failures are caught and recorded (status = 'failed', error_message stored).

### Circuit Breakers
- `dbBreaker` — Postgres queries
- `redisBreaker` — Redis operations
- `rabbitBreaker` — RabbitMQ consumer reconnection
- `smtpBreaker` — Nodemailer send (protects against SMTP server being down)

## Archival Strategy
- **Periodic job** (cron or setTimeout loop): Move notifications older than 90 days from `notifications` to `notification_archive`
- Uses `INSERT INTO notification_archive SELECT ... FROM notifications WHERE created_at < NOW() - INTERVAL '90 days'` then `DELETE`
- Runs daily (configurable via env var)
- Logs count of archived records

## Environment Variables
```env
# Server
SERVICE_NAME=notification-service
SERVICE_PORT=50053

# PostgreSQL (same instance as auth-service)
PSQL_HOST=
PSQL_PORT=5432
PSQL_USER=
PSQL_PASSWORD=
PSQL_DATABASE=

# Redis
REDIS_URL=
REDIS_HOST=
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0

# RabbitMQ
RABBIT_URL=amqp://localhost
RABBITMQ_HOST=
RABBITMQ_PORT=5672
RABBITMQ_USER=
RABBITMQ_PASSWORD=

# SMTP
SMTP_HOST=
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=
SMTP_PASSWORD=
SMTP_FROM_NAME=Arbex
SMTP_FROM_EMAIL=noreply@arbex.com

# Notification settings
NOTIFICATION_ARCHIVE_DAYS=90
NOTIFICATION_ARCHIVE_CRON=0 3 * * *
NOTIFICATION_MAX_RETRIES=3
NOTIFICATION_RETRY_DELAY=5000

# gRPC
GRPC_MAX_MESSAGE_SIZE=4194304
```

## Dependencies
```json
{
  "@grpc/grpc-js": "^1.14.x",
  "@grpc/proto-loader": "^0.8.x",
  "amqplib": "^0.10.x",
  "dotenv": "^17.x",
  "handlebars": "^4.x",
  "ioredis": "^5.x",
  "joi": "^18.x",
  "knex": "^3.x",
  "nodemailer": "^6.x",
  "opossum": "^9.x",
  "pg": "^8.x",
  "winston": "^3.x"
}
```

## NPM Scripts
```json
{
  "dev": "nodemon src/app.js",
  "start": "node src/app.js",
  "migrate": "knex migrate:latest --knexfile src/config/knex.config.js",
  "migrate-down": "knex migrate:rollback --knexfile src/config/knex.config.js"
}
```

## Future: Queue-Based Bulk Notifications

Admin-service currently calls `SendNotification` per recipient in batches of 50 (synchronous loop). This works for ~500 users but doesn't scale beyond that due to gRPC timeouts, no retry on failure, and no progress visibility.

### Planned architecture

```text
Admin → admin-service
      → creates bulk_job record (status: pending)
      → publishes job to queue (RabbitMQ)
      → returns job_id immediately

notification-service worker:
      → consumes bulk job from queue
      → chunks recipients (100–500 per batch)
      → sends one email per recipient via SMTP
      → retries failed sends (3 attempts, exponential backoff)
      → updates job progress in DB (sent/failed/total)
      → marks job complete/failed when done
```

### What this service needs

- New RabbitMQ consumer for `admin.bulk_notification` queue (separate from `auth-events`)
- Worker logic: dequeue job → iterate recipients → call existing `sendManual()` per recipient → update job record
- Per-recipient retry with `retry_count` tracking (already supported in the notifications table schema)
- Job status updates written to a shared `bulk_jobs` table (or admin-service's DB)

### What admin-service needs

- `bulk_jobs` table: `job_id`, `status` (pending/processing/completed/failed), `total`, `sent`, `failed`, `created_by`, `created_at`, `completed_at`
- `GetBulkJobStatus` RPC for admin panel to poll progress
- RabbitMQ producer to publish bulk job messages

## Future: In-App Notifications
The service is structured to support additional channels beyond email:
- **`channel` column** in DB already supports `in_app`, `push` values
- **Event handlers** create DB records regardless of channel — the delivery method is pluggable
- **GraphQL Gateway** will eventually subscribe to a `notification.created` RabbitMQ event (or use gRPC streaming) to push real-time notifications to connected clients via WebSocket/SSE
- **GetNotifications / GetUnreadCount** gRPC endpoints already support the notification bell UI

## Related Services
- **Auth Service**: Publishes events to `auth-events` exchange that this service consumes
- **User Service**: May publish `user.profile_updated`, `user.username_changed` events in the future
- **GraphQL Gateway**: Calls this service's gRPC API for notification bell (GetNotifications, GetUnreadCount, MarkAsRead)
