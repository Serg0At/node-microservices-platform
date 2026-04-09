# Payment Service — Technical Specification

## 1. Purpose

Thin wrapper around two payment providers: **Cryptomus** (crypto payments) and **Fondy** (card payments). Handles checkout creation, webhook processing, and transaction logging. Does NOT contain subscription or business logic — it only processes payments and publishes results.

---

## 2. Payment Providers

| Provider | Method | Flow |
|---|---|---|
| **Cryptomus** | Crypto (BTC, ETH, USDT, etc.) | Creates invoice → user pays on Cryptomus page → webhook confirms |
| **Fondy** | Card (Visa, Mastercard) | Creates checkout → user pays on Fondy page → webhook confirms |

Both follow the same pattern:
1. Payment service creates a session/invoice via provider API
2. Returns a `payment_url` — user is redirected to the provider's hosted page
3. Provider sends webhook on completion
4. Payment service validates, logs, publishes event

---

## 3. Core Functionality

### 3.1 Create Payment
- Called by subscription-service via gRPC
- Accepts `payment_method`: `"crypto"` or `"card"`
- Creates invoice (Cryptomus) or checkout (Fondy) depending on method
- Returns `payment_url` for frontend redirect

### 3.2 Webhook Processing
- Two HTTP endpoints, one per provider
- Validates signatures using provider-specific secrets
- Updates transaction status
- Publishes result to RabbitMQ

### 3.3 Transaction Logging
- Every payment attempt stored in `transactions` table
- Provider-agnostic schema with `provider` column

---

## 4. Data Model (PostgreSQL)

### 4.1 `transactions` table

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | bigserial | PK | Auto-increment |
| user_id | bigint | NOT NULL, INDEX | Who paid |
| provider | text | NOT NULL | `cryptomus` or `fondy` |
| provider_order_id | text | UNIQUE, NOT NULL | Cryptomus invoice ID or Fondy order ID |
| provider_payment_id | text | nullable | Provider's payment/transaction ID |
| amount | integer | NOT NULL | Amount in cents (USD) |
| currency | varchar(10) | NOT NULL, DEFAULT 'USD' | Payment currency |
| crypto_currency | varchar(10) | nullable | BTC, ETH, USDT, etc. (crypto only) |
| crypto_amount | text | nullable | Amount in crypto (string for precision) |
| status | text | NOT NULL, DEFAULT 'pending' | pending, succeeded, failed, refunded, expired |
| plan_type | smallint | NOT NULL | 1=Lite, 2=Standard, 3=PRO |
| duration_months | smallint | NOT NULL, DEFAULT 1 | 1, 3, 6, or 12 |
| metadata | jsonb | nullable | Raw provider response data |
| created_at | timestamptz | NOT NULL, DEFAULT now() | When created |
| updated_at | timestamptz | NOT NULL, DEFAULT now() | Last update |

**Indexes:**
- `idx_transactions_user_id` — B-tree on `user_id`
- `idx_transactions_provider_order_id` — unique B-tree on `provider_order_id`
- `idx_transactions_status` — B-tree on `status`

**Constraints:**
- `CHECK (provider IN ('cryptomus', 'fondy'))`
- `CHECK (status IN ('pending', 'succeeded', 'failed', 'refunded', 'expired'))`
- `CHECK (plan_type IN (1, 2, 3))`

---

## 5. gRPC API (called by subscription-service only)

```proto
service PaymentService {
  rpc CreatePayment(CreatePaymentRequest) returns (CreatePaymentResponse);
  rpc GetTransaction(GetTransactionRequest) returns (TransactionResponse);
  rpc ListTransactions(ListTransactionsRequest) returns (ListTransactionsResponse);
}

message CreatePaymentRequest {
  string user_id = 1;
  int32 plan_type = 2;           // 1=Lite, 2=Standard, 3=PRO
  string payment_method = 3;     // "crypto" or "card"
  string currency = 4;           // "USD" default
}

message CreatePaymentResponse {
  bool success = 1;
  string payment_url = 2;        // redirect user here
  string order_id = 3;           // internal reference
  int32 expires_in = 4;          // seconds until payment link expires
}

message GetTransactionRequest {
  string access_token = 1;
  string id = 2;
}

message TransactionResponse {
  bool success = 1;
  Transaction transaction = 2;
}

message Transaction {
  string id = 1;
  string user_id = 2;
  string provider = 3;
  string provider_order_id = 4;
  int32 amount = 5;
  string currency = 6;
  string status = 7;
  int32 plan_type = 8;
  string created_at = 9;
}

message ListTransactionsRequest {
  string access_token = 1;
  string user_id = 2;            // optional filter
  string status = 3;             // optional filter
  int32 page = 4;
  int32 limit = 5;
}

message ListTransactionsResponse {
  bool success = 1;
  repeated Transaction transactions = 2;
  int32 total = 3;
}
```

