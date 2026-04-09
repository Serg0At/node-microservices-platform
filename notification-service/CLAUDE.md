# Notification Service — Project Guide

## Overview
Notification microservice that consumes RabbitMQ events from auth-service and sends emails. Exposes a gRPC API for notification management (CRUD, stats, delivery logs). Designed for future in-app notification support.

## Tech Stack
- **Transport**: gRPC (`@grpc/grpc-js`, `@grpc/proto-loader`) — proto at `proto/notification.proto`
- **Database**: PostgreSQL via Knex.js (tables: `notifications`, `notification_archive`)
- **Cache**: Redis (ioredis) — unread counts, recent notification IDs
- **Messaging**: RabbitMQ (amqplib) — consumes from `auth-events` topic exchange
- **Email**: Nodemailer with SMTP transport
- **Templates**: Handlebars (`.hbs` files in `src/templates/`)
- **Resilience**: Circuit breakers via `opossum` (dbBreaker, redisBreaker, rabbitBreaker, smtpBreaker)
- **Validation**: Joi schemas in middleware layer
- **Logging**: Winston

## Project Structure
```
src/
├── bin/            # gRPC server bootstrap + proto loader
├── config/         # variables.config.js, db.js, knex.config.js
├── controllers/    # gRPC handlers (notification.controller.js)
├── middlewares/     # Joi validation (schemas/ + validation.js)
├── models/         # Knex query builders (Notification.js)
├── services/       # Business logic (notification.service.js, email.service.js)
├── rabbit/         # RabbitMQ consumer + event handlers
├── redis/          # Redis client + notification cache ops
├── templates/      # Handlebars email templates
├── jobs/           # Archival job (archiver.js)
├── utils/          # error-handler, success-handler, circuit-breaker, logger
└── app.js          # Entry point
proto/notification.proto
migrations/
```

## Key Patterns

### gRPC Handler Pattern
Same as auth-service: `static async methodName(call, callback)` → validate → service → SuccessHandler / ErrorHandler

### RabbitMQ Consumer
- Exchange: `auth-events` (topic) — same exchange auth-service publishes to
- Queue: `notification-service.events.queue` (durable)
- Bind pattern: `user.*`
- Dispatches to handlers in `rabbit/handlers/` by routing key
- Retry with `x-retry-count` header, max 3 attempts

### Events Consumed
| Routing Key | Template | Email Subject |
|---|---|---|
| `user.registered` | `welcome.hbs` | Welcome to Arbex! |
| `user.verify_email` | `verify-email.hbs` | Verify your email |
| `user.forgot_password` | `forgot-password.hbs` | Password reset code |
| `user.password_changed` | `password-changed.hbs` | Password changed |
| `user.logged_in` | `new-login.hbs` | New login detected |
| `user.2fa_enabled` | `2fa-enabled.hbs` | Two-Factor Authentication Enabled |

### Redis Cache
- `notification:unread_count:{userId}` — string (TTL 300s)
- `notification:recent:{userId}` — sorted set of IDs (max 50, TTL 3600s)
- Cache-aside: read from Redis first, fallback to Postgres on miss

### Storage Strategy
- PostgreSQL `notifications` table: source of truth, full audit (payload, provider response, retry count)
- `notification_archive` table: cold storage for records older than 90 days
- Archival runs daily via setTimeout loop in `jobs/archiver.js`

### Error Handling
Same custom error classes as auth-service. Email failures recorded in DB (status=failed, error_message stored).

## NPM Scripts
- `npm run dev` — development with nodemon
- `npm run migrate` / `npm run migrate-down` — DB migrations
- `npm run reload` — kill port 50053 + restart dev

## Important Notes
- Proto loaded once at startup with `keepCase: true` — restart server after proto changes
- Templates compiled once at startup and cached in memory
- SMTP circuit breaker has longer timeout (10s) than DB (5s)
- `user.password_changed` and `user.logged_in` events need `email` in payload — ensure auth-service includes it

## Related Services
- **Auth Service**: Publishes events to `auth-events` exchange
- **User Service**: May publish `user.profile_updated` events in the future
- **GraphQL Gateway**: Calls this service's gRPC API for notification bell
