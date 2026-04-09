# Architecture & Data Flow

## Overview

The GraphQL Gateway is a **stateless proxy/orchestrator**. It has no database, no Redis, no message queue. Its sole purpose is to:

1. Accept HTTP GraphQL requests from clients (web/mobile)
2. Verify JWT access tokens
3. Validate input with Joi
4. Forward requests to backend gRPC microservices
5. Map gRPC responses (snake_case) → GraphQL responses (camelCase)
6. Map gRPC errors → GraphQL errors

---

## System Architecture

```
  Client (web / mobile)
        │
        ▼  HTTP POST /graphql
  ┌───────────────────────────────────────────┐
  │            GraphQL Gateway (:4000)         │
  │                                           │
  │  ┌─────────────────────────────────────┐  │
  │  │         Express Middleware           │  │
  │  │  Helmet → CORS → Rate Limit → JSON  │  │
  │  └──────────────┬──────────────────────┘  │
  │                 │                         │
  │  ┌──────────────▼──────────────────────┐  │
  │  │         Apollo Server v4            │  │
  │  │                                     │  │
  │  │  1. Auth Context (JWT verify)       │  │
  │  │  2. @auth directive check           │  │
  │  │  3. @rateLimit directive check      │  │
  │  │  4. Joi validation                  │  │
  │  │  5. Resolver → gRPC call            │  │
  │  │  6. Response mapping                │  │
  │  └──────────────┬──────────────────────┘  │
  └─────────────────┼─────────────────────────┘
                    │ gRPC (protobuf)
          ┌─────────┴─────────┐
          ▼                   ▼
   auth-service (:50051)  user-service (:50052)
   - RegisterUser         - GetProfile
   - LoginUser            - UpdateProfile
   - OIDCLogin
   - ForgotPassword
   - VerifyResetCode
   - ResetPassword
   - ChangePassword
   - Setup2FA
   - Verify2FA
   - VerifyEmail
   - RefreshTokens
   - Logout
```

---

## Request Lifecycle

Every GraphQL request passes through these stages in order:

### Stage 1 — Express Middleware

```
Request → Helmet → CORS → express-rate-limit → JSON parser
```

- **Helmet**: Sets security HTTP headers (CSP disabled in development)
- **CORS**: Validates `Origin` header against `CORS_ORIGIN`
- **Rate Limit**: Global limit of `RATE_LIMIT_MAX` requests per `RATE_LIMIT_WINDOW_MS` per IP
- **JSON parser**: Parses `application/json` body

### Stage 2 — Apollo Context Building

```js
// src/middlewares/auth-context.js
{
  userAgent: "Mozilla/5.0...",   // from req.headers['user-agent']
  ip: "127.0.0.1",              // from req.ip
  user: {                        // null if no token or invalid token
    id: "42",
    email: "user@example.com",
    role: "user",
    ua_hash: "abc123"
  },
  token: "eyJhbGci..."          // raw access token (forwarded to gRPC)
}
```

- Extracts `Authorization: Bearer <token>` header
- Verifies JWT with RS256 public key
- On failure: context.user = null (no error thrown — allows public queries)

### Stage 3 — Directive Checks

**@auth directive** — runs before the resolver:
- If `context.user` is null → throws `UNAUTHENTICATED` error
- Otherwise → passes through to resolver

**@rateLimit directive** — runs before the resolver:
- Tracks per-IP counters in an in-memory Map
- If limit exceeded → throws `RATE_LIMITED` error
- Otherwise → passes through to resolver

### Stage 4 — Resolver Execution

1. **Joi validation** — validates GraphQL arguments against schema
2. **Field mapping** — maps camelCase args → snake_case for gRPC
3. **gRPC call** — sends request to backend service with metadata
4. **Response mapping** — maps snake_case response → camelCase for GraphQL

### Stage 5 — Error Formatting

```
Apollo formatError hook:
  - Logs error (level: error) with message, code, path
  - Strips stacktrace in production
  - Returns formatted error to client
```

---

