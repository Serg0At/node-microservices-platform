# Notification Service

Event-driven notification microservice for the Arbex platform. Consumes user events from RabbitMQ, sends transactional emails via SMTP (Handlebars templates), stores in-app notifications in PostgreSQL, and exposes a gRPC API for notification management.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Node.js (ES modules) |
| Transport | gRPC (`@grpc/grpc-js`, `@grpc/proto-loader`) |
| Database | PostgreSQL via Knex.js |
| Cache | Redis (ioredis) — unread counts, recent notifications |
| Messaging | RabbitMQ (amqplib) — consumes `auth-events` exchange |
| Email | Nodemailer + Handlebars templates |
| Resilience | Circuit breakers via `opossum` |
| Validation | Joi schemas |
| Logging | Winston |

## Architecture

```text
┌──────────────┐    RabbitMQ     ┌──────────────────────┐     SMTP      ┌──────────┐
│ Auth Service │ ──────────────> │ Notification Service │ ────────────> │  Mailbox │
└──────────────┘  auth-events    │                      │               └──────────┘
                  (topic exchange)│   PostgreSQL + Redis │
┌──────────────┐    gRPC :50053  │                      │
│ GraphQL GW   │ <─────────────> │                      │
└──────────────┘                 │                      │
┌──────────────┐    gRPC :50053  │                      │
│Admin Service │ ──────────────> │                      │
└──────────────┘ (send/bulk send)└──────────────────────┘
```

## gRPC API (port 50053)

Defined in `proto/notification.proto`:

### User-Facing RPCs

| RPC | Description |
|-----|-------------|
| `GetNotifications` | Paginated list with optional type/read filters |
| `GetUnreadCount` | Unread count (cached in Redis, 5 min TTL) |
| `MarkAsRead` | Mark a single notification as read |
| `MarkAllAsRead` | Mark all notifications as read, returns updated count |
| `DeleteNotification` | Delete a notification |

### Admin/System RPCs

| RPC | Description |
|-----|-------------|
| `SendNotification` | Send single email/in-app notification to a user |
| `GetNotificationStats` | Aggregate stats by type, status, channel |
| `GetDeliveryLog` | Full delivery audit trail for a notification |

## Events Consumed (RabbitMQ)

From `auth-events` topic exchange with `user.*` binding:

| Routing Key | Email Template | Payload Fields |
|-------------|---------------|----------------|
| `user.registered` | `welcome.hbs` | `user_id`, `email`, `username` |
| `user.verify_email` | `verify-email.hbs` | `user_id`, `email`, `verification_token` |
| `user.forgot_password` | `forgot-password.hbs` | `user_id`, `email`, `code` |
| `user.password_changed` | `password-changed.hbs` | `user_id`, `email` |
| `user.logged_in` | `new-login.hbs` | `user_id`, `email`, `device`, `ts` |
| `user.2fa_enabled` | `2fa-enabled.hbs` | `user_id`, `email` |

Admin-triggered notifications use the `manual.hbs` template.

## Project Structure

```text
src/
├── app.js                     # Entry point — boots all subsystems
├── bin/
│   ├── server.js              # gRPC server setup and graceful shutdown
│   └── loader.js              # Proto file loader
├── config/
│   ├── variables.config.js    # Centralized env config
│   ├── db.js                  # Database connection
│   └── knex.config.js         # Knex configuration
├── controllers/               # gRPC request handlers
├── services/                  # Business logic (notification + email services)
├── models/                    # Knex query builders (notifications table)
├── middlewares/                # Joi validation schemas
├── rabbit/                    # RabbitMQ consumer + per-event handlers
├── redis/                     # Redis client + notification cache operations
├── templates/                 # Handlebars email templates (.hbs)
│   ├── welcome.hbs
│   ├── verify-email.hbs
│   ├── forgot-password.hbs
│   ├── password-changed.hbs
│   ├── new-login.hbs
│   ├── 2fa-enabled.hbs
│   ├── manual.hbs             # Admin manual notifications
│   └── layouts/               # Shared email layouts
├── jobs/                      # Background archival job
└── utils/                     # Error/success handlers, circuit breakers, logger
proto/notification.proto       # gRPC service definition
migrations/                    # Database table creation/teardown
```

