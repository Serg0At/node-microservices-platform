# User Service Architecture

## Overview

The user-service owns profile data and exposes gRPC RPCs for reading/updating user profiles. It shares the same Postgres instance as auth-service but owns its own tables. It communicates with auth-service via RabbitMQ events.

---

## Startup Sequence

```
app.js
  1. initRedis()          -> Redis connection (ioredis)
  2. initRabbitPublisher() -> RabbitMQ publisher channel
  3. initRabbitConsumer()  -> RabbitMQ consumer (listens for user.registered)
  4. startGrpc()           -> gRPC server on port 50052
```

All steps are sequential. If any step fails, the service logs the error and exits with code 1.

---

## Project Structure

```
src/
  app.js                          Entry point, sequential init
  bin/
    server.js                     gRPC server lifecycle + graceful shutdown (SIGINT/SIGTERM)
    loader.js                     Proto loader (@grpc/proto-loader)
  config/
    variables.config.js           Centralized config (server, psql, redis, jwt, rabbitmq, grpc)
    db.js                         Knex instance
    knex.config.js                Connection pool settings (min: 2, max: 10)
  controllers/
    user.controller.js            RPC handlers (GetProfile, UpdateProfile)
  services/
    user.service.js               Business logic, orchestrates model/cache/events
  models/
    Profile.js                    Knex queries (findByUserId, findByUsername, create, update)
  middlewares/
    validations/
      validation.js               Validation orchestration
      schemas/
        user.schemas.js            Joi schemas for both RPCs
  rabbit/
    consumer.js                   Consumes user.registered, creates profile rows
    publisher.js                  Publishes user.profile_updated, user.username_changed
  redis/
    redisClient.js                Profile caching (get/set/invalidate)
  utils/
    logger.util.js                Winston logger (console + file rotation)
    error-handler.util.js         Custom error -> gRPC status code mapping
    success-handler.util.js       Success response wrappers with logging
    circuit-breaker.util.js       Opossum breakers for DB, Redis, RabbitMQ
    jwt.util.js                   RS256 public key verification (no signing)
migrations/
  create_tables.js                profiles table creation
  drop_tables.js                  profiles table teardown
proto/
  user.proto                      gRPC service definition
```

---

## Database Schema

### `profiles` table

| Column       | Type           | Constraints                                   |
|--------------|----------------|-----------------------------------------------|
| id           | bigserial      | PRIMARY KEY                                   |
| user_id      | bigint         | UNIQUE, NOT NULL, FK -> users.id ON DELETE CASCADE |
| username     | citext         | UNIQUE, NOT NULL (case-insensitive)           |
| display_name | varchar(100)   | Nullable                                      |
| avatar_url   | text           | Nullable                                      |
| created_at   | timestamptz    | NOT NULL, DEFAULT now()                       |
| updated_at   | timestamptz    | NOT NULL, DEFAULT now()                       |

The migration also creates the `citext` extension for case-insensitive username lookups.

---

## gRPC Service

```proto
service UserService {
  rpc GetProfile(GetProfileRequest)       returns (GetProfileResponse);
  rpc UpdateProfile(UpdateProfileRequest) returns (UpdateProfileResponse);
}
```

### GetProfile

- **Authentication**: None (public data)
- **Input**: `user_id` (numeric string)
- **Output**: `{ success, profile: { user_id, username, display_name, avatar_url } }`

### UpdateProfile

- **Authentication**: JWT access token (RS256 public key verification)
- **Input**: `{ access_token, username, display_name, avatar_url }`
- **Output**: `{ success, message, profile }`
- **Proto3 field handling**: All string fields default to `""`. The service uses truthy checks to distinguish "not provided" (empty string) from "provided" — only non-empty fields that differ from the existing value trigger an update.

---

## Request Flows

### GetProfile

