# GraphQL Gateway — Project Guide

## Overview
Apollo Server v4 GraphQL gateway (Node.js, ES modules). Single entry point for all client applications. Proxies requests to backend gRPC microservices.

## Tech Stack
- **Framework**: Apollo Server v4 (`@apollo/server`) with Express v4 middleware
- **Transport to backends**: gRPC (`@grpc/grpc-js`, `@grpc/proto-loader`)
- **Auth**: RS256 JWT verification (public key only — no signing). Access tokens issued by auth-service.
- **Validation**: Joi for input validation on resolvers
- **Logging**: Winston
- **Rate Limiting**: `express-rate-limit` or `graphql-rate-limit-directive`

## Architecture

```
Client (web/mobile)
      │
      ▼  HTTP POST /graphql
┌─────────────────────────┐
│    GraphQL Gateway       │
│  ┌───────────────────┐  │
│  │  Apollo Server v4  │  │
│  │  ┌─────────────┐  │  │
│  │  │  Resolvers   │  │  │
│  │  └──────┬───────┘  │  │
│  │         │          │  │
│  │  ┌──────▼───────┐  │  │
│  │  │ gRPC Clients │  │  │
│  │  └──────┬───────┘  │  │
│  └─────────┼──────────┘  │
└────────────┼─────────────┘
             │ gRPC
     ┌───────┴───────┐
     ▼               ▼
auth-service    user-service
 :50051          :50052
```

## Project Structure
```
src/
├── config/         # variables.config.js (env vars), grpc-clients.js
├── graphql/
│   ├── typeDefs/   # GraphQL schema (.graphql or template literals)
│   ├── resolvers/  # Resolver functions (auth.resolver.js, user.resolver.js)
│   └── directives/ # Custom directives (@auth, @rateLimit)
├── grpc/
│   ├── clients/    # gRPC client wrappers (auth-client.js, user-client.js)
│   └── protos/     # Symlinks or copies of .proto files
├── middlewares/    # Express middleware (cors, helmet, auth context)
├── utils/          # jwt-verify, error-formatter, logger
└── app.js          # Entry point — boots Express + Apollo Server
```

## gRPC Backend Services

### Admin Service (proto/admin.proto — port 50055)
RPCs:
- `GetDashboardStats(access_token)` → `{ success, total_users, total_articles, ... }`
- `ListUsers(access_token, page, limit, search, role, status)` → `{ success, users, pagination }`
- `GetUser(access_token, user_id)` → `{ success, user }`
- `UpdateUserRole(access_token, user_id, role)` → `{ success, message, user }`
- `BanUser(access_token, user_id, reason)` → `{ success, message }`
- `UnbanUser(access_token, user_id)` → `{ success, message }`
- `CreateArticle(access_token, title, content, type, cover_image_url)` → `{ success, article }`
- `DeleteArticle(access_token, article_id)` → `{ success, message }`
- `AdminSendNotification(access_token, user_id, email, subject, body, channel)` → `{ success, message, notification_id }`
- `AdminSendBulkNotification(access_token, subject, body, channel, recipients[])` → `{ success, message, total, sent, failed }`

All admin RPCs require `@requireRole(role: ADMIN)` directive in the schema. Token is forwarded from context.

### Auth Service (proto/auth.proto — port 50051)
RPCs:
- `RegisterUser(email, username, password_hash)` → `{ success, user, tokens }`
- `LoginUser(email_username, password_hash)` → `{ success, user, tokens, requires_2fa }`
- `OIDCLogin(code, provider, state)` → `{ success, user, id_token, tokens }`
- `ForgotPassword(email)` → `{ success, message }`
- `VerifyResetCode(email, code)` → `{ success, message }`
- `ResetPassword(email, code, new_pass)` → `{ success, message }`
- `ChangePassword(old_pass, new_pass, access_token)` → `{ success, message }`
- `Setup2FA(access_token)` → `{ success, qr_code, secret, backup_codes }`
- `Verify2FA(code, access_token)` → `{ success, message, access_token, refresh_token }`
- `VerifyEmail(token)` → `{ success, message }`
- `RefreshTokens(refresh_token)` → `{ access_token, refresh_token }`
- `Logout(refresh_token)` → `{ success, message }`

Metadata: `user-agent` header is forwarded as gRPC metadata (used for session binding).

### User Service (proto/user.proto — port 50052)
RPCs:
- `GetProfile(user_id)` → `{ success, profile }`
- `UpdateProfile(access_token, username, display_name, avatar_url)` → `{ success, message, profile }`

Profile fields: `user_id`, `username`, `display_name`, `avatar_url`

## Key Patterns

### Authentication Context
- Extract `Authorization: Bearer <token>` from incoming HTTP request
- Verify JWT with RS256 public key (same key pair as auth-service)
- Attach decoded user to Apollo context: `{ user: { id, email, role, ua_hash } }`
- Resolvers check `context.user` for authenticated operations

