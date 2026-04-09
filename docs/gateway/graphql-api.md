# GraphQL API Reference

## Endpoint

```
POST http://localhost:4000/graphql
Content-Type: application/json
```

**Schema file:** `src/graphql/typeDefs/schema.graphql`

---

## Types

### User

```graphql
type User {
  id: String!
  email: String!
  username: String!
  externalId: String       # e.g. "google_123", "github_55"
  provider: String         # "google", "github", or null
  subscription: SubscriptionInfo
}
```

### SubscriptionInfo

```graphql
type SubscriptionInfo {
  id: String
  type: String             # "free", "pro", "premium"
  status: String           # "active", "expired"
  expiresAt: String
}
```

### Tokens

```graphql
type Tokens {
  accessToken: String!     # RS256 JWT
  refreshToken: String!    # Opaque hex string
  tokenType: String        # "Bearer"
  expiresIn: Int           # Seconds (e.g. 3600)
}
```

### UserProfile

```graphql
type UserProfile {
  userId: String!
  username: String!
  displayName: String
  avatarUrl: String
}
```

---

## Queries

### me

Returns the authenticated user's profile.

```graphql
query {
  me {
    userId
    username
    displayName
    avatarUrl
  }
}
```

**Auth required:** Yes (`@auth`)
**Backend RPC:** `UserService.GetProfile(user_id)` — `user_id` taken from JWT claims

**Headers:**
```
Authorization: Bearer <access_token>
```

---

### profile

Returns any user's public profile by ID.

```graphql
query {
  profile(userId: "42") {
    userId
    username
    displayName
    avatarUrl
  }
}
```

**Auth required:** No
**Backend RPC:** `UserService.GetProfile(user_id)`

---

## Mutations — Auth

### register

Create a new account.

```graphql
mutation {
  register(
    email: "user@example.com"
    username: "johndoe"
    password: "securePass123"
  ) {
    success
    user { id email username }
    tokens { accessToken refreshToken tokenType expiresIn }
  }
}
```

**Auth required:** No
**Rate limit:** 5 per minute per IP
**Backend RPC:** `AuthService.RegisterUser`
**Validation:** email (valid format), username (3–30 chars, no @), password (8–128 chars)

---

### login

Authenticate with email/username and password.

```graphql
mutation {
  login(emailUsername: "user@example.com", password: "securePass123") {
    success
    user { id email username }
    tokens { accessToken refreshToken }
    requires2FA
  }
}
```

**Auth required:** No
**Rate limit:** 10 per minute per IP
**Backend RPC:** `AuthService.LoginUser`

When `requires2FA` is `true`, `tokens` will be null. Client must call `verify2FA` next.

---

### oidcLogin

Authenticate via OAuth/OIDC provider (Google, GitHub).

```graphql
mutation {
  oidcLogin(code: "auth_code_from_provider", provider: "google", state: "csrf_state") {
    success
    user { id email username provider externalId }
    idToken
    tokens { accessToken refreshToken }
  }
}
```

**Auth required:** No
**Backend RPC:** `AuthService.OIDCLogin`

---

### forgotPassword

Request a password reset code sent to email.

```graphql
mutation {
  forgotPassword(email: "user@example.com") {
    success
    message
  }
}
```

**Auth required:** No
**Rate limit:** 3 per minute per IP
**Backend RPC:** `AuthService.ForgotPassword`

---

### verifyResetCode

Check if a reset code is valid (does not consume it).

```graphql
mutation {
  verifyResetCode(email: "user@example.com", code: "123456") {
    success
    message
  }
}
```

**Auth required:** No
**Backend RPC:** `AuthService.VerifyResetCode`
**Validation:** code must be 6 digits

---

### resetPassword

Reset password using the code from `forgotPassword`.

```graphql
mutation {
  resetPassword(
    email: "user@example.com"
    code: "123456"
    newPassword: "newSecurePass456"
  ) {
    success
    message
  }
}
```

**Auth required:** No
**Rate limit:** 3 per minute per IP
**Backend RPC:** `AuthService.ResetPassword`
**Validation:** code (6 digits), newPassword (8–128 chars)

---

### changePassword

Change password for the authenticated user.

```graphql
mutation {
  changePassword(oldPassword: "currentPass", newPassword: "newSecurePass456") {
    success
    message
  }
}
```