| RPC | Caller | Description |
|---|---|---|
| CreatePayment | subscription-service | Create Cryptomus invoice or Fondy checkout |
| GetTransaction | admin-service | Get single transaction by ID |
| ListTransactions | admin-service | List transactions with filters |

**Not called by GraphQL gateway directly** — subscription-service mediates.

---

## 6. HTTP Webhook Endpoints

Payment service runs a **small Express/Fastify HTTP server** alongside gRPC, solely for provider webhooks.

### 6.1 Cryptomus Webhook

```
POST /webhook/cryptomus
```

**Validation:** Cryptomus signs webhooks with HMAC-SHA256 using your API key.

```js
const hash = crypto
  .createHash('md5')
  .update(Buffer.from(JSON.stringify(sortedBody)).toString('base64') + CRYPTOMUS_API_KEY)
  .digest('hex');

if (hash !== req.headers['sign']) throw new Error('Invalid signature');
```

**Statuses mapped:**
| Cryptomus Status | Our Status | Action |
|---|---|---|
| `paid` | `succeeded` | Publish `payment.succeeded` |
| `paid_over` | `succeeded` | Publish `payment.succeeded` (user overpaid) |
| `wrong_amount` | `failed` | Publish `payment.failed` |
| `cancel` | `failed` | Publish `payment.failed` |
| `fail` | `failed` | Publish `payment.failed` |

### 6.2 Fondy Webhook

```
POST /webhook/fondy
```

**Validation:** Fondy signs with SHA-1 of sorted params + merchant password.

```js
const sorted = Object.keys(data)
  .filter(k => k !== 'signature' && data[k] !== '')
  .sort()
  .map(k => data[k])
  .join('|');

const expected = crypto
  .createHash('sha1')
  .update(FONDY_MERCHANT_PASSWORD + '|' + sorted)
  .digest('hex');

if (expected !== data.signature) throw new Error('Invalid signature');
```

**Statuses mapped:**
| Fondy Status | Our Status | Action |
|---|---|---|
| `approved` | `succeeded` | Publish `payment.succeeded` |
| `declined` | `failed` | Publish `payment.failed` |
| `expired` | `expired` | Publish `payment.failed` |
| `reversed` | `refunded` | Publish `payment.refunded` |

---

## 7. Provider Integration Details

### 7.1 Cryptomus — Create Invoice

```js
const response = await fetch('https://api.cryptomus.com/v1/payment', {
  method: 'POST',
  headers: {
    'merchant': CRYPTOMUS_MERCHANT_ID,
    'sign': generateSign(body),
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    amount: amountUsd.toString(),
    currency: 'USD',
    order_id: orderId,
    url_callback: `${WEBHOOK_BASE_URL}/webhook/cryptomus`,
    url_return: `${FRONTEND_URL}/subscription/success`,
    lifetime: 3600,                  // 1 hour to pay
  }),
});

// Returns: { result: { url, uuid, order_id, ... } }
// Redirect user to result.url
```

### 7.2 Fondy — Create Checkout

```js
const response = await fetch('https://pay.fondy.eu/api/checkout/url/', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    request: {
      order_id: orderId,
      merchant_id: FONDY_MERCHANT_ID,
      order_desc: `Arbex ${planName} — 1 Month`,
      amount: amountCents.toString(), // in cents
      currency: 'USD',
      server_callback_url: `${WEBHOOK_BASE_URL}/webhook/fondy`,
      response_url: `${FRONTEND_URL}/subscription/success`,
      lang: 'en',
      lifetime: 3600,
      signature: generateFondySignature(params),
    },
  }),
});

// Returns: { response: { checkout_url, ... } }
// Redirect user to checkout_url
```

---

## 8. RabbitMQ Integration

### Events Published

| Exchange | Routing Key | Trigger | Payload |
|---|---|---|---|
| `payment-events` (topic) | `payment.succeeded` | Provider confirms payment | { user_id, plan_type, amount, currency, provider, transaction_id, order_id } |
| `payment-events` (topic) | `payment.failed` | Payment failed/canceled | { user_id, plan_type, provider, error_reason } |
| `payment-events` (topic) | `payment.refunded` | Charge reversed | { user_id, plan_type, amount, provider, transaction_id } |