## Getting Started

### Prerequisites

- Node.js 18+
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
| `SERVICE_NAME` | `notification-service` | Service identifier |
| `SERVICE_ENV` | `production` | Environment |
| `SERVICE_PORT` | `50053` | gRPC server port |
| `SERVICE_LOG_LEVEL` | `info` | Winston log level |
| `PSQL_HOST` | — | PostgreSQL host |
| `PSQL_PORT` | `5432` | PostgreSQL port |
| `PSQL_USER` | — | PostgreSQL user |
| `PSQL_PASSWORD` | — | PostgreSQL password |
| `PSQL_DATABASE` | — | Database name |
| `PSQL_SSL` | `false` | Enable SSL for PostgreSQL |
| `REDIS_URL` | — | Redis connection URL |
| `REDIS_HOST` | — | Redis host (fallback) |
| `REDIS_PORT` | `6379` | Redis port |
| `REDIS_PASSWORD` | — | Redis password |
| `REDIS_DB` | `0` | Redis database index |
| `REDIS_UNREAD_COUNT_TTL` | `300` | Unread count cache TTL — 5 min (seconds) |
| `REDIS_RECENT_NOTIFICATIONS_TTL` | `3600` | Recent notifications cache — 1 hour (seconds) |
| `RABBITMQ_HOST` | — | RabbitMQ host |
| `RABBITMQ_PORT` | `5672` | RabbitMQ port |
| `RABBITMQ_USER` | — | RabbitMQ username |
| `RABBITMQ_PASSWORD` | — | RabbitMQ password |
| `RMQ_EXCHANGE` | `auth-events` | Exchange to consume from |
| `RMQ_EXCHANGE_TYPE` | `topic` | Exchange type |
| `RMQ_QUEUE` | `notification-service.events.queue` | Consumer queue name |
| `RMQ_BIND_PATTERN` | `user.*` | Routing key binding pattern |
| `RMQ_PREFETCH` | `10` | Consumer prefetch count |
| `RMQ_MAX_RETRIES` | `3` | Max retry attempts |
| `RMQ_RETRY_DELAY` | `5000` | Retry delay (ms) |
| `SMTP_HOST` | — | SMTP server host |
| `SMTP_PORT` | `587` | SMTP server port |
| `SMTP_SECURE` | `false` | Use TLS for SMTP |
| `SMTP_USER` | — | SMTP username |
| `SMTP_PASSWORD` | — | SMTP password |
| `SMTP_FROM_NAME` | `Arbex` | Sender display name |
| `SMTP_FROM_EMAIL` | `noreply@arbex.com` | Sender email address |
| `NOTIFICATION_ARCHIVE_DAYS` | `90` | Days before archiving |
| `NOTIFICATION_ARCHIVE_INTERVAL_MS` | `86400000` | Archival job interval — 24 hours (ms) |
| `NOTIFICATION_MAX_RETRIES` | `3` | Max send retries |
| `GRPC_MAX_MESSAGE_SIZE` | `4194304` | Max gRPC message size (bytes) |

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start with nodemon (development) |
| `npm start` | Start in production mode |
| `npm run debug` | Start with Node.js inspector |
| `npm run reload` | Kill port 50053 and restart dev |
| `npm run migrate` | Run database migrations |
| `npm run migrate-down` | Drop database tables |
| `npm run proto:check` | Verify proto files |
| `npm run lint` | ESLint check |
| `npm run lint:fix` | ESLint auto-fix |
| `npm run format` | Prettier format |
| `npm run check-format` | Prettier check |

## Author

Serg
