# Subscription Service — Technical Specification

## 1. Purpose

Manages user subscriptions (free trial + paid tiers), their status, expiration, grace periods, and access control. Handles gRPC calls from GraphQL gateway for subscription checks and mutations, and consumes RabbitMQ events from auth-service (user registration) and payment-service (successful payments).

---

## 2. Core Functionality

### 2.1 Subscription Tiers

| sub_type | Name | Description |
|---|---|---|
| 0 | None | No active subscription |
| 1 | Lite | Basic access (default trial tier) |
| 2 | Standard | Extended features |
| 3 | PRO | Full platform access |

### 2.2 Subscription Statuses

| Status | Meaning |
|---|---|
| `active` | Subscription is valid and within dates |
| `expired` | Past `ended_at` but within 3-day grace period |
| `canceled` | User/admin canceled; remains active until `ended_at` |
| `terminated` | Grace period ended; sub_type reset to 0 |

### 2.3 Trial System

- Auto-created when auth-service publishes `user.registered` event
- Tier: Lite (sub_type = 1)
- Duration: **15 days** (clean user) or **3 days** (suspicious — fingerprint previously seen)
- Decision based on `trial_signals` in the RabbitMQ event payload (see trial-abuse-prevention doc)
- `free_trial` flag: `false` = trial unused/active, `true` = trial used (set on any paid subscription or trial expiry)
- One trial per user, ever
- Durations configurable: `TRIAL_DURATION_CLEAN=15`, `TRIAL_DURATION_SUSPICIOUS=3`
- If `trial_signals` is missing from event, defaults to 7 days

### 2.4 Grace Period

- Duration: 3 days after `ended_at`
- During grace: status = `expired`, user retains access but sees warnings
- After grace: status = `terminated`, sub_type = 0, access revoked

### 2.5 Subscription Restoration

- Within grace period: user can reactivate via payment
- After termination: must purchase a new subscription (no restoration)

---

## 3. Data Model (PostgreSQL)

### 3.1 `subscriptions` table

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | bigserial | PK | Auto-increment |
| user_id | bigint | NOT NULL, INDEX | FK reference to auth users.id |
| sub_type | smallint | NOT NULL, DEFAULT 0 | 0=None, 1=Lite, 2=Standard, 3=PRO |
| free_trial | boolean | NOT NULL, DEFAULT false | false=unused, true=used |
| status | text | NOT NULL, DEFAULT 'active' | active, expired, canceled, terminated |
| started_at | timestamptz | NOT NULL | When subscription began |
| ended_at | timestamptz | NOT NULL | When subscription ends/ended |
| grace_period_end | timestamptz | nullable | 3 days after ended_at |
| issued_by | text | NOT NULL, DEFAULT 'System' | System, Payment, Admin, Promo, User |
| created_at | timestamptz | NOT NULL, DEFAULT now() | Row creation |
| updated_at | timestamptz | NOT NULL, DEFAULT now() | Last update |

**Indexes:**
- `idx_subscriptions_user_id` — B-tree on `user_id`
- `idx_subscriptions_status` — B-tree on `status`
- `idx_subscriptions_ended_at` — B-tree on `ended_at` (for expiry worker queries)

**Constraints:**
- `CHECK (sub_type IN (0, 1, 2, 3))`
- `CHECK (status IN ('active', 'expired', 'canceled', 'terminated'))`
- `CHECK (issued_by IN ('System', 'Payment', 'Admin', 'Promo', 'User'))`

---

## 4. gRPC API

### Service Definition

```proto
service SubscriptionService {
  // Queries (from gateway)
  rpc GetSubscription(GetSubscriptionRequest) returns (SubscriptionResponse);
  rpc CheckAccess(CheckAccessRequest) returns (CheckAccessResponse);

  // Mutations (from gateway)
  rpc CreateCheckout(CreateCheckoutRequest) returns (CreateCheckoutResponse);
  rpc CancelSubscription(CancelSubscriptionRequest) returns (SubscriptionResponse);
  rpc RestoreSubscription(RestoreSubscriptionRequest) returns (SubscriptionResponse);

  // Admin
  rpc AdminSetSubscription(AdminSetSubscriptionRequest) returns (SubscriptionResponse);
  rpc GetSubscriptionStats(GetSubscriptionStatsRequest) returns (SubscriptionStatsResponse);
}
```