**Auth required:** Yes (`@auth`)
**Backend RPC:** `AuthService.ChangePassword` — forwards `access_token`
**Validation:** newPassword (8–128 chars)

**Headers:**
```
Authorization: Bearer <access_token>
```

---

### setup2FA

Generate QR code and secret for TOTP 2FA setup.

```graphql
mutation {
  setup2FA {
    success
    qrCode
    secret
    backupCodes
  }
}
```

**Auth required:** Yes (`@auth`)
**Backend RPC:** `AuthService.Setup2FA` — forwards `access_token`

---

### verify2FA

Verify a TOTP code or backup code to complete 2FA.

```graphql
mutation {
  verify2FA(code: "123456") {
    success
    message
    accessToken
    refreshToken
  }
}
```

**Auth required:** Yes (`@auth`)
**Backend RPC:** `AuthService.Verify2FA` — forwards `access_token`
**Validation:** code must be 6-digit TOTP or 8-char hex backup code

Returns new tokens with `acr=2fa` claim.

---

### verifyEmail

Verify email address using token from confirmation email.

```graphql
mutation {
  verifyEmail(token: "hex_verification_token") {
    success
    message
  }
}
```

**Auth required:** No
**Backend RPC:** `AuthService.VerifyEmail`

---

### refreshTokens

Exchange a refresh token for a new token pair.

```graphql
mutation {
  refreshTokens(refreshToken: "opaque_refresh_token_hex") {
    accessToken
    refreshToken
  }
}
```

**Auth required:** No
**Backend RPC:** `AuthService.RefreshTokens`

Note: Refresh tokens are opaque strings — the gateway cannot verify them, it just forwards to auth-service.

---

### logout

Invalidate a refresh token (server-side session termination).

```graphql
mutation {
  logout(refreshToken: "opaque_refresh_token_hex") {
    success
    message
  }
}
```

**Auth required:** Yes (`@auth`)
**Backend RPC:** `AuthService.Logout`

---

## Mutations — User

### updateProfile

Update the authenticated user's profile fields.

```graphql
mutation {
  updateProfile(
    username: "newusername"
    displayName: "John Doe"
    avatarUrl: "https://example.com/avatar.jpg"
  ) {
    success
    message
    profile { userId username displayName avatarUrl }
  }
}
```

**Auth required:** Yes (`@auth`)
**Backend RPC:** `UserService.UpdateProfile` — forwards `access_token`
**Validation:** At least one field required. username (3–30 chars, no @), displayName (max 50), avatarUrl (valid URI)

**Headers:**
```
Authorization: Bearer <access_token>
```

---

## Payload Types Summary

| Payload | Fields | Used By |
|---------|--------|---------|
| `AuthPayload` | success, user, tokens, requires2FA | register, login |
| `OIDCPayload` | success, user, idToken, tokens | oidcLogin |
| `MessagePayload` | success, message | forgotPassword, verifyResetCode, resetPassword, changePassword, verifyEmail, logout |
| `Setup2FAPayload` | success, qrCode, secret, backupCodes | setup2FA |
| `Verify2FAPayload` | success, message, accessToken, refreshToken | verify2FA |
| `TokenPayload` | accessToken, refreshToken | refreshTokens |
| `UpdateProfilePayload` | success, message, profile | updateProfile |

---

## Custom Directives

| Directive | Usage | Behavior |
|-----------|-------|----------|
| `@auth` | `FIELD_DEFINITION` | Rejects request with `UNAUTHENTICATED` if no valid JWT |
| `@rateLimit(max, window)` | `FIELD_DEFINITION` | Per-IP rate limiting; rejects with `RATE_LIMITED` |

---

## Error Codes

| Code | Meaning |
|------|---------|
| `BAD_USER_INPUT` | Joi validation failed or gRPC INVALID_ARGUMENT |
| `UNAUTHENTICATED` | No/invalid JWT or gRPC UNAUTHENTICATED |
| `FORBIDDEN` | gRPC PERMISSION_DENIED |
| `NOT_FOUND` | gRPC NOT_FOUND |
| `CONFLICT` | gRPC ALREADY_EXISTS (e.g., duplicate email) |
| `RATE_LIMITED` | @rateLimit directive threshold exceeded |
| `INTERNAL_SERVER_ERROR` | Unmapped gRPC error or unexpected failure |
