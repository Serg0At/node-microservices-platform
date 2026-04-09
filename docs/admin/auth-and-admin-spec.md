# Auth, Authorization & Admin — Cross-Service Specification

## 1. Overview

This document specifies how authentication, authorization, role-based access control, and admin separation work across the entire microservices-arbex platform — covering the GraphQL gateway, backend gRPC services, and the Next.js frontend.

### Roles

| Value | Role | Access |
|-------|------|--------|
| `0` | User | Public content + own dashboard (articles, profile, settings) |
| `1` | Admin | Everything a user can + admin panel (moderation, categories, stats, audit log) |

Role is stored in the `users` table (PostgreSQL, managed by auth-service) and embedded in the JWT access token payload.

---

## 2. JWT Token Architecture

### 2.1 Access Token (issued by auth-service)

- **Algorithm**: RS256 (asymmetric — private key signs, public key verifies)
- **TTL**: 15 minutes
- **Payload**:
  ```json
  {
    "id": "user_id",
    "email": "user@example.com",
    "role": 0,
    "ua_hash": "sha256(user-agent)",
    "iat": 1234567890,
    "exp": 1234568790,
    "iss": "auth-service",
    "aud": "graphql-gateway"
  }
  ```
- **Role field**: Integer (`0` or `1`). Checked at multiple layers for authorization decisions.

### 2.2 Refresh Token

- **Type**: Opaque (random `crypto.randomBytes(32).toString('hex')`) — NOT a JWT
- **Storage**: Redis with 30-day TTL
- **Key pattern**: `refresh_token:{token}` → `{ user_id, device: uaHash }`
- **Rotation**: Old token deleted on each refresh (one-time use)
- **Device binding**: User-agent hash must match on refresh

### 2.3 Token Flow Summary

```
auth-service issues tokens
        │
        ├── Access token (JWT, 15min) → sent in response body
        └── Refresh token (opaque, 30d) → set as httpOnly cookie
```

---

## 3. Who Verifies What — Layered Security

Three independent systems check authorization. Each has a different purpose:

```
Browser → Next.js Server → GraphQL Gateway → gRPC Services
             ①                  ②                  ③
```

### Layer ① — Next.js (Route Protection)

- **What it does**: Reads the access token from JS memory, decodes the payload (base64 parse — no cryptographic verification), checks `role` to decide routing
- **Purpose**: UX — controls which pages the user can navigate to
- **Security level**: Low — can be bypassed by tampering with the token payload, but that's fine because layers ② and ③ catch it
- **Why no full verification**: Next.js doesn't have (and shouldn't have) the auth-service's public key. Its job is routing, not security.

### Layer ② — GraphQL Gateway (API Security Boundary)

- **What it does**: Full RS256 signature verification using auth-service's public key. Validates `iss`, `aud`, `exp`. Extracts `role` into `context.user.role`. Enforces `@requireRole` directive on protected operations.
- **Purpose**: The **real** security boundary. Rejects unauthorized API calls regardless of how they arrive (browser, Postman, curl, scripts).
- **Security level**: High — cryptographic verification, cannot be bypassed.

### Layer ③ — gRPC Services (Defense-in-Depth)

- **What it does**: Each service independently verifies the JWT (has its own copy of the public key) and checks `decoded.role` for admin operations.
- **Purpose**: Safety net — if the gateway is misconfigured or bypassed (e.g., another internal service calls gRPC directly), services still enforce authorization.
- **Security level**: High — independent verification.

### Analogy

| Layer | Real-world equivalent |
|-------|----------------------|
| Next.js | Receptionist who checks your badge and points you to the right floor |
| Gateway | Locked door that only opens with a verified keycard |
| gRPC Service | Vault inside the room that checks your keycard again |

---

## 4. Backend — RBAC in GraphQL Gateway

### 4.1 New `@requireRole` Directive

**File**: `graphql-gateway/src/graphql/directives/require-role.directive.js`

Follows the same pattern as the existing `auth.directive.js` (uses `mapSchema` + `getDirective` from `@graphql-tools/utils`).

**Behavior**:
1. Check `context.user` exists → if not, throw `UNAUTHENTICATED`
2. Check `context.user.role >= requiredRole` → if not, throw `FORBIDDEN`
3. `@requireRole(role: ADMIN)` subsumes `@auth` — no need to use both on the same field