### gRPC Client Pattern
- Load proto once at startup with `@grpc/proto-loader` (`keepCase: true`)
- Create client stubs as singletons
- Wrap each RPC call in a Promise (gRPC uses callbacks)
- Forward `user-agent` from HTTP request as gRPC metadata
- Forward `access_token` from context where needed (ChangePassword, Setup2FA, etc.)

### Error Handling
- gRPC errors (status codes) → map to GraphQL errors with appropriate extensions
- `UNAUTHENTICATED` (16) → `AuthenticationError`
- `NOT_FOUND` (5) → `UserInputError` or custom
- `ALREADY_EXISTS` (6) → `ConflictError`
- `INVALID_ARGUMENT` (3) → `UserInputError`
- Format errors in Apollo's `formatError` to strip internal details in production

### Token Flow
1. Client calls `login`/`register` mutation → gets `access_token` + `refresh_token`
2. Client sends `Authorization: Bearer <access_token>` on subsequent requests
3. Gateway verifies JWT, attaches user to context
4. When access token expires, client calls `refreshTokens` mutation with refresh token
5. 2FA flow: login returns `requires_2fa: true` → client calls `verify2FA` with code

### Refresh Token Handling
- Refresh tokens are opaque strings (NOT JWTs) — gateway cannot verify them
- Gateway just forwards them to auth-service's `RefreshTokens` RPC
- Client stores refresh token securely (httpOnly cookie or secure storage)

## GraphQL Schema Design

### Mutations (auth)
- `register(email, username, password)` → `AuthPayload`
- `login(emailUsername, password)` → `AuthPayload` (includes `requires2FA` flag)
- `oidcLogin(code, provider, state)` → `OIDCPayload`
- `forgotPassword(email)` → `MessagePayload`
- `verifyResetCode(email, code)` → `MessagePayload`
- `resetPassword(email, code, newPassword)` → `MessagePayload`
- `changePassword(oldPassword, newPassword)` → `MessagePayload` (auth required)
- `setup2FA` → `Setup2FAPayload` (auth required)
- `verify2FA(code)` → `Verify2FAPayload` (auth required)
- `verifyEmail(token)` → `MessagePayload`
- `refreshTokens(refreshToken)` → `TokenPayload`
- `logout(refreshToken)` → `MessagePayload` (auth required)

### Queries (user)
- `me` → `UserProfile` (auth required — uses context.user.id)
- `profile(userId)` → `UserProfile`

### Mutations (user)
- `updateProfile(username, displayName, avatarUrl)` → `UpdateProfilePayload` (auth required)

### Queries (admin — `@requireRole(role: ADMIN)`)

- `dashboardStats` → `DashboardStatsPayload`
- `adminUsers(page, limit, search, role, status)` → `AdminUserListPayload`
- `adminUser(userId)` → `AdminUserPayload`

### Mutations (admin — `@requireRole(role: ADMIN)`)

- `updateUserRole(userId, role)` → `AdminUserUpdatePayload`
- `banUser(userId, reason)` → `MessagePayload`
- `unbanUser(userId)` → `MessagePayload`
- `adminCreateArticle(title, content, type, coverImageUrl)` → `AdminArticlePayload` (proxied to news-service via admin-service)
- `adminDeleteArticle(articleId)` → `MessagePayload` (proxied to news-service via admin-service)
- `adminSendNotification(userId, email, subject, body, channel)` → `AdminSendNotificationPayload` (proxied to notification-service via admin-service)
- `adminSendBulkNotification(subject, body, channel, recipients)` → `AdminSendBulkNotificationPayload` (fan-out via admin-service)

## Important Notes
- Gateway does NOT have a database — it's purely a proxy/orchestrator
- Gateway does NOT connect to Redis or RabbitMQ
- Gateway only has the JWT **public key** — it verifies tokens but never signs them
- Proto files should match exactly with backend services (copy or symlink)
- `keepCase: true` in proto-loader — field names match proto (snake_case), not camelCase
- The gateway is the `audience` in JWT claims (`graphql-gateway`)
- Password hashing happens in auth-service, NOT in the gateway — gateway sends plaintext passwords over gRPC (internal network, TLS in production)
- gRPC metadata `user-agent` must be forwarded on every call for session binding

## Environment Variables
```
SERVICE_PORT=4000
SERVICE_ENV=development

# gRPC backends
AUTH_SERVICE_URL=localhost:50051
USER_SERVICE_URL=localhost:50052

# JWT verification (public key only)
JWT_ACCESS_PUBLIC_KEY_PATH=./keys/access_public.pem
JWT_ACCESS_ALG=RS256
JWT_AUDIENCE=graphql-gateway
JWT_ISSUER=auth-service

# Rate limiting
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX=100

# CORS
CORS_ORIGIN=http://localhost:3000
```
