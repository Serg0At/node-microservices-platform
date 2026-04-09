# Free Trial Abuse Prevention

## Overview

Goal: silently prevent the same user from claiming the 15-day free trial multiple times using different email addresses. No signup friction (no card/phone required).

Scope: web-only.

**Status: Implemented** — all 4 detection layers are active in auth-service. Subscription-service owns the trial duration decision based on `trial_signals`.

---

## Detection Layers

### Layer 1 — Browser Fingerprint (strongest signal)

Collected on the **frontend** via [FingerprintJS](https://github.com/fingerprintjs/fingerprintjs) (open-source) or FingerprintJS Pro (higher accuracy, ~99.5%).

The JS library generates a stable `visitorId` that survives incognito mode and cache clearing. The frontend sends it with the signup request as the `fingerprint` argument to the `register` mutation.

### Layer 2 — IP Address

Available server-side via `req.ip` in the GraphQL Gateway. Forwarded to auth-service as a field in `RegisterUserRequest.ip`. Used as a secondary signal — not a hard block alone (shared IPs exist), but combined with fingerprint it raises confidence.

### Layer 3 — Disposable Email Blocking

Blocks known temporary/disposable email providers using the `disposable-email-domains` npm package. Checked before user creation — returns `InputValidationError` if domain matches.

### Layer 4 — Email Normalization

Normalize emails before abuse checks via `CryptoUtil.normalizeEmail()`:
- Strip `+alias` suffixes: `user+1@gmail.com` → `user@gmail.com`
- Lowercase

---

## Implementation Details

### 1. gRPC Request

```proto
message RegisterUserRequest {
  string email         = 1;
  string username      = 2;
  string password_hash = 3;
  string fingerprint   = 4; // visitorId from FingerprintJS
  string ip            = 5; // Client IP forwarded by gateway
}
```

### 2. GraphQL Mutation

```graphql
register(email: String!, username: String!, password: String!, fingerprint: String): AuthPayload!
```

The `fingerprint` argument is optional — if the frontend hasn't integrated FingerprintJS yet, registration still works but trial signals will have `fingerprint_seen: false`.

The `ip` is extracted from `req.ip` in the gateway context and forwarded automatically.

### 3. RegisterUser Flow

```
1. Normalize email → check disposable provider → reject if blocked
2. Check email/username conflicts
3. EXISTS trial_devices:{sha256(fingerprint)} → fingerprint_seen = true/false
4. EXISTS trial_ips:{sha256(ip)}             → ip_seen = true/false
5. INSERT user into DB
6. SET trial_devices:{sha256(fingerprint)} = user_id  [TTL=365d]
7. SET trial_ips:{sha256(ip)}             = user_id  [TTL=30d]
8. Publish user.registered event with trial_signals
```

**Implementation:** `auth-service/src/services/auth.service.js` → `register()` method.

---

## Redis Keys

```
trial_devices:{sha256(fingerprint)} → user_id  [TTL=365 days]
trial_ips:{sha256(ip)}             → user_id  [TTL=30 days]
```

---

## RabbitMQ Event

Exchange: `auth-events` (topic), routing key: `user.registered`

Consumed by: subscription-service (`subscription-service.auth.queue`), notification-service, user-service.

```json
{
  "user_id": 123,
  "email": "mail@example.com",
  "username": "johndoe",
  "verification_token": "abc123...",
  "trial_signals": {
    "fingerprint_seen": false,
    "ip_seen": false,
    "disposable_email": false
  },
  "ts": 1734103999
}
```

---

## Subscription Service Decision Table

The **Subscription Service** owns the decision on trial length based on signals:

| fingerprint_seen | ip_seen | disposable_email | Result        |
|------------------|---------|------------------|---------------|
| false            | false   | false            | 3-day trial   |
| any true         | —       | —                | 1-day trial   |

If `trial_signals` is missing from the event, treated as clean (3-day trial).

If the user already has `free_trial = true` on their subscription record, no trial is created regardless of signals.

Trial plan is always **Standard (sub_type: 2)**.

---

## Token Rotation — Separate Concern

Opaque refresh tokens are rotated on every use (old deleted, new issued). This detects stolen refresh tokens — if an attacker uses a stolen token first, the legitimate user's next refresh fails.

This identifies a **compromised session**, not a device or user. Do not conflate it with abuse detection.

---

## IP Forwarding

The GraphQL Gateway forwards the client IP via the `ip` field in `RegisterUserRequest`. The value comes from `req.ip` in Express, which respects `trust proxy` settings. In production behind Caddy/Nginx, ensure `trust proxy` is configured to read `X-Forwarded-For`.