```
Client -> gRPC -> UserController.getProfile()
  1. Validate user_id (Joi: must be numeric string)
  2. UserService.getProfile()
     a. Check Redis cache (key: profile_cache:{userId})
     b. Cache hit  -> return cached profile
     c. Cache miss -> query DB via ProfileModel.findByUserId()
     d. Not found  -> throw ResourceNotFoundError (gRPC NOT_FOUND)
     e. Cache result in Redis (TTL: 300s)
  3. Return profile via SuccessHandler.profileFetched()
```

### UpdateProfile

```
Client -> gRPC -> UserController.updateProfile()
  1. Validate all fields (Joi schema)
  2. UserService.updateProfile()
     a. Verify JWT access token -> extract userId
     b. Fetch existing profile from DB
     c. Diff each field against existing:
        - username:     truthy check + uniqueness check against DB
        - display_name: truthy check + diff
        - avatar_url:   truthy check + diff
     d. No changes? -> return existing profile, "No changes detected"
     e. Atomic update via db.transaction() -> ProfileModel.update()
     f. Invalidate Redis cache
     g. Publish events:
        - username changed    -> user.username_changed
        - other fields changed -> user.profile_updated
        - both changed        -> both events fire
  3. Return updated profile via SuccessHandler.profileUpdated()
```

### Profile Creation (event-driven)

```
auth-service publishes user.registered
  -> RabbitMQ (exchange: auth-events, routing key: user.registered)
  -> consumer.js picks up message from user-service.auth-events.queue
     1. Parse { user_id, username } from payload
     2. ProfileModel.create() in transaction
     3. ACK message
     4. On error: retry up to 3 times with delay, then NACK
```

---

## RabbitMQ Integration

All events flow through the `auth-events` exchange (type: `topic`, durable: `true`).

### Events Consumed

| Routing Key      | Queue                            | Payload                                             | Action                |
|------------------|----------------------------------|-----------------------------------------------------|-----------------------|
| user.registered  | user-service.auth-events.queue   | { user_id, email, username, verification_token, ts } | Create profiles row   |

### Events Published

| Routing Key          | Trigger                          | Payload                                          |
|----------------------|----------------------------------|--------------------------------------------------|
| user.profile_updated | Non-username fields updated      | { user_id, fields_changed[], ts }                |
| user.username_changed| Username updated                 | { user_id, old_username, new_username, ts }      |

### Consumer Retry Logic

- Messages carry an `x-retry-count` header
- On failure: increment count, re-publish with delay (5000ms), ACK original
- After 3 retries: NACK (no requeue, message is discarded or dead-lettered)

### Reconnection

Both consumer and publisher monitor connection/channel close events and reconnect with exponential backoff (max 30s).

---

## Caching Strategy

| Operation          | Redis Key              | TTL  | Trigger                  |
|--------------------|------------------------|------|--------------------------|
| Cache profile      | profile_cache:{userId} | 300s | After DB read (GetProfile) |
| Read cache         | profile_cache:{userId} | -    | Before DB read (GetProfile) |
| Invalidate cache   | profile_cache:{userId} | -    | After any UpdateProfile    |

Redis is configured with `retryStrategy: null` (fail fast), no offline queue, no ready check.

---

## Circuit Breakers

All external calls are wrapped in opossum circuit breakers.

| Breaker        | Timeout | Error Threshold | Reset Timeout | Volume Threshold |
|----------------|---------|-----------------|---------------|------------------|
| dbBreaker      | 5000ms  | 50%             | 10000ms       | 5 failures       |
| redisBreaker   | 2000ms  | 50%             | 10000ms       | 5 failures       |
| rabbitBreaker   | 5000ms  | 50%             | 20000ms       | 5 failures       |

States: closed (normal) -> open (failing fast) -> half-open (testing recovery) -> closed.

---

## Error Handling

### Custom Errors -> gRPC Status Codes

