# Token System

This document explains how authentication tokens work in the auth-service: what each token is, where it lives, how it's created, how it's validated, and how the refresh rotation works.

---

## Two Tokens, Two Purposes

The auth-service issues two tokens on every successful login or registration:

| | Access Token | Refresh Token |
|---|---|---|
| **What it is** | A signed JWT (JSON Web Token) | An opaque random hex string (64 characters) |
| **Algorithm** | RS256 (asymmetric: private key signs, public key verifies) | None (not a JWT, not signed) |
| **Where it lives** | Client memory / `Authorization` header | Redis key `refresh:{token}` + client cookie |
| **Lifetime** | 15 minutes (configurable via `ACCESS_TOKEN_ACTIVE_TIME`) | 30 days (configurable via `REDIS_REFRESH_TOKEN_TTL`) |
| **Who can verify** | Any service with the public key (gateway, other microservices) | Only auth-service (looks up Redis) |
| **Revocable** | No (valid until expiry) | Yes (delete from Redis instantly) |
| **Contains user data** | Yes (`id`, `email`, `role`, `sub_type`, `ua_hash`) | No (Redis stores `user_id`, `device`, `expires_at`) |

---

## Access Token (JWT, RS256)

### Structure

The access token is a standard JWT with three parts: `header.payload.signature`

**Header:**
```json
{
  "alg": "RS256",
  "typ": "JWT"
}
```

**Payload:**
```json
{
  "id": 42,
  "email": "user@example.com",
  "role": 0,
  "sub_type": 2,
  "ua_hash": "a1b2c3d4...sha256-of-user-agent",
  "iat": 1708600000,
  "exp": 1708600900,
  "iss": "auth-service",
  "aud": "graphql-gateway"
}
```

**Key fields:**

- `id`, `email`, `role` -- user identity, carried in every request so downstream services don't need to query the DB
- `sub_type` -- current subscription tier (0=None, 1=Lite, 2=Standard, 3=PRO). Used as a **soft check** for frontend feature visibility. Read from Redis `user_sub:{userId}` at token generation time. Updated via subscription events consumed by auth-service. May be stale by up to 15 minutes (token TTL). For **hard access checks**, services should call `SubscriptionService.CheckAccess()` RPC
- `ua_hash` -- SHA-256 hash of the user-agent string (device fingerprint). If a token is stolen and used from a different device, the hash won't match. The gateway can check this
- `iss` / `aud` -- issuer and audience claims. The gateway rejects tokens not issued by `auth-service` or not intended for `graphql-gateway`
- `exp` -- expiration timestamp. After this, the token is dead. No exceptions

### How it's created

```
src/utils/jwt.util.js -> JwtUtil.generateAccessToken(payload, uaHash)
```

1. Sign the payload with the RSA **private key** using RS256
2. Set `expiresIn`, `issuer`, `audience` from config
3. Return `{ accessToken }`

The private key never leaves the auth-service. It's loaded from a PEM file at startup:
```
JWT_ACCESS_PRIVATE_KEY_PATH=/path/to/private.pem
JWT_ACCESS_PUBLIC_KEY_PATH=/path/to/public.pem
```

### How it's validated (by the gateway)

The gateway loads the **public key** and verifies locally -- no gRPC call to auth-service needed:

```js
jwt.verify(token, publicKey, { algorithms: ['RS256'] })
```