### Events Consumed
None. Payment service only publishes.

---

## 9. Service Architecture

```
src/
├── bin/
│   ├── server.js             # gRPC server startup
│   ├── http.js               # Express HTTP server for webhooks
│   └── loader.js             # Proto loader
├── config/
│   ├── variables.config.js
│   ├── db.js
│   └── knex.config.js
├── controllers/
│   ├── payment.controller.js       # gRPC handlers
│   └── webhook.controller.js       # HTTP webhook handlers (both providers)
├── middlewares/
│   └── validations/
│       ├── schemas/
│       │   └── payment.schemas.js
│       └── validation.js
├── models/
│   └── Transaction.js
├── providers/
│   ├── cryptomus.provider.js       # Cryptomus API client + signature logic
│   └── fondy.provider.js           # Fondy API client + signature logic
├── rabbit/
│   └── publisher.js                # Publishes payment.* events
├── services/
│   └── payment.service.js          # Orchestrates: pick provider → create → save
├── utils/
│   ├── logger.util.js
│   ├── error-handler.util.js
│   ├── success-handler.util.js
│   └── circuit-breaker.util.js
└── app.js                          # Boots gRPC + HTTP + RabbitMQ
```

Key difference from single-provider setup: **`providers/` directory** abstracts each payment provider behind a common interface:

```js
// Both providers implement:
{
  createPayment({ orderId, amount, currency, planName, userId }) → { paymentUrl, expiresIn }
  validateWebhook(req) → { orderId, status, metadata }
}
```

---

## 10. Environment Variables

```env
SERVICE_NAME=payment-service
SERVICE_PORT=50057
WEBHOOK_HTTP_PORT=3001

# PostgreSQL (same instance)
PSQL_HOST= PSQL_PORT=5432 PSQL_USER= PSQL_PASSWORD= PSQL_DATABASE=

# RabbitMQ
RABBIT_URL=amqp://admin:admin@localhost:5672

# Cryptomus
CRYPTOMUS_MERCHANT_ID=
CRYPTOMUS_API_KEY=
CRYPTOMUS_PAYMENT_LIFETIME=3600

# Fondy
FONDY_MERCHANT_ID=
FONDY_MERCHANT_PASSWORD=
FONDY_PAYMENT_LIFETIME=3600

# Webhook base URL (public, for provider callbacks)
WEBHOOK_BASE_URL=https://arbex.io

# Frontend URLs (redirect after payment)
FRONTEND_SUCCESS_URL=https://arbex.io/subscription/success
FRONTEND_CANCEL_URL=https://arbex.io/subscription/cancel

# Plan pricing (cents USD)
PLAN_LITE_PRICE=999
PLAN_STANDARD_PRICE=1999
PLAN_PRO_PRICE=3999
PLAN_CURRENCY=USD
```

---

## 11. Key Design Decisions

1. **Two providers, one interface** — `providers/` directory abstracts Cryptomus and Fondy behind a common `createPayment` / `validateWebhook` interface. Adding a third provider = one new file.

2. **gRPC + HTTP dual server** — gRPC for internal communication (subscription-service), HTTP solely for provider webhooks.

3. **Provider-agnostic transaction table** — `provider` column distinguishes source, `provider_order_id` is unique per provider. Same table, same queries, same RabbitMQ events regardless of payment method.

4. **No JWT verification** — this service is internal only. gRPC calls come from subscription-service (trusted). Webhook calls are validated via provider signatures. No user-facing endpoints.

5. **Payment service is not called by gateway** — subscription-service is the only gRPC client. This prevents users from creating arbitrary payment sessions.

6. **payment_url redirect, not embedded** — both Cryptomus and Fondy host their own payment pages. No PCI compliance burden on your side. User is redirected, pays, and comes back.

7. **Webhook HTTP port is separate** — runs on port 3001. Caddy proxies webhook paths to this port.

---

## 12. Network / Reverse Proxy

```
# Caddy config
arbex.io {
    handle /api/* {
        reverse_proxy gateway:4000
    }
    handle /webhook/cryptomus {
        reverse_proxy payment-service:3001
    }
    handle /webhook/fondy {
        reverse_proxy payment-service:3001
    }
}
```

Provider dashboard webhook URLs:
- Cryptomus: `https://arbex.io/webhook/cryptomus`
- Fondy: `https://arbex.io/webhook/fondy`