| Error Name             | gRPC Status          |
|------------------------|----------------------|
| ConflictError          | ALREADY_EXISTS (6)   |
| InputValidationError   | INVALID_ARGUMENT (3) |
| UnauthorizedError      | UNAUTHENTICATED (16) |
| ResourceNotFoundError  | NOT_FOUND (5)        |
| PermissionError        | PERMISSION_DENIED (7)|

### PostgreSQL Error Codes

| PG Code | Meaning             | gRPC Status         |
|---------|---------------------|----------------------|
| 23505   | Unique violation    | ALREADY_EXISTS       |
| 23503   | FK violation        | FAILED_PRECONDITION  |
| 23502   | NOT NULL violation  | INVALID_ARGUMENT     |
| 23514   | Check violation     | INVALID_ARGUMENT     |

---

## Validation Schemas

### GetProfile

| Field   | Rule                        |
|---------|-----------------------------|
| user_id | Required, numeric string    |

### UpdateProfile

| Field        | Rule                                            |
|--------------|-------------------------------------------------|
| access_token | Required, min 1 char                            |
| username     | Optional, 3-30 chars, no "@" sign, allow empty  |
| display_name | Optional, max 100 chars, allow empty            |
| avatar_url   | Optional, valid URI, allow empty                 |

---

## JWT Verification

- Algorithm: RS256 (asymmetric)
- Key: Public key only (loaded from file at startup)
- Purpose: Verify access tokens issued by auth-service
- Never signs tokens (auth-service's responsibility)
- Returns decoded payload with `id` (userId) on success, `null` on failure

---

## Logging

Winston logger with:
- Console transport (colorized in dev)
- File transports:
  - `error.log` — errors only, 5MB max, 5 file rotation
  - `combined.log` — all levels, 10MB max, 5 file rotation
- Format: timestamp + level + service + method + message + stack

---

## Environment Variables

| Variable                  | Purpose                    | Default                          |
|---------------------------|----------------------------|----------------------------------|
| NODE_ENV                  | Environment                | development                      |
| SERVICE_NAME              | Service identifier         | user-service                     |
| SERVICE_PORT              | gRPC port                  | 50052                            |
| SERVICE_LOG_LEVEL         | Log level                  | info                             |
| PSQL_HOST                 | PostgreSQL host            | -                                |
| PSQL_PORT                 | PostgreSQL port            | 5432                             |
| PSQL_USER                 | PostgreSQL user            | -                                |
| PSQL_PASSWORD             | PostgreSQL password        | -                                |
| PSQL_DATABASE             | PostgreSQL database        | -                                |
| REDIS_URL                 | Redis connection URI       | redis://localhost:6379           |
| RABBITMQ_HOST             | RabbitMQ host              | localhost                        |
| RABBITMQ_PORT             | RabbitMQ port              | 5672                             |
| RABBITMQ_USER             | RabbitMQ user              | admin                            |
| RABBITMQ_PASSWORD         | RabbitMQ password          | admin                            |
| JWT_ACCESS_PUBLIC_KEY_PATH| Path to RS256 public key   | ./keys/access_public.pem         |
| JWT_ACCESS_ALG            | JWT algorithm              | RS256                            |
| GRPC_MAX_MESSAGE_SIZE     | Max gRPC message bytes     | 4194304 (4MB)                    |

---

## Key Design Decisions

1. **JWT verification only** — public key verifies tokens, never signs them
2. **Username lives in both services** — auth-service for login, user-service for display/edit, synced via events
3. **Profile creation is event-driven** — no direct gRPC call between services for registration
4. **Same Postgres, different tables** — shared DB instance, service boundary at the table level
5. **GetProfile is unauthenticated** — profiles are public data
6. **Proto3 empty string convention** — empty strings from unset fields are treated as "not provided" via truthy checks, so clients always send all fields but only populated ones trigger updates
7. **Cache invalidation over update** — on profile change, the cache is deleted rather than updated, ensuring the next read fetches fresh data