**Schema additions**:
```graphql
enum Role {
  USER
  ADMIN
}

directive @requireRole(role: Role!) on FIELD_DEFINITION
```

**Registration** in `app.js`: Add `requireRoleDirectiveTransformer` after the existing `authDirectiveTransformer`.

### 4.2 Operation Authorization Matrix

| Operation | Directive | Who can access |
|-----------|-----------|---------------|
| **Queries — Public** | | |
| `articles` | _(none)_ | Everyone (including unauthenticated) |
| `article(id/slug)` | _(none)_ | Everyone |
| `searchArticles` | _(none)_ | Everyone |
| `categories` | _(none)_ | Everyone |
| **Queries — Authenticated** | | |
| `me` | `@auth` | Any logged-in user |
| **Queries — Admin** | | |
| `adminArticles` | `@requireRole(role: ADMIN)` | Admin only — returns all statuses |
| `dashboardStats` | `@requireRole(role: ADMIN)` | Admin only |
| `auditLog` | `@requireRole(role: ADMIN)` | Admin only |
| **Mutations — Authenticated** | | |
| `createArticle` | `@auth` | Any logged-in user |
| `updateArticle` | `@auth` | Author OR admin (ownership check in service) |
| `deleteArticle` | `@auth` | Author OR admin (ownership check in service) |
| `updateProfile` | `@auth` | Own profile only (checked in service) |
| `getUploadUrl` | `@auth` | Any logged-in user |
| `setup2FA` / `verify2FA` | `@auth` | Own account only |
| **Mutations — Admin** | | |
| `createCategory` | `@requireRole(role: ADMIN)` | Admin only |
| `updateCategory` | `@requireRole(role: ADMIN)` | Admin only |
| `deleteCategory` | `@requireRole(role: ADMIN)` | Admin only |
| `banUser` | `@requireRole(role: ADMIN)` | Admin only |
| `unbanUser` | `@requireRole(role: ADMIN)` | Admin only |
| `adminCreateArticle` | `@requireRole(role: ADMIN)` | Admin only |
| `adminDeleteArticle` | `@requireRole(role: ADMIN)` | Admin only |
| `adminSendNotification` | `@requireRole(role: ADMIN)` | Admin only |
| `adminSendBulkNotification` | `@requireRole(role: ADMIN)` | Admin only |

### 4.3 Defense-in-Depth

Existing service-level role checks (e.g., `decoded.role !== 1` in `category.service.js`) remain as a safety net. The gateway is the primary enforcement; services are the backup.

---

## 5. Backend — Rate Limiting Per Role

### 5.1 Current State

- Express-level: `express-rate-limit` at 100 req/60s per IP (in-memory store)
- GraphQL-level: `@rateLimit` directive on auth mutations (login: 10/1m, register: 5/1m, etc.)
- Neither is role-aware. Both key by IP only.

### 5.2 Proposed Tier Structure

| Tier | Key | Global Limit | Mutation Limit |
|------|-----|-------------|----------------|
| Unauthenticated | IP address | 60 req/min | Per-field (existing `@rateLimit`) |
| User (role=0) | User ID | 200 req/min | 30 mutations/min |
| Admin (role=1) | User ID | 500 req/min | 100 mutations/min |

### 5.3 Implementation

**Replace** `express-rate-limit` (in-memory) **with** `rate-limiter-flexible` (Redis-backed):
- Redis store enables rate limiting across multiple gateway instances
- New middleware: `graphql-gateway/src/middlewares/role-rate-limit.js`

**Key generation logic**:
1. Read `Authorization` header
2. If Bearer token present → lightweight JWT decode (parse payload, no signature check) → extract `role` and `id`
3. Key = `rl:user:{id}` for authenticated, `rl:ip:{ip}` for unauthenticated
4. Select limit tier based on role

**Update `@rateLimit` directive** to:
- Key by `userId` (not IP) when authenticated
- Apply a 3x multiplier for admin role
- Fall back to IP for unauthenticated requests

### 5.4 Per-Operation Limits

| Operation | Unauth | User | Admin |
|-----------|--------|------|-------|
| `register` | 5/min | — | — |
| `login` | 10/min | — | — |
| `forgotPassword` | 3/min | 3/min | 10/min |
| `createArticle` | — | 10/min | 50/min |
| `updateArticle` | — | 20/min | 100/min |
| `getUploadUrl` | — | 15/min | 50/min |
| `searchArticles` | 20/min | 30/min | 100/min |