### RPC Details

| RPC | Auth | Description |
|---|---|---|
| GetSubscription | Yes | Get current subscription for authenticated user |
| CheckAccess | Internal (gRPC) | Other services check if user has required tier |
| CreateCheckout | Yes | Initiate payment flow with plan_type, payment_method, duration_months → calls payment-service → returns payment_url + proration info |
| CancelSubscription | Yes | User cancels; stays active until ended_at |
| RestoreSubscription | Yes | Reactivate during grace period (triggers new payment) |
| AdminSetSubscription | Admin only | Admin grants/changes subscription |
| GetSubscriptionStats | Admin only | Dashboard stats |

---

## 5. RabbitMQ Integration

### 5.1 Events Consumed

| Source | Exchange | Routing Key | Action |
|---|---|---|---|
| auth-service | `auth-events` (topic) | `user.registered` | Create trial subscription (Lite, 15d clean / 3d suspicious based on `trial_signals`) |
| payment-service | `payment-events` (topic) | `payment.succeeded` | Activate/extend subscription |
| payment-service | `payment-events` (topic) | `payment.refunded` | Cancel subscription, set status accordingly |

**Queues:**
- `subscription-service.auth.queue` → bound to `auth-events` exchange, routing key `user.registered`
- `subscription-service.payment.queue` → bound to `payment-events` exchange, routing key `payment.*`

### 5.2 Events Published

| Exchange | Routing Key | Trigger | Payload |
|---|---|---|---|
| `subscription-events` (topic) | `subscription.activated` | New sub or renewal | { user_id, sub_type, started_at, ended_at, issued_by } |
| `subscription-events` (topic) | `subscription.expired` | Worker: ended_at passed | { user_id, sub_type, grace_period_end } |
| `subscription-events` (topic) | `subscription.grace_warning` | Worker: 1 day before grace ends | { user_id, grace_period_end } |
| `subscription-events` (topic) | `subscription.terminated` | Worker: grace period ended | { user_id } |
| `subscription-events` (topic) | `subscription.canceled` | User/admin cancels | { user_id, ended_at } |
| `subscription-events` (topic) | `subscription.reactivated` | Restored during grace | { user_id, sub_type, ended_at } |

**Consumers of `subscription-events`:**
- Notification service → sends emails for all events
- Domain services (scanner, screener) → may restrict access on `terminated`

---

## 6. Plan Durations & Pricing

### 6.1 Duration Options

| Duration | Days | Discount |
|----------|------|----------|
| 1 month  | 30   | 0%       |
| 3 months | 90   | 10%      |
| 6 months | 180  | 20%      |
| 1 year   | 365  | 30%      |

### 6.2 Pricing Grid (cents USD, configurable via env vars)

| Plan     | 1 Month | 3 Months | 6 Months | 1 Year  |
|----------|---------|----------|----------|---------|
| Lite     | $9.99   | $26.97   | $47.94   | $83.88  |
| Standard | $19.99  | $53.97   | $95.94   | $167.90 |
| PRO      | $39.99  | $107.97  | $191.94  | $335.90 |

### 6.3 Proration Logic (for upgrades)

When a user has an active subscription and upgrades to a higher tier:

```
1. remaining_days = ceil((ended_at - now) / (1000 * 60 * 60 * 24))
2. total_days = ceil((ended_at - started_at) / (1000 * 60 * 60 * 24))
3. daily_rate = current_plan_price / total_days
4. remaining_value = remaining_days × daily_rate (cents)
5. new_plan_price = price for chosen plan at chosen duration
6. discount = round(remaining_value)
7. final_price = max(0, new_plan_price - discount)
8. New subscription starts NOW, runs for full new duration
```

**Example:** User has Standard 1-month ($19.99), 12 days remaining out of 30.
- Daily rate = 1999 / 30 = 66.63¢/day
- Remaining value = 12 × 66.63 = 799¢ = $7.99
- Upgrade to PRO 1-month: $39.99 - $7.99 = $32.00

The `CreateCheckoutResponse` includes a `ProrationInfo` message with all values for the frontend to display before the user confirms.

---

## 7. Payment Flow (via payment-service)

