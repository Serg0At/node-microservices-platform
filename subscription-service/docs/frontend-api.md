# Subscription Service — Frontend Developer Reference

**Service:** Subscription Service  
**Responsibility:** Manages the full subscription lifecycle including plan checkout, cancellation, restoration, promo code validation, and access-level checks, publishing events to RabbitMQ whenever subscription state changes. All user-facing routes require a JWT access token.

> All RPCs are exposed through the GraphQL gateway. `sub_type`: `0`=None, `1`=Lite, `2`=Standard, `3`=PRO.

---

## GetSubscription
Returns the current user's active subscription details.

**Request**
| Field | Type | Required |
|---|---|---|
| `access_token` | string | yes |

**Response**
| Field | Type | Description |
|---|---|---|
| `success` | bool | |
| `subscription.id` | string | |
| `subscription.user_id` | string | |
| `subscription.sub_type` | int | `0`–`3` |
| `subscription.free_trial` | bool | Whether this is a trial |
| `subscription.status` | string | `active`, `canceled`, `expired`, `terminated` |
| `subscription.started_at` | string | ISO 8601 |
| `subscription.ended_at` | string | ISO 8601 |
| `subscription.grace_period_end` | string | ISO 8601 — user retains access until this date after expiry |
| `subscription.issued_by` | string | `"User"`, `"Admin"`, `"Promo"` |

**Example**
```json
// Request
{ "access_token": "eyJ..." }

// Response
{
  "success": true,
  "subscription": {
    "id": "sub_1", "user_id": "42", "sub_type": 3, "free_trial": false,
    "status": "active", "started_at": "2026-01-01T00:00:00Z", "ended_at": "2027-01-01T00:00:00Z"
  }
}
```

---

## CheckAccess
Checks whether a user has at least the required subscription level; used internally by the gateway for feature gating.

**Request**
| Field | Type | Required | Description |
|---|---|---|---|
| `user_id` | string | yes | |
| `required_level` | int | yes | Minimum `sub_type` needed |

**Response**
| Field | Type | Description |
|---|---|---|
| `has_access` | bool | `true` if `current_level >= required_level` |
| `current_level` | int | User's actual `sub_type` |
| `status` | string | Subscription status |

**Example**
```json
// Request
{ "user_id": "42", "required_level": 2 }

// Response
{ "has_access": true, "current_level": 3, "status": "active" }
```

---

## CreateCheckout
Initiates a payment checkout for a subscription plan; returns a payment URL to redirect the user to.

**Request**
| Field | Type | Required | Description |
|---|---|---|---|
| `access_token` | string | yes | |
| `plan_type` | int | yes | `1`=Lite, `2`=Standard, `3`=PRO |
| `payment_method` | string | yes | `"crypto"` or `"card"` |
| `duration_months` | int | yes | `1`, `3`, `6`, or `12` |
| `promo_code` | string | no | Optional discount code |

**Response**
| Field | Type | Description |
|---|---|---|
| `success` | bool | |
| `payment_url` | string | Redirect user here to complete payment |
| `order_id` | string | Internal order reference |
| `expires_in` | int | Seconds until checkout session expires |
| `proration.remaining_days` | int | Days left on current plan (if upgrading) |
| `proration.remaining_value_cents` | int | Credit from current plan |
| `proration.new_plan_price_cents` | int | Full price of new plan |
| `proration.discount_cents` | int | Promo discount applied |
| `proration.final_price_cents` | int | Amount user will be charged |

**Example**
```json
// Request
{ "access_token": "eyJ...", "plan_type": 3, "payment_method": "crypto", "duration_months": 12, "promo_code": "SAVE20" }

// Response
{
  "success": true,
  "payment_url": "https://pay.cryptomus.com/...",
  "order_id": "ord_abc123",
  "expires_in": 1800,
  "proration": { "remaining_days": 15, "remaining_value_cents": 500, "new_plan_price_cents": 9900, "discount_cents": 1980, "final_price_cents": 7420 }
}
```

---

## CancelSubscription
Cancels the current user's subscription at period end (user retains access until `ended_at`).

**Request**
| Field | Type | Required |
|---|---|---|
| `access_token` | string | yes |

**Response**
| Field | Type | Description |
|---|---|---|
| `success` | bool | |
| `subscription` | Subscription | Updated subscription with `status: "canceled"` |

**Example**
```json
// Request
{ "access_token": "eyJ..." }

// Response
{ "success": true, "subscription": { "id": "sub_1", "status": "canceled", "ended_at": "2027-01-01T00:00:00Z" } }
```

---

## RestoreSubscription
Restores a previously canceled subscription before it expires.

**Request**
| Field | Type | Required |
|---|---|---|
| `access_token` | string | yes |

**Response**
| Field | Type |
|---|---|
| `success` | bool |
| `subscription` | Subscription — `status` back to `"active"` |

**Example**
```json
// Request
{ "access_token": "eyJ..." }

// Response
{ "success": true, "subscription": { "id": "sub_1", "status": "active" } }
```

---

## ValidatePromoCode
Validates a promo code for a given plan and returns the calculated discount without creating a checkout.

**Request**
| Field | Type | Required |
|---|---|---|
| `access_token` | string | yes |
| `code` | string | yes |
| `plan_type` | int | yes |
| `duration_months` | int | yes |

**Response**
| Field | Type | Description |
|---|---|---|
| `success` | bool | |
| `valid` | bool | Whether the code is applicable |
| `discount_type` | string | `"percentage"` or `"fixed"` |
| `discount_value` | int | |
| `discount_amount_cents` | int | Calculated saving in cents |
| `final_price_cents` | int | Price after discount |
| `message` | string | Error reason if `valid: false` |

**Example**
```json
// Request
{ "access_token": "eyJ...", "code": "SAVE20", "plan_type": 3, "duration_months": 12 }

// Response
{ "success": true, "valid": true, "discount_type": "percentage", "discount_value": 20, "discount_amount_cents": 1980, "final_price_cents": 7920 }
```
