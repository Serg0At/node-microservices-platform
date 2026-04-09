# Notification Service — Architecture Documentation

## Table of Contents

1. [Overview](#overview)
2. [Startup Sequence](#startup-sequence)
3. [RabbitMQ — Events Consumed](#rabbitmq--events-consumed)
4. [Email Sending Pipeline](#email-sending-pipeline)
5. [PostgreSQL — Database Schema](#postgresql--database-schema)
6. [Redis — Cache Layer](#redis--cache-layer)
7. [gRPC API](#grpc-api)
8. [Circuit Breakers](#circuit-breakers)
9. [Archival Job](#archival-job)
10. [Error Handling & Retries](#error-handling--retries)

---

## Overview

The notification service is an event-driven microservice that:

1. **Consumes** events from RabbitMQ (published by auth-service)
2. **Sends** transactional emails via SMTP (Brevo / any SMTP provider)
3. **Stores** every notification in PostgreSQL with full delivery audit trail
4. **Caches** unread counts and recent notification IDs in Redis
5. **Exposes** a gRPC API for notification management (read, mark-as-read, delete, stats)

It does **not** produce any RabbitMQ messages — it is a pure consumer.

```
┌──────────────┐    RabbitMQ     ┌──────────────────────┐     SMTP      ┌──────────┐
│ Auth Service │ ──────────────> │ Notification Service │ ────────────> │  Mailbox │
└──────────────┘  auth-events    │                      │               └──────────┘
                  (topic exchange)│                      │
                                 │   ┌──────────┐       │
┌──────────────┐    gRPC         │   │ Postgres │       │
│ GraphQL GW   │ <─────────────> │   └──────────┘       │
└──────────────┘   :50053        │   ┌──────────┐       │
                                 │   │  Redis   │       │
                                 │   └──────────┘       │
                                 └──────────────────────┘
```

---

## Startup Sequence

Defined in `src/app.js`. Services initialize in this exact order:

| Step | What happens | Failure behavior |
|------|-------------|-----------------|
| 1 | **Redis** — connect ioredis client | Fatal — process exits |
| 2 | **Email** — create SMTP transporter, verify connection, compile all `.hbs` templates | Fatal — process exits |
| 3 | **RabbitMQ** — connect, assert exchange + queue, bind pattern, start consuming | Fatal — process exits |
| 4 | **gRPC** — load proto, bind handlers, start server on port 50053 | Fatal — process exits |
| 5 | **Archiver** — start background job (setTimeout loop) | Non-blocking |

---

## RabbitMQ — Events Consumed

### Connection Details

| Setting | Value |
|---------|-------|
| Exchange | `auth-events` (topic, durable) |
| Queue | `notification-service.events.queue` (durable) |
| Bind pattern | `user.*` |
| Prefetch | 10 |

The service **only consumes** — it never publishes to RabbitMQ.

### Events

#### `user.registered`

Triggered when a new user signs up.

**Expected payload:**
```json
{
  "user_id": "123",
  "email": "user@example.com",
  "username": "john_doe"
}
```

**Action:** Sends welcome email using `welcome.hbs` template.
- Subject: `Welcome to Arbex!`
- Template variables: `username` (falls back to `"there"` if missing)

---

#### `user.verify_email`

Triggered when email verification is requested.

**Expected payload:**
```json
{
  "user_id": "123",
  "email": "user@example.com",
  "verification_token": "abc123token"
}
```

**Action:** Sends verification email using `verify-email.hbs` template.
- Subject: `Verify your email`
- Template variables: `verificationLink` (constructed as `{FRONTEND_URL}/verify-email?token={verification_token}`)

---

#### `user.forgot_password`

Triggered when a user requests a password reset.

**Expected payload:**
```json
{
  "user_id": "123",
  "email": "user@example.com",
  "code": "482916"
}
```

**Action:** Sends reset code email using `forgot-password.hbs` template.
- Subject: `Password reset code`
- Template variables: `resetCode`

---

#### `user.password_changed`

Triggered after a user successfully changes their password.

**Expected payload:**
```json
{
  "user_id": "123",
  "email": "user@example.com"
}
```

**Action:** Sends confirmation email using `password-changed.hbs` template.
- Subject: `Password changed`
- **Requirement:** `email` must be present in the payload — auth-service must include it. Throws an error if missing.

---

#### `user.logged_in`

Triggered on every user login.

**Expected payload:**
```json
{
  "user_id": "123",
  "email": "user@example.com",
  "device": "Chrome on Windows",
  "ts": 1709740800
}
```

**Action:** Sends login alert email using `new-login.hbs` template.
- Subject: `New login detected`
- Template variables: `device` (defaults to `"Unknown device"`), `loginTime` (formatted from `ts` unix timestamp)
- **Requirement:** `email` must be present in the payload. Throws an error if missing.

---

#### `user.2fa_enabled`

Triggered when a user enables two-factor authentication.

**Expected payload:**
```json
{
  "user_id": "123",
  "email": "user@example.com"
}
```

**Action:** Sends 2FA confirmation email using `2fa-enabled.hbs` template.
- Subject: `Two-Factor Authentication Enabled`

---

## Email Sending Pipeline

Every event follows the same path through the system:

```
RabbitMQ message
    │
    ▼
Handler (src/rabbit/handlers/)
    │  Extracts fields from payload, builds template context
    │
    ▼
NotificationService.createAndSend()
    │
    ├─ 1. INSERT into `notifications` table (status = 'pending')
    │
    ├─ 2. EmailService.sendEmail()
    │      ├─ Compile Handlebars template with context
    │      ├─ Send via SMTP through smtpBreaker circuit breaker
    │      └─ Return { messageId, accepted, rejected }
    │
    ├─ 3a. ON SUCCESS:
    │      ├─ UPDATE notification status → 'sent', store provider_response + sent_at
    │      ├─ Redis: increment unread count
    │      └─ Redis: add notification ID to recent sorted set
    │
    └─ 3b. ON FAILURE:
           ├─ UPDATE notification status → 'failed', store error_message, increment retry_count
           └─ Throw error (triggers RabbitMQ retry logic)
```

### Template System

- Templates are in `src/templates/` as `.hbs` (Handlebars) files
- A shared layout partial `layouts/base.hbs` wraps all templates
- All templates are compiled **once at startup** and cached in memory
- Every template receives `serviceName` ("Arbex") and `year` (current year) automatically

### SMTP Configuration

| Setting | Default |
|---------|---------|
| Host | env `SMTP_HOST` |
| Port | 587 |
| Secure (TLS) | false (uses STARTTLS) |
| From | `"Arbex" <noreply@arbex.com>` |

---

## PostgreSQL — Database Schema

### `notifications` table (hot storage)

This is the primary table. Every notification (email sent, failed, or pending) gets a row here.

| Column | Type | Description |
|--------|------|-------------|
| `id` | `bigint` (PK, auto-increment) | Unique notification identifier |
| `user_id` | `bigint` (indexed) | The user this notification belongs to. References the user in auth-service, but no FK constraint (cross-service boundary). |
| `type` | `varchar(50)` | Notification type. Values: `welcome`, `verify_email`, `forgot_password`, `password_changed`, `new_login`, `2fa_enabled`. Used for filtering and stats. |
| `channel` | `varchar(20)`, default `'email'` | Delivery channel. Currently always `'email'`. Designed for future `in_app` support. |
| `title` | `varchar(255)` | The email subject line (e.g., "Welcome to Arbex!"). Stored for display in notification bell UI. |
| `body` | `text`, nullable | Plain text body. Used for manual/admin-triggered notifications. Event-driven notifications leave this null (they use templates instead). |
| `recipient_email` | `varchar(255)`, nullable | The email address the notification was sent to. Stored for audit — the user's email may change later, but this records where it was actually delivered. |
| `template` | `varchar(100)`, nullable | Name of the Handlebars template used (e.g., `welcome`, `forgot-password`). Null for non-templated sends. |
| `payload` | `jsonb`, nullable | The full original RabbitMQ event payload, stored as JSON. Complete audit trail of what triggered this notification. |
| `provider_response` | `jsonb`, nullable | SMTP server response after successful send. Contains `messageId`, `accepted`, `rejected` arrays. Null if not yet sent or if send failed. |
| `status` | `varchar(20)`, default `'pending'` | Lifecycle status. Values: `pending` (created, not yet sent), `sent` (email delivered to SMTP server), `failed` (SMTP send failed), `read` (user opened/marked as read). |
| `read` | `boolean`, default `false` | Whether the user has read this notification. Separate from `status` for fast filtering. Set to `true` by MarkAsRead/MarkAllAsRead RPCs. |
| `retry_count` | `smallint`, default `0` | Number of times email send was attempted and failed. Incremented on each failure at the application level. |
| `error_message` | `text`, nullable | The error message from the most recent failed send attempt (e.g., SMTP timeout, invalid recipient). Null on success. |
| `created_at` | `timestamptz`, default `now()` | When the notification record was created (before email send attempt). |
| `sent_at` | `timestamptz`, nullable | When the email was successfully handed off to the SMTP server. Null if pending or failed. |
| `read_at` | `timestamptz`, nullable | When the user marked this notification as read. Null if unread. |

**Indexes:**
- `idx_notifications_user_created` — composite on `(user_id, created_at)` for paginated user notification queries
- `idx_notifications_status` — on `status` for stats queries and archival

### `notification_archive` table (cold storage)

Identical schema to `notifications`. Receives rows older than 90 days via the archival job. This keeps the hot table small for fast queries.

**Indexes:**
- `idx_notification_archive_user_created` — composite on `(user_id, created_at)` for historical lookups

---

## Redis — Cache Layer

Redis acts as a read-through cache to reduce PostgreSQL load for high-frequency operations (notification bell in the UI).

### Key: `notification:unread_count:{userId}`

| Property | Value |
|----------|-------|
| Type | String (integer) |
| TTL | 300 seconds (5 minutes) |
| Purpose | Caches the number of unread notifications for a user. Powers the notification bell badge count in the UI. |

**Behavior:**
- **Read (cache-aside):** `GetUnreadCount` checks Redis first. On cache miss, queries PostgreSQL (`SELECT COUNT(*) WHERE read = false`), then writes result back to Redis.
- **Increment:** When a new notification is created and email sent successfully, the count is incremented (only if the key already exists — avoids creating stale keys).
- **Decrement:** When a notification is marked as read or deleted (if unread), the count is decremented.
- **Reset:** When `MarkAllAsRead` is called, the count is set to `0`.
- **Eviction:** After TTL expires, next read will re-populate from PostgreSQL.

### Key: `notification:recent:{userId}`

| Property | Value |
|----------|-------|
| Type | Sorted Set |
| Score | Unix timestamp (milliseconds) |
| Members | Notification IDs (as strings) |
| Max size | 50 entries (trimmed after each add) |
| TTL | 3600 seconds (1 hour) |
| Purpose | Tracks the most recent notification IDs per user for fast "recent notifications" lookups without hitting PostgreSQL. |

**Behavior:**
- **Add:** On successful notification send, the notification ID is added with current timestamp as score.
- **Trim:** After each add, entries beyond the 50 most recent are removed (`ZREMRANGEBYRANK`).
- **Remove:** When a notification is deleted, its ID is removed from the set.
- **Read:** `getRecentIds` returns up to 50 IDs in reverse chronological order.

### Cache Failure Policy

All Redis operations are wrapped in try/catch and are **fire-and-forget**. If Redis is down or the circuit breaker is open, the service continues operating using PostgreSQL as the source of truth. Cache failures are logged as warnings, never as errors that block the operation.

---

## gRPC API

Server listens on port **50053**. Proto definition: `proto/notification.proto`.

### User-Facing RPCs

#### `GetNotifications`

Returns paginated notifications for a user.

| Field | Type | Description |
|-------|------|-------------|
| `user_id` | string | Required. User ID. |
| `limit` | int32 | Page size (default 20, max 100). |
| `offset` | int32 | Pagination offset. |
| `type_filter` | string | Optional. Filter by notification type (e.g., `welcome`). |
| `read_filter` | string | Optional. `"read"`, `"unread"`, or empty for all. |

**Response:** `{ success, notifications[], total_count }`

---

#### `GetUnreadCount`

Returns the unread notification count for a user. Reads from Redis first, falls back to PostgreSQL.

| Field | Type | Description |
|-------|------|-------------|
| `user_id` | string | Required. User ID. |

**Response:** `{ success, count }`

---

#### `MarkAsRead`

Marks a single notification as read. Updates `read = true`, `status = 'read'`, sets `read_at`. Decrements Redis unread count.

| Field | Type | Description |
|-------|------|-------------|
| `notification_id` | string | Required. Notification ID. |
| `user_id` | string | Required. User ID (ownership check). |

**Response:** `{ success, message }`

Returns `NOT_FOUND` if the notification doesn't exist or is already read.

---

#### `MarkAllAsRead`

Marks all unread notifications as read for a user. Resets Redis unread count to 0.

| Field | Type | Description |
|-------|------|-------------|
| `user_id` | string | Required. User ID. |

**Response:** `{ success, message, updated_count }`

---

#### `DeleteNotification`

Deletes a notification. If it was unread, decrements Redis unread count. Removes from recent set.

| Field | Type | Description |
|-------|------|-------------|
| `notification_id` | string | Required. Notification ID. |
| `user_id` | string | Required. User ID (ownership check). |

**Response:** `{ success, message }`

---

### Admin / System RPCs

#### `SendNotification`

Manually trigger a notification (admin/system use). Creates a DB record and sends an email.

| Field | Type | Description |
|-------|------|-------------|
| `user_id` | string | Required. Target user ID. |
| `email` | string | Required. Recipient email address. |
| `type` | string | Required. Notification type (must match a template name). |
| `channel` | string | Required. Delivery channel (`email`). |
| `subject` | string | Optional. Email subject (defaults to `"Notification: {type}"`). |
| `body` | string | Optional. Plain text body passed as template context. |

**Response:** `{ success, message, notification_id }`

---

#### `GetNotificationStats`

Returns aggregate notification statistics, optionally filtered by time range.

| Field | Type | Description |
|-------|------|-------------|
| `from_time` | string | Optional. ISO timestamp lower bound. |
| `to_time` | string | Optional. ISO timestamp upper bound. |

**Response:** `{ success, total_sent, total_failed, by_type[], by_status[], by_channel[] }`

---

#### `GetDeliveryLog`

Returns the full delivery audit trail for a single notification — includes payload, provider response, retry count, error message, and all timestamps.

| Field | Type | Description |
|-------|------|-------------|
| `notification_id` | string | Required. Notification ID. |

**Response:** `{ success, entry }` where `entry` contains all columns from the `notifications` table.

---

## Circuit Breakers

All external dependencies are wrapped in circuit breakers (opossum library) to prevent cascading failures.

| Breaker | Timeout | Error Threshold | Reset Timeout | Purpose |
|---------|---------|----------------|---------------|---------|
| `database` | 5s | 50% | 10s | All PostgreSQL queries |
| `redis` | 2s | 50% | 10s | All Redis operations |
| `rabbitmq` | 5s | 50% | 20s | RabbitMQ operations |
| `smtp` | 10s | 50% | 30s | Email sending (longer timeout because SMTP is slow) |

**States:**
- **Closed** (normal) — requests pass through
- **Open** (tripped) — requests fail immediately without hitting the dependency
- **Half-open** (testing) — one request is let through to test if the dependency recovered

The `volumeThreshold` is 5 — the breaker won't trip until at least 5 requests have been made in the current window.

---

## Archival Job

Runs as a background `setTimeout` loop (not a cron job). Defined in `src/jobs/archiver.js`.

| Setting | Value |
|---------|-------|
| Interval | 86,400,000 ms (24 hours) |
| Archive threshold | 90 days |
| First run | 10 seconds after startup |

**What it does:**

Executes a single atomic SQL statement:
```sql
WITH moved AS (
  DELETE FROM notifications
  WHERE created_at < {cutoff_date}
  RETURNING *
)
INSERT INTO notification_archive
SELECT * FROM moved
```

This atomically moves old rows from `notifications` to `notification_archive`, keeping the hot table small. The archive table has the same schema, so no data is lost.

---

## Error Handling & Retries

### RabbitMQ Message Retry

When an event handler throws an error:

1. The `x-retry-count` header is read from the message (default 0)
2. If retries < 3 (max), the message is re-published to the same queue with `x-retry-count` incremented, after a 5-second delay
3. The original message is acked (to remove it from the queue)
4. If retries >= 3, the message is nacked with `requeue: false` (sent to dead letter queue if configured, otherwise discarded)

### RabbitMQ Connection Recovery

On connection close:
1. A reconnect loop starts with exponential backoff
2. Base interval: 3 seconds, multiplied by attempt number
3. Max delay capped at 30 seconds
4. Reconnect attempts continue indefinitely

### Email Failures

When SMTP send fails:
1. The notification record is updated: `status = 'failed'`, `error_message` is stored, `retry_count` is incremented
2. The error is thrown back to the RabbitMQ consumer, which triggers the message retry logic (up to 3 attempts)
3. After all retries are exhausted, the notification remains in the DB with `status = 'failed'` for manual investigation

### How to Verify an Email Was Actually Sent

The log `[SendNotification] Notification sent` only confirms the gRPC call succeeded and the DB record was created. To verify actual SMTP delivery:

1. Check the `notifications` table:
   - `status = 'sent'` + `provider_response` contains `messageId` — email was accepted by SMTP server
   - `status = 'failed'` + `error_message` — email failed
   - `status = 'pending'` — email send is still in progress or was never attempted
2. Use the `GetDeliveryLog` gRPC call for a specific notification ID
3. Check application logs for `Email sent` (debug level) or `Failed to send email` (error level)