---

## 6. Backend — Audit Logging

### 6.1 What to Log

**Admin actions** (always log):
- Category CRUD (`category.create`, `category.update`, `category.delete`)
- Article moderation — admin editing/deleting another user's article (`article.moderate.update`, `article.moderate.delete`)
- User management (`user.ban`, `user.unban`, `user.role.update`)
- Audit log access itself (`audit.view`)

**Sensitive user actions** (log for security):
- Login success/failure (`auth.login.success`, `auth.login.failure`)
- Password changes (`auth.password.change`)
- 2FA setup/verification (`auth.2fa.setup`, `auth.2fa.verify`)

### 6.2 Storage — Structured JSON Logs (Winston)

Same approach as all other services — Winston structured JSON logs designed for Filebeat ingestion into centralized logging (ELK stack). No dedicated database table.

Each service logs its own audit events via its existing Winston logger instance. The gateway logs gateway-level actions; backend services log service-level actions.

### 6.3 Log Format

```json
{
  "level": "info",
  "type": "audit",
  "action": "category.create",
  "actor_id": "123",
  "actor_email": "admin@example.com",
  "actor_role": 1,
  "resource_type": "category",
  "resource_id": "456",
  "resource_title": "Crypto News",
  "ip_address": "192.168.1.1",
  "user_agent": "Mozilla/5.0...",
  "timestamp": "2026-03-21T10:30:00.000Z",
  "service": "graphql-gateway"
}
```

The `type: "audit"` field distinguishes audit entries from regular application logs, making them filterable in Kibana/ELK.

### 6.4 Where Each Service Logs

**GraphQL Gateway** — logs at the resolver level, right after a successful gRPC call:

