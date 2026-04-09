# Authentication & Token Flow

## Overview

The gateway handles JWT verification for incoming requests and forwards tokens to backend services. It uses **RS256 asymmetric signing** — the gateway only has the **public key** and can verify tokens but never sign them.

---

## JWT Verification

### Configuration

```
JWT_ACCESS_PUBLIC_KEY_PATH=./keys/access_public.pem
JWT_ACCESS_ALG=RS256
JWT_AUDIENCE=graphql-gateway
JWT_ISSUER=auth-service
```

### Verification Logic

**File:** `src/utils/jwt-verify.js`

```js
jwt.verify(token, publicKey, {
  algorithms: ['RS256'],
  audience: 'graphql-gateway',
  issuer: 'auth-service',
});
```

The verification checks:
1. **Signature** — token was signed by auth-service's private key
2. **Algorithm** — must be RS256 (prevents algorithm confusion attacks)
3. **Audience** — must be `graphql-gateway`
4. **Issuer** — must be `auth-service`
5. **Expiration** — `exp` claim must be in the future

### JWT Payload Structure

```json
{
  "sub": "42",
  "email": "user@example.com",
  "role": "user",
  "ua_hash": "a1b2c3d4",
  "aud": "graphql-gateway",
  "iss": "auth-service",
  "iat": 1709500000,
  "exp": 1709503600
}
```

---

## Context Building

**File:** `src/middlewares/auth-context.js`

Every request goes through context building, which extracts auth info and metadata:

```js
// Resulting context object:
{
  userAgent: "Mozilla/5.0...",   // forwarded to gRPC as metadata
  ip: "192.168.1.1",            // used for rate limiting
  user: {                        // null if unauthenticated
    id: "42",                    // from decoded.sub or decoded.id
    email: "user@example.com",
    role: "user",
    ua_hash: "a1b2c3d4"
  },
  token: "eyJhbGci..."          // raw token, forwarded to auth-service RPCs
}
```

### Important Behaviors

- **No token / invalid token**: `context.user = null`, `context.token = null` — no error thrown
- **Expired token**: Auto-refresh attempted via `refresh_token` cookie (see below)
- **Public queries** (e.g., `profile`): Work without any token
- **Protected fields** (`@auth`): Check `context.user !== null` before resolver runs

---

## Automatic Token Refresh

When the access token is expired but the client has a valid `refresh_token` httpOnly cookie, the gateway transparently refreshes the tokens without failing the request.

### How It Works

```
1. Client sends request with expired access token
   Header: Authorization: Bearer <expired_access_token>
   Cookie: refresh_token=<opaque_refresh_token>

2. Gateway detects TokenExpiredError (not invalid signature — those are rejected)

3. Gateway calls auth-service RefreshTokens RPC with the refresh token
   → auth-service validates the refresh token (revocation, expiry, session binding)
   → returns new { access_token, refresh_token }

4. Gateway verifies the new access token, sets context.user

5. Response includes:
   - Set-Cookie: refresh_token=<new_value>; HttpOnly; Secure; SameSite=Strict; Path=/
   - Body: extensions.newTokens.accessToken = "<new_access_token>"

6. Client reads new access token from extensions and stores it
```

### Decision Matrix

| Access Token | Refresh Cookie | Result |
| --- | --- | --- |
| Valid | Any | Authenticated (no refresh needed) |
| Expired | Present | Auto-refresh attempted |
| Expired | Missing | Unauthenticated (`user: null`) |
| Invalid (bad signature) | Any | Unauthenticated — no refresh attempt |
| Missing | Any | Unauthenticated |

### Cookie Configuration

| Option | Value | Purpose |
| --- | --- | --- |
| `httpOnly` | `true` | Not accessible via JavaScript (XSS protection) |
| `secure` | `true` in production | Only sent over HTTPS |
| `sameSite` | `strict` | CSRF protection |
| `path` | `/` | Sent on all routes |

### When the Cookie Is Set

The `refresh_token` cookie is set by the gateway on these mutations:

- `login` — initial authentication
- `register` — new account creation
- `oidcLogin` — OAuth/OIDC login
- `verify2FA` — 2FA completion (issues new token pair)
- `refreshTokens` — manual refresh (updates the cookie too)
- Auto-refresh — when the middleware refreshes transparently

### Response Extensions Format

When an auto-refresh occurs, the GraphQL response includes:

```json
{
  "data": { ... },
  "extensions": {
    "newTokens": {
      "accessToken": "eyJhbGciOiJSUzI1NiIs..."
    }
  }
}
```

The new refresh token is **not** in the response body — it's only in the `Set-Cookie` header (httpOnly, not readable by JS).