This checks:
- Signature is valid (wasn't tampered with)
- `exp` hasn't passed
- `iss` and `aud` match expected values

If any check fails, the request is rejected. Auth-service is never contacted.

### Why RS256 (asymmetric)?

With HS256 (symmetric), every service that verifies tokens needs the shared secret -- if any one is compromised, all tokens can be forged. With RS256, only auth-service has the private key. Other services only have the public key, which can verify but never create tokens.

---

## Refresh Token (opaque, Redis-backed)

### Structure

The refresh token is **not a JWT**. It's 32 cryptographically random bytes encoded as a 64-character hex string:

```
a3f8b2c1d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1
```

It carries no information by itself. All state is in Redis.

### Redis storage

```
Key:   refresh:a3f8b2c1d4e5f6...
Value: { "user_id": 42, "device": "sha256-of-user-agent", "expires_at": 1711192000000 }
TTL:   2592000 seconds (30 days)
```

**Fields:**

- `user_id` -- who this token belongs to
- `device` -- SHA-256 hash of the user-agent at the time of login. If the refresh request comes from a different device, it's rejected
- `expires_at` -- timestamp in milliseconds. Redundant with Redis TTL but useful for inspection

### How it's created

```
src/utils/jwt.util.js -> JwtUtil.generateRefreshToken()
src/redis/redisClient.js -> redisOps.saveRefreshToken(token, userId, device)
```

1. `crypto.randomBytes(32).toString('hex')` -- 256 bits of entropy, cryptographically secure
2. Store in Redis with the user's ID, device hash, and 30-day TTL
3. Return the raw hex string to the client

### Why opaque instead of JWT?

- **Instant revocation**: delete the Redis key and the token is dead. No waiting for expiry
- **No secret management**: no HS256 secret to rotate or leak
- **Token rotation**: old token is deleted on use, new one is issued. If an attacker steals a refresh token and uses it, the legitimate user's next refresh fails (detecting the theft)
- **Server-controlled lifetime**: TTL is in Redis, not baked into the token. You can change it without re-issuing tokens

---

## The Full Token Lifecycle

### 1. Login / Register

```
Client sends credentials
  -> auth-service validates
  -> revokes old refresh token for this device (via device_token reverse index)
  -> generates access token (JWT, RS256, 15min)
  -> generates refresh token (random hex, stored in Redis, 30 days)
  -> saves reverse index: device_token:{userId}:{uaHash} -> token
  -> returns both to client
```

**Code path:** `AuthService.register()` or `AuthService.login()` in `src/services/auth.service.js`

### 2. Authenticated requests (0-15 minutes)

```
Client sends: Authorization: Bearer <access_token>
  -> gateway verifies JWT locally with public key
  -> extracts user payload (id, email, role)
  -> forwards request to downstream services
  -> auth-service is NOT involved
```

### 3. Access token expires (after 15 minutes)

```
Client sends request with expired access token
  -> gateway rejects: 401 Unauthorized
  -> client knows it's time to refresh
```

### 4. Token refresh (rotation)

```
Client sends: RefreshTokens RPC with refresh_token + user-agent metadata
  -> auth-service looks up refresh:{token} in Redis
  -> if not found: UNAUTHENTICATED (token expired, revoked, or never existed)
  -> if found: check device hash matches user-agent hash
  -> if mismatch: UNAUTHENTICATED (different device)
  -> if match:
     1. DELETE old refresh token from Redis (can never be reused)
     2. Generate new access token (JWT)
     3. Generate new refresh token (random hex)
     4. STORE new refresh token in Redis
     5. Return both to client
```

**Code path:** `AuthService.refreshTokens()` in `src/services/auth.service.js`

**This is token rotation** -- every refresh request produces a completely new pair. The old refresh token is destroyed. If an attacker steals the refresh token and uses it first, the legitimate user's next refresh attempt fails because the old token was already consumed. This is a detectable signal that the token was compromised.

### 5. Logout (future)

```
Client sends logout request
  -> auth-service deletes refresh:{token} from Redis
  -> access token continues to work until its 15min expiry (short-lived, no blacklist needed)
```

---

## Device Binding (ua_hash)

Both tokens are bound to the device (user-agent string) at creation time:

- **Access token**: `ua_hash` is embedded in the JWT payload. The gateway can compare it against the incoming request's user-agent
- **Refresh token**: `device` field in Redis. Auth-service checks it during refresh

If someone steals a token and uses it from a different browser/device, the hash won't match.

The user-agent is hashed with SHA-256 via `CryptoUtil.hashUA(userAgent)` before storage. The raw user-agent is never stored in Redis or the JWT.

---

## sub_type in JWT — How It Stays Fresh

Auth-service consumes events from the `subscription-events` RabbitMQ exchange:

| Event | Action |
|---|---|
| `subscription.activated` | Set `user_sub:{userId}` = `sub_type` in Redis |
| `subscription.reactivated` | Set `user_sub:{userId}` = `sub_type` in Redis |
| `subscription.terminated` | Set `user_sub:{userId}` = `0` in Redis |
| `subscription.canceled` | No change (user retains access until `ended_at`) |
| `subscription.expired` | No change (user retains access during grace period) |

On every token generation (login, refresh, 2FA verify), auth-service reads `user_sub:{userId}` from Redis and includes it in the JWT payload. Default is `0` if the key doesn't exist.

**Queue:** `auth-service.subscription.queue` bound to `subscription-events` exchange with pattern `subscription.*`.

**Staleness window:** max 15 minutes (access token TTL). The frontend should use the `mySubscription` GraphQL query for real-time status and the JWT `sub_type` for UI feature gating.

---

## Redis Keys Summary

| Key pattern | Purpose | TTL |
|---|---|---|
| `refresh:{token}` | Refresh token session data | 30 days |
| `device_token:{userId}:{uaHash}` | Reverse index: device -> current refresh token | 30 days |
| `user_sessions:{userId}` | Set of active device hashes | 7 days |
| `reset_codes:sha256(email)` | Password reset / verification code | 15 minutes |
| `verify_token:{token}` | Email verification token | 15 minutes |
| `user_cache:{userId}` | Cached user profile | 5 minutes |
| `user_sub:{userId}` | Current subscription tier for JWT inclusion | No TTL (persistent) |
| `trial_devices:{sha256(fp)}` | FingerprintJS visitorId trial tracking | 365 days |
| `trial_ips:{sha256(ip)}` | IP address trial tracking | 30 days |

---

## Environment Variables

```bash
# Access token (RSA key pair)
JWT_ACCESS_ALG=RS256
JWT_ACCESS_PRIVATE_KEY_PATH=/keys/private.pem
JWT_ACCESS_PUBLIC_KEY_PATH=/keys/public.pem
ACCESS_TOKEN_ACTIVE_TIME=15m

# Refresh token (Redis TTL)
REDIS_REFRESH_TOKEN_TTL=2592000   # 30 days in seconds

# JWT metadata
JWT_ISSUER=auth-service
JWT_AUDIENCE=graphql-gateway
```

---

## Security Properties

| Property | Access Token | Refresh Token |
|---|---|---|
| Tamper-proof | Yes (RS256 signature) | N/A (opaque, server-side) |
| Revocable | No (until expiry) | Yes (delete Redis key) |
| Rotated on use | No | Yes (old deleted, new issued) |
| Device-bound | Yes (`ua_hash` in payload) | Yes (`device` in Redis) |
| Theft detection | Gateway can check `ua_hash` | Rotation detects reuse |
| Replay protection | Short TTL (15min) | Single-use (deleted after refresh) |

---

## File References

| File | Role |
|---|---|
| `src/utils/jwt.util.js` | `generateAccessToken()`, `generateRefreshToken()`, `verifyAccessToken()` |
| `src/redis/redisClient.js` | `saveRefreshToken()`, `getRefreshToken()`, `deleteRefreshToken()`, `revokeDeviceToken()` |
| `src/services/auth.service.js` | Token issuance in `register()`, `login()`, `refreshTokens()` |
| `src/services/oauth.service.js` | Token issuance in `oidcLogin()` |
| `src/config/variables.config.js` | TTLs, algorithm, key paths |
| `src/utils/crypto.util.js` | `hashUA()` for device fingerprinting |
