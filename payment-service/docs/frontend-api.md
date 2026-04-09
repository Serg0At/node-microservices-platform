# Payment Service — Frontend Developer Reference

**Service:** Payment Service  
**Responsibility:** Handles payment initiation and transaction history for crypto (Cryptomus) and card (Fondy) payment providers, processing incoming webhooks and publishing `payment.succeeded`, `payment.failed`, and `payment.refunded` events that the subscription-service consumes to activate plans. The gateway calls this service on behalf of the user.

> All RPCs are exposed through the GraphQL gateway. Webhook endpoints (`/webhook/cryptomus`, `/webhook/fondy`) are called directly by payment providers — not from the frontend.

---

## CreatePayment
Creates a payment order and returns a provider URL to redirect the user to for payment completion.

**Request**
| Field | Type | Required | Description |
|---|---|---|---|
| `user_id` | string | yes | |
| `plan_type` | int | yes | `1`=Lite, `2`=Standard, `3`=PRO |
| `payment_method` | string | yes | `"crypto"` or `"card"` |
| `currency` | string | yes | e.g. `"USD"`, `"USDT"` |
| `amount` | int | yes | Amount in cents |
| `order_id` | string | yes | Unique order reference from subscription-service |
| `duration_months` | int | yes | `1`, `3`, `6`, or `12` |

**Response**
| Field | Type | Description |
|---|---|---|
| `success` | bool | |
| `payment_url` | string | Redirect user here to complete payment |
| `order_id` | string | Confirmed order ID |
| `expires_in` | int | Seconds until payment session expires |

**Example**
```json
// Request
{ "user_id": "42", "plan_type": 3, "payment_method": "crypto", "currency": "USDT", "amount": 9900, "order_id": "ord_abc123", "duration_months": 12 }

// Response
{ "success": true, "payment_url": "https://pay.cryptomus.com/pay/...", "order_id": "ord_abc123", "expires_in": 1800 }
```

---

## GetTransaction
Returns details of a single transaction by ID.

**Request**
| Field | Type | Required |
|---|---|---|
| `access_token` | string | yes |
| `id` | string | yes — transaction ID |

**Response**
| Field | Type | Description |
|---|---|---|
| `success` | bool | |
| `transaction.id` | string | |
| `transaction.user_id` | string | |
| `transaction.provider` | string | `"cryptomus"` or `"fondy"` |
| `transaction.provider_order_id` | string | Provider's own order reference |
| `transaction.amount` | int | Amount in cents |
| `transaction.currency` | string | |
| `transaction.status` | string | `pending`, `paid`, `failed`, `refunded` |
| `transaction.plan_type` | int | |
| `transaction.duration_months` | int | |
| `transaction.created_at` | string | ISO 8601 |
| `transaction.updated_at` | string | ISO 8601 |

**Example**
```json
// Request
{ "access_token": "eyJ...", "id": "txn_xyz" }

// Response
{
  "success": true,
  "transaction": { "id": "txn_xyz", "user_id": "42", "provider": "cryptomus", "amount": 9900, "currency": "USDT", "status": "paid", "plan_type": 3, "duration_months": 12 }
}
```

---

## ListTransactions
Returns a paginated list of transactions, optionally filtered by user or status.

**Request**
| Field | Type | Required | Description |
|---|---|---|---|
| `access_token` | string | yes | |
| `user_id` | string | no | Filter by user (admin use) |
| `status` | string | no | `pending`, `paid`, `failed`, `refunded` |
| `page` | int | no | Default `1` |
| `limit` | int | no | Default `20` |

**Response**
| Field | Type |
|---|---|
| `success` | bool |
| `transactions` | Transaction[] |
| `total` | int |

**Example**
```json
// Request
{ "access_token": "eyJ...", "status": "paid", "page": 1, "limit": 10 }

// Response
{
  "success": true,
  "transactions": [{ "id": "txn_xyz", "amount": 9900, "currency": "USDT", "status": "paid", "provider": "cryptomus" }],
  "total": 1
}
```