Two payment methods: **Cryptomus** (crypto) and **Fondy** (card). Same flow for both.

```
1. Client → Gateway → SubscriptionService.CreateCheckout(access_token, plan_type, payment_method, duration_months)
      payment_method: "crypto" or "card"
      duration_months: 1, 3, 6, or 12
2. SubscriptionService validates:
   - User exists and has no active subscription (or is upgrading)
   - Plan is valid (1, 2, or 3)
   - Duration is valid (1, 3, 6, or 12)
   - If upgrading: calculates proration
3. SubscriptionService → PaymentService.CreatePayment(gRPC):
   - { user_id, plan_type, payment_method, currency, amount, duration_months, order_id }
4. PaymentService creates:
   - Cryptomus invoice (if "crypto") → returns { payment_url }
   - Fondy checkout  (if "card")   → returns { payment_url }
5. SubscriptionService returns { payment_url, proration } to client
6. Client is redirected to provider's hosted payment page
   (card/crypto data never touches your backend)
7. Provider webhook → PaymentService HTTP endpoint
   - POST /webhook/cryptomus  or  POST /webhook/fondy
8. PaymentService validates provider signature → publishes "payment.succeeded" to RabbitMQ
9. SubscriptionService (consumer) receives event:
   - Creates/updates subscription row
   - Sets free_trial = true (trial consumed on any payment)
   - Sets issued_by = "Payment"
   - Publishes "subscription.activated"
10. Notification service sends confirmation email
```

---

## 8. Expiry Worker

Runs as a cron job or setInterval inside the service (every hour).

### Step 1: Expire active subscriptions
```sql
UPDATE subscriptions
SET status = 'expired',
    grace_period_end = NOW() + INTERVAL '3 days',
    updated_at = NOW()
WHERE status = 'active'
  AND ended_at < NOW();
```
→ Publish `subscription.expired` for each affected row.

### Step 2: Terminate expired subscriptions past grace
```sql
UPDATE subscriptions
SET status = 'terminated',
    sub_type = 0,
    updated_at = NOW()
WHERE status = 'expired'
  AND grace_period_end < NOW();
```
→ Publish `subscription.terminated` for each affected row.

### Step 3: Grace warning (1 day before termination)
```sql
SELECT * FROM subscriptions
WHERE status = 'expired'
  AND grace_period_end BETWEEN NOW() AND NOW() + INTERVAL '1 day';
```
→ Publish `subscription.grace_warning` for each row.

---

## 9. Access Check (used by other services)

Other services (scanner, screener, news for premium content) call:

```proto
rpc CheckAccess(CheckAccessRequest) returns (CheckAccessResponse);

message CheckAccessRequest {
  string user_id = 1;
  int32 required_level = 2;  // minimum sub_type needed
}

message CheckAccessResponse {
  bool has_access = 1;
  int32 current_level = 2;
  string status = 3;
}
```

Logic:
- Active or expired (in grace) subscription with `sub_type >= required_level` → `has_access = true`
- Terminated or insufficient tier → `has_access = false`

---

## 10. Service Architecture

```
src/
├── app.js
├── bin/
│   ├── server.js              # gRPC server startup (port 50056)
│   └── loader.js              # Proto loader
├── config/
│   ├── variables.config.js
│   ├── db.js
│   ├── knex.config.js
│   └── pricing.config.js     # Plan prices loaded from env vars
├── controllers/
│   ├── subscription.controller.js
│   └── index.js
├── middlewares/
│   └── validations/
│       ├── schemas/
│       │   ├── subscription.schemas.js
│       │   └── index.js
│       └── validation.js
├── models/
│   ├── Subscription.js
│   └── index.js
├── grpc/
│   └── payment-client.js     # gRPC client to payment-service
├── rabbit/
│   ├── consumer.js            # Dual-queue: auth-events + payment-events
│   ├── publisher.js           # Publishes: subscription.* events
│   └── handlers/
│       ├── user.registered.js
│       ├── payment.succeeded.js
│       ├── payment.refunded.js
│       └── index.js
├── redis/
│   ├── redisClient.js
│   └── subscriptionCache.js   # sub:user:{id} + sub:stats cache ops
├── services/
│   └── subscription.service.js
├── workers/
│   └── expiry.worker.js       # Hourly: active→expired→terminated + grace warnings
├── utils/
│   ├── logger.util.js
│   ├── error-handler.util.js
│   ├── success-handler.util.js
│   ├── jwt.util.js            # Verify only (public key)
│   └── circuit-breaker.util.js
├── proto/
│   └── subscription.proto
├── keys/
│   └── .gitkeep
└── migrations/
    ├── create_tables.js
    └── drop_tables.js
```