- Category mutations: `category.create`, `category.update`, `category.delete`
- Article moderation: `article.moderate.delete` (admin deleting another user's article)
- Auth events: `auth.login.success`, `auth.login.failure`

**Auth Service** — logs in its own service layer:

- `auth.password.change`
- `auth.2fa.setup`, `auth.2fa.verify`
- `auth.register`

**News Service** — already logs admin actions via Winston (article create/delete with `action`, `admin_id`, `article_id`, `title`). Extend to include category operations.

### 6.5 Centralized Viewing

Audit logs are queried through the ELK stack (Kibana), not through a GraphQL query. Filter by `type: "audit"` and optionally by `action`, `actor_id`, or `service`.

---

## 7. Ban System — Cross-Service Implementation

### 7.1 Overview

Banning spans two services:

- **Admin service** — exposes `BanUser`/`UnbanUser` gRPC RPCs, writes `banned_at` and `ban_reason` to the `users` table
- **Auth service** — enforces ban checks during login and token refresh, preventing banned users from authenticating

### 7.2 Database Schema

Columns on the `users` table (owned by auth-service, defined in `auth-service/migrations/create_tables.js`):

| Column | Type | Description |
|--------|------|-------------|
| `banned_at` | `TIMESTAMPTZ` | Null = not banned, non-null = banned at this timestamp |
| `ban_reason` | `TEXT` | Optional reason provided by admin |

### 7.3 Admin Service — Ban/Unban RPCs

| RPC | Request | Response | Rules |
|-----|---------|----------|-------|
| `BanUser` | `access_token, user_id, reason` | `success, message` | Cannot ban self, cannot ban admins, user must not already be banned |
| `UnbanUser` | `access_token, user_id` | `success, message` | User must be currently banned |

Both RPCs require admin role (`role=1`) and produce audit log entries.

### 7.4 Auth Service — Ban Enforcement

**Login flow** (`AuthService.login`): After password validation, checks `user.banned_at`. If non-null, throws `Forbidden` error with message "Account has been banned".

**Token refresh flow** (`AuthService.refreshTokens`): After loading user from DB, checks `user.banned_at`. If non-null, revokes the refresh token and throws `Forbidden`. This ensures a banned user's existing session is terminated on the next token rotation.

### 7.5 Gateway — GraphQL Mutations

```graphql
banUser(userId: String!, reason: String): MessagePayload! @requireRole(role: ADMIN)
unbanUser(userId: String!): MessagePayload! @requireRole(role: ADMIN)
```

### 7.6 User Listing — Ban Status Filter

The `ListUsers` RPC accepts a `status` parameter:
- `-1` = all users
- `0` = active (not banned)
- `1` = banned

The `UserRecord` message includes `banned_at` and `ban_reason` fields.

---

## 8. Frontend — Next.js Route Protection

### 7.1 Token Storage Strategy

**Access token**: Stored in JavaScript memory (React context/state variable)
- Lost on page refresh → triggers silent refresh
- Never stored in localStorage or sessionStorage
- Sent as `Authorization: Bearer <token>` header directly to the GraphQL gateway

**Refresh token**: httpOnly cookie (already set by the gateway)
- Browser sends it automatically to the gateway's `/refresh` endpoint
- On success → new access token returned in response body → stored in memory again
- SameSite=Strict, Secure (in production), httpOnly

```
Page load → no access token in memory
         → call gateway refresh endpoint (cookie sent automatically)
         → receive new access token → store in memory
         → ready to make authenticated requests

Token expires (15min) → same silent refresh flow
```

### 7.2 Auth Context

React context provider wraps the app, exposes:
- `user` — decoded token payload (`{ id, email, role }`) or `null`
- `accessToken` — the raw JWT string (in memory) or `null`
- `isAuthenticated` — boolean
- `isAdmin` — boolean (`user?.role === 1`)
- `login(email, password)` — calls gateway, stores token in memory
- `logout()` — clears memory, calls gateway to invalidate refresh token
- `silentRefresh()` — uses httpOnly cookie to get a new access token

### 7.3 Route Access Rules

| Route | No token (guest) | Token, role=0 (user) | Token, role=1 (admin) |
|-------|:-:|:-:|:-:|
| `/` (landing) | ✅ | ✅ | ✅ |
| `/articles`, `/articles/[slug]` | ✅ | ✅ | ✅ |
| `/search`, `/categories/[slug]` | ✅ | ✅ | ✅ |
| `/login`, `/register` | ✅ | → redirect `/dashboard` | → redirect `/dashboard` |
| `/dashboard` | → redirect `/login` | ✅ | ✅ |
| `/dashboard/articles/new` | → redirect `/login` | ✅ | ✅ |
| `/dashboard/profile` | → redirect `/login` | ✅ | ✅ |
| `/dashboard/settings` | → redirect `/login` | ✅ | ✅ |
| `/admin` | → redirect `/login` | → redirect `/dashboard` | ✅ |
| `/admin/articles` | → redirect `/login` | → redirect `/dashboard` | ✅ |
| `/admin/categories` | → redirect `/login` | → redirect `/dashboard` | ✅ |
| `/admin/audit-log` | → redirect `/login` | → redirect `/dashboard` | ✅ |

### 7.4 Next.js Middleware (Edge Middleware)

**File**: `frontend/src/middleware.ts`

Runs on every request at the edge, before the page renders. Handles route protection based on the token in memory (passed via a cookie or header for SSR context).

**Logic**:
```
1. Read access token (if available — e.g., from a lightweight non-httpOnly cookie
   that mirrors the token's presence, or from a session cookie set by the app)

2. Decode payload (base64 parse only — NO cryptographic verification)
   → Extract: { role, exp }

3. Route matching:
   - Path starts with /admin/*:
       → No token or role !== 1 → redirect to /dashboard (if has token) or /login (if no token)
   - Path starts with /dashboard/*:
       → No token → redirect to /login
   - Path is /login or /register:
       → Has valid token → redirect to /dashboard

4. If token is expired:
   → Allow the request through — the client-side auth context will handle
     silent refresh. Don't block page loads for expired tokens.
```

**Important**: This middleware does NOT verify the JWT signature. It only reads the payload for routing decisions. A tampered token with `role: 1` would pass this layer but fail at the gateway when any actual API call is made.

### 7.5 Client-Side Route Guards

For client-side navigation (SPA transitions that don't hit the middleware), use wrapper components:

**`RequireAuth`** — wraps authenticated routes:
- Reads `isAuthenticated` from auth context
- If false → redirect to `/login`
- If true → render children

**`RequireAdmin`** — wraps admin routes:
- Reads `isAdmin` from auth context
- If false → redirect to `/dashboard`
- If true → render children

**Applied in layouts**:
- `(dashboard)/layout.tsx` uses `RequireAuth`
- `(admin)/layout.tsx` uses `RequireAdmin`

### 7.6 Navigation Visibility

The navigation bar conditionally renders links based on role:

| Nav element | Guest | User (role=0) | Admin (role=1) |
|-------------|:-----:|:---:|:---:|
| Home / Articles / Search | ✅ | ✅ | ✅ |
| Login / Register buttons | ✅ | ❌ | ❌ |
| Dashboard link | ❌ | ✅ | ✅ |
| Admin Panel link | ❌ | ❌ | ✅ |
| User avatar / dropdown | ❌ | ✅ | ✅ |

This is a **cosmetic** layer — hiding the link doesn't prevent access. The middleware and gateway enforce the real restrictions.

### 7.7 Route Groups (Next.js App Router)

```
src/app/
├── (public)/               # No auth required
│   ├── layout.tsx           # Public layout (nav with login buttons)
│   ├── page.tsx             # Landing page
│   ├── articles/
│   └── search/
│
├── (auth)/                  # Auth pages (login, register)
│   ├── layout.tsx           # Minimal centered layout
│   ├── login/page.tsx
│   └── register/page.tsx
│
├── (dashboard)/             # Requires authentication (any role)
│   ├── layout.tsx           # Dashboard layout + RequireAuth wrapper
│   ├── dashboard/page.tsx
│   ├── articles/
│   ├── profile/
│   └── settings/
│
├── (admin)/                 # Requires role=1
│   ├── layout.tsx           # Admin layout + RequireAdmin wrapper
│   └── admin/
│       ├── page.tsx         # Admin dashboard (stats)
│       ├── articles/        # Article moderation
│       ├── categories/      # Category CRUD
│       └── audit-log/       # Audit log viewer
│
└── middleware.ts             # Edge middleware for route protection
```

### 7.8 GraphQL Client Setup

- Apollo Client (or urql) configured with an `authLink` that reads the access token from the auth context and sets the `Authorization: Bearer` header
- Requests go **directly** to the GraphQL gateway (no BFF proxy — since token is in memory, not in a cookie)
- `credentials: 'include'` to send the refresh token cookie
- Error link handles `UNAUTHENTICATED` errors → triggers silent refresh → retries the failed request

---

## 8. Security Summary

### 8.1 Protection Layers

| Threat | Mitigation |
|--------|-----------|
| XSS steals access token | Token in JS memory — shorter attack window (15min TTL). Refresh token is httpOnly (untouchable by JS). React auto-escapes output. CSP headers. |
| XSS steals refresh token | httpOnly cookie — JavaScript cannot access it |
| CSRF | SameSite=Strict on refresh cookie. Access token sent as header (not cookie) — CSRF cannot forge custom headers. No BFF = no cookie-based auth for mutations. |
| Token tampering (fake role=1) | Gateway verifies RS256 signature — tampered tokens rejected. Next.js routing bypass is cosmetic only. |
| Brute force | Rate limiting per IP (unauth) and per user ID (auth). Separate limits per operation. |
| Admin action accountability | Audit events logged as structured JSON via Winston (`type: "audit"`). Aggregated via Filebeat into ELK for centralized viewing in Kibana. |
| Direct API access (bypassing frontend) | Gateway `@requireRole` directive enforces authorization regardless of client. Service-level checks as backup. |
| Stolen refresh token | Device-bound (user-agent hash must match). Token rotation (one-time use). Max 5 devices per user. |

### 8.2 Input Security

- **GraphQL gateway**: Joi validation schemas on all inputs
- **Database**: Knex parameterized queries (SQL injection prevention)
- **File uploads**: Content-type validation in `getUploadUrl`, client-side file type/size validation
- **Article HTML content**: Sanitize with DOMPurify on the frontend before rendering (if content contains HTML)
- **CSP headers**: Configure in `next.config.js` via `headers()` — restrict script sources, disable inline scripts

---

## 9. Implementation Sequence

### Phase 1: Gateway RBAC Directive
1. Create `require-role.directive.js` following `auth.directive.js` pattern
2. Add `Role` enum and `@requireRole` directive to schema
3. Annotate admin operations with `@requireRole(role: ADMIN)`
4. Register transformer in `app.js`
5. Test: role=0 gets `FORBIDDEN` on admin ops, role=1 succeeds

### Phase 2: Rate Limiting Upgrade
1. Install `rate-limiter-flexible`, configure Redis store
2. Create `role-rate-limit.js` middleware
3. Replace express-rate-limit with role-aware version
4. Update `@rateLimit` directive for per-user keying and role multipliers
5. Test each tier

### Phase 3: Audit Logging
1. Create a shared audit logger utility (Winston, `type: "audit"` field)
2. Add audit log calls in gateway resolvers for admin operations (category CRUD, article moderation)
3. Extend existing Winston audit logging in news-service for category operations
4. Add audit log calls in auth-service for sensitive actions (password change, 2FA)
5. Configure Filebeat to ingest audit logs and filter by `type: "audit"`
6. Test: perform admin actions, verify structured JSON entries appear in logs

### Phase 4: Next.js Foundation
1. Initialize Next.js project (TypeScript, Tailwind, App Router)
2. Set up Apollo Client with auth link
3. Build auth context provider (token in memory, silent refresh)
4. Create `middleware.ts` for route protection
5. Build auth pages (login, register)

### Phase 5: Public & Dashboard Pages
1. Public layout + landing page + article pages + search
2. Dashboard layout with `RequireAuth` wrapper
3. User article management, profile, settings pages

### Phase 6: Admin Panel
1. Admin layout with `RequireAdmin` wrapper
2. Admin dashboard with stats
3. Article moderation table
4. Category management
5. Audit log viewer

### Phase 7: Security Hardening
1. Configure CSP headers
2. Add DOMPurify for article content rendering
3. Review all cookie settings
4. Test all three protection layers (middleware, client guard, gateway directive)

---

## 10. Bulk Notifications — Current State & Future Plan

### Current approach

`AdminSendBulkNotification` accepts an optional `recipients` list. If omitted, admin-service queries all active non-banned users from the DB. It then sends individual gRPC calls to notification-service's `SendNotification` RPC in batches of 50 (`Promise.allSettled`). Each call creates a notification record and sends an email via SMTP.

- Works reliably up to ~500 recipients
- Beyond that, the gateway→admin-service gRPC call risks timing out
- No per-recipient retry, no progress visibility, no cancellation

### Future: queue-based architecture

Replace the synchronous batch loop with RabbitMQ:

1. Admin calls `AdminSendBulkNotification` → admin-service creates a `bulk_job` record (status: `pending`) and publishes the job to a RabbitMQ queue → returns `job_id` immediately
2. Notification-service worker consumes the job, sends one email per recipient with retry (3 attempts, exponential backoff), updates job progress in DB
3. Admin panel polls `GetBulkJobStatus` RPC for progress (sent/failed/total, progress bar)

**New infrastructure**: RabbitMQ queue for bulk jobs, `bulk_jobs` table in admin-service DB, worker process in notification-service, `GetBulkJobStatus` RPC.

---

## 11. Key Files Reference

| File | Service | Role in auth/admin |
|------|---------|-------------------|
| `auth-service/src/services/auth.service.js` | Auth | Issues JWTs with `role` in payload |
| `auth-service/src/utils/jwt.util.js` | Auth | Signs tokens with RS256 private key |
| `graphql-gateway/src/middlewares/auth-context.js` | Gateway | Verifies JWT, builds `context.user` with role |
| `graphql-gateway/src/graphql/directives/auth.directive.js` | Gateway | `@auth` directive (pattern for `@requireRole`) |
| `graphql-gateway/src/graphql/typeDefs/schema.graphql` | Gateway | Schema — add `@requireRole` annotations here |
| `graphql-gateway/src/app.js` | Gateway | Register directive transformers, plugins, rate limiter |
| `news-service/src/services/category.service.js` | News | Service-level `role !== 1` checks (defense-in-depth) |
| `admin-service/src/services/admin.service.js` | Admin | Ban/unban users, role updates, dashboard stats, article/notification proxying |
| `admin-service/proto/admin.proto` | Admin | All admin RPCs (user mgmt, articles, notifications) |
| `admin-service/src/grpc/clients/news-client.js` | Admin | gRPC client to news-service (create/delete articles) |
| `admin-service/src/grpc/clients/notification-client.js` | Admin | gRPC client to notification-service (send notifications) |
| `news-service/src/services/article.service.js` | News | Author-or-admin ownership checks |
| `news-service/src/utils/jwt.util.js` | News | Independent JWT verification (public key) |
| `frontend/src/middleware.ts` | Frontend | Edge middleware for route protection |
| `frontend/src/lib/auth/context.tsx` | Frontend | Auth context (token in memory, role state) |