## Data Flow Examples

### Registration Flow

```
Client                    Gateway                     Auth Service
  │                         │                              │
  │  POST /graphql          │                              │
  │  mutation register(     │                              │
  │    email, username,     │                              │
  │    password)            │                              │
  │ ───────────────────────>│                              │
  │                         │  1. Validate with Joi        │
  │                         │  2. Map: password →          │
  │                         │     password_hash            │
  │                         │                              │
  │                         │  gRPC RegisterUser(          │
  │                         │    email, username,           │
  │                         │    password_hash)             │
  │                         │  metadata: user-agent         │
  │                         │ ────────────────────────────>│
  │                         │                              │
  │                         │  { success, user, tokens }   │
  │                         │ <────────────────────────────│
  │                         │                              │
  │                         │  3. Map: snake_case →        │
  │                         │     camelCase                │
  │                         │                              │
  │  { success, user,       │                              │
  │    tokens: {            │                              │
  │      accessToken,       │                              │
  │      refreshToken } }   │                              │
  │ <───────────────────────│                              │
```

### Authenticated Request Flow (e.g., `me` query)

```
Client                    Gateway                     User Service
  │                         │                              │
  │  POST /graphql          │                              │
  │  Authorization: Bearer  │                              │
  │    <access_token>       │                              │
  │  query { me { ... } }   │                              │
  │ ───────────────────────>│                              │
  │                         │  1. Verify JWT               │
  │                         │     → context.user.id        │
  │                         │  2. @auth check: PASS        │
  │                         │                              │
  │                         │  gRPC GetProfile(user_id)    │
  │                         │  metadata: user-agent         │
  │                         │ ────────────────────────────>│
  │                         │                              │
  │                         │  { success, profile }        │
  │                         │ <────────────────────────────│
  │                         │                              │
  │  { userId, username,    │                              │
  │    displayName,         │                              │
  │    avatarUrl }          │                              │
  │ <───────────────────────│                              │
```

### 2FA Login Flow

```
Client                    Gateway                     Auth Service
  │                         │                              │
  │  1. login(email, pass)  │  gRPC LoginUser(...)         │
  │ ───────────────────────>│ ────────────────────────────>│
  │                         │ <────────────────────────────│
  │  { requires2FA: true,   │                              │
  │    tokens: null }       │                              │
  │ <───────────────────────│                              │
  │                         │                              │
  │  2. verify2FA(code)     │  gRPC Verify2FA(             │
  │  Authorization: Bearer  │    code, access_token)       │
  │    <partial_token>      │ ────────────────────────────>│
  │ ───────────────────────>│                              │
  │                         │  { accessToken (acr=2fa),    │
  │                         │    refreshToken }            │
  │                         │ <────────────────────────────│
  │  { accessToken,         │                              │
  │    refreshToken }       │                              │
  │ <───────────────────────│                              │
```

---

## Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| No database | Gateway is a pure proxy — all state lives in backend services |
| No password hashing | Auth-service handles hashing; gateway sends plaintext over internal gRPC |
| Public key only | Gateway only verifies JWTs, never signs them |
| `keepCase: true` | Proto fields stay snake_case; resolvers handle mapping to camelCase |
| `user-agent` forwarding | Required by auth-service for session binding and trial abuse prevention |
| Insecure gRPC credentials | Services run on internal network; TLS added in production |

---

## File References

| Concern | File |
|---------|------|
| Express + Apollo setup | `src/app.js` |
| HTTP server startup | `src/server.js` |
| Environment config | `src/config/variables.config.js` |
| gRPC client singletons | `src/config/grpc-clients.js` |
| JWT context builder | `src/middlewares/auth-context.js` |
| Auth resolvers | `src/graphql/resolvers/auth.resolver.js` |
| User resolvers | `src/graphql/resolvers/user.resolver.js` |
| GraphQL schema | `src/graphql/typeDefs/schema.graphql` |
| Error formatter | `src/utils/error-formatter.js` |
| Logger | `src/utils/logger.js` |