---

## 11. Redis Cache

| Key | TTL | Purpose |
|---|---|---|
| `sub:user:{userId}` | 5 min | Cached subscription status for fast CheckAccess |
| `sub:stats` | 10 min | Admin dashboard stats |

Invalidated on any subscription state change.

---

## 12. Environment Variables

```env
SERVICE_NAME=subscription-service
SERVICE_PORT=50056

# PostgreSQL (same instance)
PSQL_HOST= PSQL_PORT=5432 PSQL_USER= PSQL_PASSWORD= PSQL_DATABASE=

# Redis
REDIS_URL=redis://localhost:6379

# RabbitMQ
RABBIT_URL=amqp://admin:admin@localhost:5672

# JWT (public key only)
JWT_ACCESS_PUBLIC_KEY_PATH=./keys/access_public.pem

# Payment service (gRPC)
PAYMENT_SERVICE_HOST=localhost
PAYMENT_SERVICE_PORT=50057

# Trial system
TRIAL_DURATION_CLEAN=15
TRIAL_DURATION_SUSPICIOUS=3
TRIAL_TIER=1
GRACE_PERIOD_DAYS=3
EXPIRY_CHECK_INTERVAL_MS=3600000

# Plan pricing — monthly base prices (cents USD)
PLAN_LITE_PRICE_1M=999
PLAN_LITE_PRICE_3M=2697
PLAN_LITE_PRICE_6M=4794
PLAN_LITE_PRICE_12M=8388

PLAN_STANDARD_PRICE_1M=1999
PLAN_STANDARD_PRICE_3M=5397
PLAN_STANDARD_PRICE_6M=9594
PLAN_STANDARD_PRICE_12M=16790

PLAN_PRO_PRICE_1M=3999
PLAN_PRO_PRICE_3M=10797
PLAN_PRO_PRICE_6M=19194
PLAN_PRO_PRICE_12M=33590

PLAN_CURRENCY=USD

# Discount percentages (for reference/display)
PLAN_DISCOUNT_3M=10
PLAN_DISCOUNT_6M=20
PLAN_DISCOUNT_12M=30
```

---

## 13. Key Design Decisions

1. **One active subscription per user** — no stacking. Upgrade replaces current sub with proration discount.
2. **Trial flag is permanent** — once set to `true`, never goes back. Prevents trial abuse.
3. **Trial duration is risk-based** — 15 days for clean signups, 3 days for suspicious (fingerprint seen before). Decision owned by subscription-service based on `trial_signals` from auth-service.
4. **Grace period is generous** — 3 days gives users time to renew without losing access.
5. **CheckAccess is high-frequency** — cached in Redis (5min TTL) to avoid DB hits from every scanner/screener request.
6. **sub_type in JWT** — auth-service consumes subscription events and includes `sub_type` in JWT payload for frontend feature gating. Stale by max 15 minutes. For hard access checks, services use `CheckAccess` RPC.
7. **Proration on upgrade** — remaining value of current plan becomes a dollar discount on the new plan. All pricing configurable via env vars.
8. **4 duration options** — 1, 3, 6, 12 months with 10%/20%/30% discounts for longer commitments.
9. **Expiry worker runs inside the service** — no separate process needed at this scale. Uses `setInterval` with leader election if scaled to multiple instances.
10. **Subscription service calls payment service** — not the other way around. Payment service is a thin Cryptomus/Fondy wrapper that doesn't know about subscription logic.
11. **RabbitMQ over Kafka** — subscription events are low volume, don't need replay. RabbitMQ with durable queues + publisher confirms is sufficient. Kafka stays for scanner/parser data streams.
12. **Payment method is user's choice** — `CreateCheckout` accepts `payment_method` ("crypto" or "card") and `duration_months` (1, 3, 6, 12). Subscription service passes it through to payment service which picks the right provider.
