# RabbitMQ Consumer — `src/rabbit/consumer.js`

## Purpose

Listens for `user.registered` events published by **auth-service** and automatically creates a `profiles` row in Postgres for each newly registered user. This is the event-driven bridge that keeps user-service in sync with auth-service without any direct gRPC calls between them.

---

## How It Fits in the System

```
┌──────────────┐    user.registered     ┌─────────────────────────────┐
│ auth-service │ ─────────────────────► │   auth-events (topic)       │
│  (publisher) │                        │       exchange              │
└──────────────┘                        └───────────┬─────────────────┘
                                                    │
                                        routing key: user.registered
                                                    │
                                    ┌───────────────▼──────────────────┐
                                    │ user-service.auth-events.queue   │
                                    └───────────────┬──────────────────┘
                                                    │
                                    ┌───────────────▼──────────────────┐
                                    │     consumer.js (this file)      │
                                    │                                  │
                                    │  1. Parse payload                │
                                    │  2. INSERT into profiles table   │
                                    │  3. ACK the message              │
                                    └──────────────────────────────────┘
```

---

## Event Payload (from auth-service)

```json
{
  "user_id": 42,
  "email": "john@example.com",
  "username": "johndoe",
  "verification_token": "abc123...",
  "ts": 1709337600
}
```

The consumer only uses `user_id` and `username` — the rest is ignored (used by notification-service).

---

## Step-by-Step Walkthrough

### 1. Initialization (`initRabbitConsumer`)

```
Line 15-80
```

Called once at startup from `app.js`. Does the following in order:

| Step | What happens | Why |
|------|-------------|-----|
| **Connect** | Opens AMQP connection to RabbitMQ (`RABBIT_URL` env var) | Establishes the TCP link |
| **Create channel** | Creates a single channel on the connection | Channels multiplex over one TCP connection |
| **Assert exchange** | Ensures `EXCHANGE.NAME` (topic) exists | Idempotent — won't fail if auth-service already created it |
| **Assert queue** | Ensures `QUEUES.REGISTRATION` exists with `durable: true` | Messages survive RabbitMQ restarts |
| **Bind queue** | Binds queue to exchange with routing key `ROUTING_KEYS.USER_REGISTERED` | Only receives registration events, not all `user.*` events |
| **Start consuming** | Registers the message handler callback | Begins processing messages |

### 2. Message Processing (the `consume` callback)

```
Lines 26-65
```

For each incoming message:

1. **Parse** — `JSON.parse(msg.content.toString())` extracts the event payload
2. **Create profile** — Inserts a row into `profiles` table inside a DB transaction, wrapped in a circuit breaker (`dbBreaker`)
   - Only sets `user_id` and `username` (other profile fields like `display_name`, `avatar_url`, `bio` default to `null`)
3. **ACK** — Tells RabbitMQ the message was processed successfully so it can be removed from the queue

### 3. Error Handling & Retry

```
Lines 47-64
```

If profile creation fails (e.g. DB down, unique constraint violation):

```
Attempt 1 → wait 5s → re-publish with x-retry-count: 1
Attempt 2 → wait 5s → re-publish with x-retry-count: 2
Attempt 3 → wait 5s → re-publish with x-retry-count: 3
Attempt 4 → MAX_RETRIES exceeded → NACK (message discarded/dead-lettered)
```

The retry mechanism works by:
- Re-publishing the message to the **same queue** (default exchange, routing key = queue name) with an incremented `x-retry-count` header
- ACK-ing the original message (so it's not redelivered by RabbitMQ itself)
- Using `setTimeout` with `RETRY_DELAY` (default 5000ms) to space out retries

After `MAX_RETRIES` (default 3), the message is `nack`-ed with `requeue: false`, which either discards it or routes it to a dead-letter exchange if one is configured.

### 4. Connection Recovery (`scheduleReconnect`)

```
Lines 82-102
```

If the RabbitMQ connection drops:

1. `connection.on('close')` fires, resets `channel` and `connection` to `null`
2. `scheduleReconnect()` starts a retry loop with **linear backoff** (capped at 30s):
   - Retry 1: wait `RECONNECT_INTERVAL` (3s)
   - Retry 2: wait `RECONNECT_INTERVAL * 2` (6s)
   - Retry 3: wait `RECONNECT_INTERVAL * 3` (9s)
   - ...up to max 30s between attempts
3. A `reconnecting` flag prevents multiple reconnect loops from running simultaneously

---

## Configuration Reference

All values come from `config.RABBITMQ` in `variables.config.js`, destructured as `{ EXCHANGE, QUEUES, ROUTING_KEYS, RETRY }`:

| Config Key | Default | Used For |
|-----------|---------|----------|
| `EXCHANGE.NAME` | `auth-events` | The topic exchange auth-service publishes to |
| `EXCHANGE.TYPE` | `topic` | Exchange type |
| `QUEUES.REGISTRATION` | `user-service.auth-events.queue` | This consumer's dedicated queue |
| `ROUTING_KEYS.USER_REGISTERED` | `user.registered` | Binding key — only receive registration events |
| `RETRY.MAX_RETRIES` | `3` | Max processing attempts before giving up |
| `RETRY.RETRY_DELAY` | `5000` (ms) | Delay between retry attempts |
| `RETRY.RECONNECT_INTERVAL` | `3000` (ms) | Base delay for connection reconnect |

---

## Key Design Decisions

1. **Separate queue from notification-service** — Both services bind to the same exchange but have their own queues, so both receive every `user.registered` event independently (fan-out via topic exchange)

2. **Circuit breaker on DB writes** — If Postgres is overloaded, the circuit breaker opens and fails fast instead of piling up slow queries

3. **Manual retry with re-publish** — Instead of using RabbitMQ's built-in redelivery (`nack` with `requeue: true`), the consumer re-publishes with a delay. This prevents tight retry loops that could overwhelm the system

4. **Durable queue** — `durable: true` means messages are persisted to disk. If RabbitMQ restarts, queued messages are not lost

5. **Transaction-wrapped insert** — The profile creation uses a DB transaction to ensure atomicity, even though it's a single insert (future-proofs for adding related inserts)
