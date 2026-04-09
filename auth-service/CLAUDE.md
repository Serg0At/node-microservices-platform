# Auth Service — Project Guide

## Overview
gRPC-based authentication microservice (Node.js, ES modules). Part of a larger microservices architecture with a GraphQL gateway as the consumer.

## Tech Stack
- **Transport**: gRPC (`@grpc/grpc-js`, `@grpc/proto-loader`) — proto at `proto/auth.proto`
- **Database**: PostgreSQL via Knex.js (tables: `users`, `user_2fa`, `oauth_accounts`)
- **Cache/Sessions**: Redis (ioredis) — sessions, refresh tokens, reset codes, email verification
- **Messaging**: RabbitMQ (amqplib) — topic exchange for notifications, fanout for subscriptions
- **Auth**: RS256 JWT access tokens, opaque refresh tokens (stored in Redis, 30-day TTL)
- **2FA**: TOTP via `otplib@12` (NOT v13 — v13 has breaking API changes), QR codes via `qrcode`
- **Resilience**: Circuit breakers via `opossum` (dbBreaker, redisBreaker, rabbitBreaker)
- **Validation**: Joi schemas in middleware layer
- **Logging**: Winston

## Project Structure
```
src/
├── bin/            # gRPC server bootstrap + proto loader
├── config/         # variables.config.js (all env vars), db.js, knex.config.js
├── controllers/    # gRPC handlers (call, callback pattern)
├── middlewares/    # Joi validation (schemas/ + validation.js)
├── models/         # Knex query builders (Auth.js, OAuth.js, TwoFa.js)
├── services/       # Business logic (auth.service.js, oauth.service.js, twofa.service.js)
├── rabbit/         # RabbitMQ publisher
├── redis/          # Redis client + operations (redisOps)
├── utils/          # jwt, crypto, error-handler, success-handler, circuit-breaker, logger
└── app.js          # Entry point — boots Redis, RabbitMQ, DB, then gRPC server
proto/auth.proto    # All RPC definitions
migrations/         # create_tables.js / drop_tables.js
```

## Key Patterns

### gRPC Handler Pattern
Controllers follow: `static async methodName(call, callback)` → validate → call service → SuccessHandler / ErrorHandler

### Error Handling
Custom error classes in `error-handler.util.js` map to gRPC status codes:
- Throw `new Error('msg')` with `err.name = 'ErrorClassName'` in services
- `ErrorHandler.handle(callback, error, meta)` resolves gRPC status and logs

### Redis Key Patterns
- `user_sessions:{userId}` — SET of uaHashes
- `refresh_token:{token}` — hash with userId, uaHash
- `device_token:{userId}:{uaHash}` — reverse index for old token cleanup
- `reset_code:{hashedEmail}` — password reset codes
- `verify_token:{token}` — email verification tokens

### RabbitMQ Events
Published via `publishAuthEvent(routingKey, payload)`:
- `user.registered` — { user_id, email, username }
- `user.logged_in`, `user.password_changed`, `user.verify_email`, `user.forgot_password`
- `user.2fa_enabled` — { user_id, email }

### 2FA Flow
1. **Setup**: Generate TOTP secret → encrypt with AES-256-GCM → store in `user_2fa` (enabled=false) → return QR + backup codes
2. **First Verify**: Validate TOTP code → set enabled=true → generate full tokens + session
3. **Login with 2FA**: Return `requires_2fa: true` + short-lived token (300s, no refresh token) → client shows code input
4. **Post-login Verify**: Validate code → generate access token with `acr: '2fa'` claim + refresh token → full session created

### JWT extraClaims
`JwtUtil.generateAccessToken(payload, uaHash, extraClaims)` — currently only used for `{ acr: '2fa' }` after 2FA verification

### Encryption
`CryptoUtil.encrypt/decrypt` uses AES-256-GCM with `config.SECURITY.ENCRYPTION_KEY` — used for TOTP secrets

## NPM Scripts
- `npm run dev` — development with nodemon
- `npm run migrate` / `npm run migrate-down` — DB migrations
- `npm run reload` — kill port 50051 + restart dev

## Important Notes
- Use `otplib@12`, NOT v13 (v13 requires explicit crypto plugin setup, causes CryptoPluginMissingError)
- Proto is loaded once at startup (`src/bin/loader.js`) with `keepCase: true` — restart server after proto changes
- Refresh tokens are opaque (crypto.randomBytes), NOT JWTs
- Device token cleanup uses reverse index pattern to revoke old tokens on same device
- Backup codes: plaintext returned to user, SHA-256 hashes stored in DB (JSONB column)
- Circuit breaker timeout: 5000ms for DB operations

### Ban Enforcement
- Login flow checks `user.banned_at` after password validation — throws `Forbidden` if banned
- Token refresh checks `user.banned_at` after loading user — revokes refresh token and throws `Forbidden` if banned
- Ban columns (`banned_at`, `ban_reason`) are defined in `migrations/create_tables.js` on the `users` table
- Banning/unbanning is done by the **admin-service** — auth-service only enforces the check

## Related Services
- **GraphQL Gateway**: Consumer of this service's gRPC API, audience for JWTs
- **Admin Service**: Reads/writes to the same `users` table for user management, role updates, and bans
- **User Service**: Separate service for profiles (username, display_name, avatar). Spec at `docs/user-service-spec.md`. Consumes `user.registered` event to create profile. Same Postgres instance, different tables.