### Client-Side Integration

```js
// After every GraphQL request, check for refreshed tokens:
const result = await client.query({ query: MY_QUERY });

if (result.extensions?.newTokens?.accessToken) {
  // Store the new access token (memory, localStorage, etc.)
  setAccessToken(result.extensions.newTokens.accessToken);
}
// The refresh_token cookie is updated automatically by the browser
```

### Edge Cases

- **Refresh token revoked** (user logged out on another device): auto-refresh fails silently, request proceeds as unauthenticated. The `@auth` directive will return `UNAUTHENTICATED`.
- **Refresh token expired**: same as revoked — fails silently.
- **Auth-service unreachable**: auto-refresh fails, request proceeds as unauthenticated. Logged at `debug` level.
- **Race condition** (multiple parallel requests with expired token): each request independently calls `RefreshTokens`. Auth-service handles token rotation — only the last-issued refresh token is valid. The client should use the most recent `Set-Cookie` value (browsers handle this automatically).

---

## @auth Directive

**File:** `src/graphql/directives/auth.directive.js`

The `@auth` directive is applied to fields that require authentication:

```graphql
type Query {
  me: UserProfile @auth          # requires auth
  profile(userId: String!): UserProfile  # public
}

type Mutation {
  changePassword(...): MessagePayload! @auth
  setup2FA: Setup2FAPayload! @auth
  verify2FA(code: String!): Verify2FAPayload! @auth
  logout(refreshToken: String!): MessagePayload! @auth
  updateProfile(...): UpdateProfilePayload! @auth
}
```

When `context.user` is null, the directive throws:

```json
{
  "errors": [{
    "message": "Authentication required",
    "extensions": { "code": "UNAUTHENTICATED" }
  }]
}
```

---

## Token Flow

### Standard Login

```
1. Client → login(emailUsername, password)
   ← { success, user, tokens: { accessToken, refreshToken } }
   ← Set-Cookie: refresh_token=<value>; HttpOnly; Secure; SameSite=Strict; Path=/

2. Client stores accessToken (memory or secure storage)
   Browser stores refresh_token cookie automatically

3. Client → subsequent requests:
   Header: Authorization: Bearer <accessToken>
   Cookie: refresh_token=<value>  (sent automatically by browser)

4. Gateway verifies JWT → attaches user to context

5. When accessToken expires:
   Gateway auto-refreshes using refresh_token cookie
   ← Set-Cookie: refresh_token=<new_value>; ...
   ← extensions.newTokens.accessToken = "<new_access_token>"
   Client updates stored accessToken from extensions
```

### 2FA Login

```
1. Client → login(emailUsername, password)
   ← { requires2FA: true, tokens: null, user }

2. Client shows 2FA input form

3. Client → verify2FA(code)
   Header: Authorization: Bearer <partial_token>
   ← { accessToken (acr=2fa), refreshToken }

4. Client proceeds with full-access tokens
```

### Logout

```
1. Client → logout(refreshToken)
   Header: Authorization: Bearer <accessToken>
   ← { success: true, message: "Logged out" }

2. Auth-service invalidates the refresh token
3. Client clears stored tokens
```

---

## Token Forwarding

Some gRPC RPCs need the raw access token (not just the decoded claims). The gateway forwards `context.token` as a field in the gRPC request:

| gRPC RPC | Token Field | Purpose |
|----------|-------------|---------|
| `ChangePassword` | `access_token` | Identify authenticated user |
| `Setup2FA` | `access_token` | Identify authenticated user |
| `Verify2FA` | `access_token` | Upgrade token to acr=2fa |
| `UpdateProfile` | `access_token` | Identify authenticated user |

### user-agent Forwarding

Every gRPC call includes the client's `user-agent` as gRPC metadata. This is critical for:
- **Session binding** — auth-service ties sessions to device fingerprints
- **Trial abuse prevention** — detects multiple accounts from same device

```js
// src/grpc/clients/auth-client.js
const metadata = new grpc.Metadata();
metadata.set('user-agent', userAgent);
authClient.LoginUser(request, metadata, callback);
```

---

## Security Properties

| Property | Implementation |
|----------|---------------|
| Algorithm pinning | Only RS256 accepted (no `alg: none` or HMAC) |
| Audience validation | Token must be issued for `graphql-gateway` |
| Issuer validation | Token must come from `auth-service` |
| Expiration check | Built into `jsonwebtoken.verify()` |
| No signing capability | Gateway only has the public key |
| Graceful degradation | Invalid tokens don't crash — just set `user: null` |
| Stacktrace stripping | Removed from errors in production |
