# User Service Specification

## Overview

The user-service owns **profile data** and exposes gRPC RPCs for reading/updating user profiles. It shares the same Postgres instance as auth-service but owns its own tables. It communicates with auth-service via RabbitMQ events.

---

## Database Tables

### `profiles`

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | `bigserial` | PK | |
| `user_id` | `bigint` | UNIQUE, NOT NULL, FK → `users.id` ON DELETE CASCADE | One-to-one with auth `users` table |
| `username` | `varchar(30)` | UNIQUE, NOT NULL | Synced from auth on registration, editable here |
| `display_name` | `varchar(100)` | nullable | |
| `avatar_url` | `text` | nullable | |
| `created_at` | `timestamptz` | NOT NULL, DEFAULT now() | |
| `updated_at` | `timestamptz` | NOT NULL, DEFAULT now() | |

---

## gRPC Service Definition

```proto
service UserService {
  rpc GetProfile(GetProfileRequest) returns (GetProfileResponse);
  rpc UpdateProfile(UpdateProfileRequest) returns (UpdateProfileResponse);
}

message UserProfile {
  string user_id = 1;
  string username = 2;
  string display_name = 3;
  string avatar_url = 4;
  string bio = 5;
}

message GetProfileRequest {
  string user_id = 1;
}

message GetProfileResponse {
  bool success = 1;
  UserProfile profile = 2;
}

message UpdateProfileRequest {
  string access_token = 1;
  string username = 2;
  string display_name = 3;
  string avatar_url = 4;
  string bio = 5;
}

message UpdateProfileResponse {
  bool success = 1;
  string message = 2;
  UserProfile profile = 3;
}
```

---

## RabbitMQ Integration

### Events consumed (from auth-service)

| Routing Key | Source Exchange | Payload | Action |
|-------------|---------------|---------|--------|
| `user.registered` | `auth-events.notification` (topic) | `{ user_id, email, username, verification_token, ts }` | Create `profiles` row with `user_id` + `username` |

**How it works**: auth-service already publishes `user.registered` on every registration. The `auth-events.notification` exchange is type `topic` with bind pattern `user.*`. User-service creates its own queue (e.g. `user-service.notification.queue`) bound to the same exchange — both notification-service and user-service receive the event independently.

**Auth-service change already applied**: `username` was added to the `user.registered` event payload in `auth.service.js` → `register()`.

### Events published (by user-service)

User-service publishes on its own exchange or reuses `auth-events.notification`:

| Routing Key | Trigger | Payload |
|-------------|---------|---------|
| `user.profile_updated` | After UpdateProfile (non-username fields) | `{ user_id, fields_changed[], ts }` |
| `user.username_changed` | After username change | `{ user_id, old_username, new_username, ts }` |

### Username sync back to auth-service

When a user changes their username via user-service, it publishes `user.username_changed`. Auth-service needs a **consumer** to listen for this and update `users.username` so login-by-username keeps working.

Auth-service consumer (to be added later):

```
Queue: auth-service.username-sync.queue
Exchange: auth-events.notification (topic)
Routing key: user.username_changed
Action: UPDATE users SET username = new_username WHERE id = user_id
```

**Note**: auth-service currently only publishes events — it has no consumer. Adding one is a separate task when user-service is ready.

---

## Service Architecture

```
src/
├── bin/
│   ├── server.js          # gRPC server startup
│   └── loader.js          # Proto loader
├── config/
│   ├── variables.config.js
│   └── db.js              # Knex instance (same Postgres, separate connection)
├── controllers/
│   └── user.controller.js
├── middlewares/
│   └── validations/
│       ├── schemas/
│       │   └── user.schemas.js
│       └── validation.js
├── models/
│   └── Profile.js
├── rabbit/
│   ├── consumer.js        # Listens for user.registered
│   └── publisher.js       # Publishes user.profile_updated, user.username_changed
├── services/
│   └── user.service.js
├── utils/
│   ├── logger.util.js
│   ├── error-handler.util.js
│   ├── success-handler.util.js
│   └── circuit-breaker.util.js
├── migrations/
│   └── create_tables.js   # profiles table
└── index.js               # Entry point
```

---

## Dependencies

```json
{
  "@grpc/grpc-js": "^1.14.x",
  "@grpc/proto-loader": "^0.8.x",
  "amqplib": "^0.10.x",
  "dotenv": "^17.x",
  "ioredis": "^5.x",
  "joi": "^18.x",
  "jsonwebtoken": "^9.x",
  "knex": "^3.x",
  "opossum": "^9.x",
  "pg": "^8.x",
  "winston": "^3.x"
}
```

---

## Environment Variables

```env
# Server
SERVICE_NAME=user-service
SERVICE_PORT=50052

# PostgreSQL (same instance as auth-service)
PSQL_HOST=
PSQL_PORT=5432
PSQL_USER=
PSQL_PASSWORD=
PSQL_DATABASE=

# Redis (for caching profile lookups)
REDIS_URL=

# RabbitMQ
RABBITMQ_HOST=
RABBITMQ_PORT=5672
RABBITMQ_USER=
RABBITMQ_PASSWORD=

# JWT (public key only — for verifying access tokens, not signing)
JWT_ACCESS_PUBLIC_KEY_PATH=
JWT_ACCESS_ALG=RS256

# gRPC
GRPC_MAX_MESSAGE_SIZE=4194304
```

---

## Key Design Decisions

1. **JWT verification only** — user-service needs the RS256 **public key** to verify access tokens. It never signs tokens (that's auth-service's job).

2. **Username lives in both services** — auth-service uses it for login lookup, user-service uses it for display/edit. Changes propagate via `user.username_changed` event.

3. **Profile creation is event-driven** — when auth-service publishes `user.registered`, user-service consumes it and creates the profile row. No direct gRPC call between services for this.

4. **Same Postgres, different tables** — both services connect to the same database but only touch their own tables. This keeps things simple while maintaining service boundaries.

5. **GetProfile is unauthenticated** — profiles are public data (user_id lookup). UpdateProfile requires a valid access token.

6. **Username uniqueness** — the `profiles.username` column has a UNIQUE constraint. On update, validate uniqueness before committing. The auth-service `users.username` constraint also prevents duplicates, and the event sync keeps them aligned.
