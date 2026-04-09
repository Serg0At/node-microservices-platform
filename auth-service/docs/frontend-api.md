# Auth Service — Frontend Developer Reference

**Service:** Auth Service  
**Responsibility:** Handles all authentication and identity operations including registration, login, OAuth, password management, two-factor authentication, and session lifecycle. It issues RS256 JWT access tokens and opaque refresh tokens consumed by the GraphQL gateway on behalf of clients.

> All RPCs are exposed through the GraphQL gateway — you never call gRPC directly. Field names below match what the gateway forwards.

---

## RegisterUser
Registers a new user account, stores a verification token in Redis, publishes a `user.registered` event, and returns tokens for an immediate session.

**Request**
| Field | Type | Required | Description |
|---|---|---|---|
| `email` | string | yes | User email address (disposable domains are blocked) |
| `username` | string | yes | Unique username (case-insensitive) |
| `password_hash` | string | yes | Pre-hashed password from client |
| `fingerprint` | string | no | FingerprintJS visitorId for trial abuse detection |
| `ip` | string | no | Client IP forwarded by gateway |

**Response**
| Field | Type | Description |
|---|---|---|
| `success` | bool | `true` on success |
| `user.id` | string | Created user ID |
| `user.email` | string | |
| `user.username` | string | |
| `tokens.access_token` | string | JWT (1h) |
| `tokens.refresh_token` | string | Opaque token (30d) |
| `tokens.token_type` | string | `"Bearer"` |
| `tokens.expires_in` | int | `3600` |

**Example**
```json
// Request
{
  "email": "john@example.com",
  "username": "john_doe",
  "password_hash": "hashed_password",
  "fingerprint": "abc123visitorId"
}

// Response
{
  "success": true,
  "user": { "id": "42", "email": "john@example.com", "username": "john_doe" },
  "tokens": { "access_token": "eyJ...", "refresh_token": "a1b2c3...", "token_type": "Bearer", "expires_in": 3600 }
}
```

---

## LoginUser
Authenticates a user by email/username and password; returns tokens or signals that 2FA verification is required.

**Request**
| Field | Type | Required | Description |
|---|---|---|---|
| `email_username` | string | yes | Email or username |
| `password_hash` | string | yes | Pre-hashed password |

**Response**
| Field | Type | Description |
|---|---|---|
| `success` | bool | |
| `user` | User | Present only when `requires_2fa` is `false` |
| `tokens` | Tokens | Present only when `requires_2fa` is `false` |
| `requires_2fa` | bool | `true` → redirect to 2FA input; use the returned short-lived `access_token` for `Verify2FA` |

**Example**
```json
// Request
{ "email_username": "john@example.com", "password_hash": "hashed_password" }

// Response (no 2FA)
{ "success": true, "requires_2fa": false, "user": { "id": "42", ... }, "tokens": { "access_token": "eyJ...", ... } }

// Response (2FA required)
{ "success": true, "requires_2fa": true, "tokens": { "access_token": "eyJ_short_lived...", "expires_in": 300 } }
```

---

## OIDCLogin
Exchanges a provider authorization code for user info, creates or links the account, and returns tokens.

**Request**
| Field | Type | Required | Description |
|---|---|---|---|
| `code` | string | yes | Authorization code from OAuth provider |
| `provider` | string | yes | `"google"` |
| `state` | string | no | CSRF state value |

**Response**
| Field | Type | Description |
|---|---|---|
| `success` | bool | |
| `user` | User | Includes `external_id` and `provider` |
| `id_token` | string | Raw Google ID token |
| `tokens` | Tokens | Access + refresh tokens |

**Example**
```json
// Request
{ "code": "4/0AY0e-g7...", "provider": "google", "state": "xyz" }

// Response
{
  "success": true,
  "user": { "id": "42", "email": "john@gmail.com", "username": "john_doe", "external_id": "google_108...", "provider": "google" },
  "id_token": "eyJ...",
  "tokens": { "access_token": "eyJ...", "refresh_token": "a1b2c3...", "token_type": "Bearer", "expires_in": 3600 }
}
```

---

## ForgotPassword
Sends a password reset code to the user's email; always returns success to prevent email enumeration.

**Request**
| Field | Type | Required |
|---|---|---|
| `email` | string | yes |

**Response**
| Field | Type | Description |
|---|---|---|
| `success` | bool | Always `true` |
| `message` | string | e.g. `"If that email exists, a reset code was sent"` |

**Example**
```json
// Request
{ "email": "john@example.com" }

// Response
{ "success": true, "message": "If that email exists, a reset code was sent" }
```

---

## VerifyResetCode
Validates a reset code without consuming it — use this to enable the "set new password" step in the UI.

**Request**
| Field | Type | Required |
|---|---|---|
| `email` | string | yes |
| `code` | string | yes |

**Response**
| Field | Type | Description |
|---|---|---|
| `success` | bool | `true` if code is valid |
| `message` | string | |

**Example**
```json
// Request
{ "email": "john@example.com", "code": "483921" }

// Response
{ "success": true, "message": "Code is valid" }
```

---

## ResetPassword
Resets the user's password using the verified code; consumes and deletes the code.

**Request**
| Field | Type | Required |
|---|---|---|
| `email` | string | yes |
| `code` | string | yes |
| `new_pass` | string | yes |

**Response**
| Field | Type | Description |
|---|---|---|
| `success` | bool | |
| `message` | string | |

**Example**
```json
// Request
{ "email": "john@example.com", "code": "483921", "new_pass": "hashed_new_password" }

// Response
{ "success": true, "message": "Password reset successfully" }
```

---

## RequestPasswordChange
Sends a password-change confirmation link to the authenticated user's email.

**Request**
| Field | Type | Required | Description |
|---|---|---|---|
| `access_token` | string | yes | Valid JWT of the authenticated user |

**Response**
| Field | Type | Description |
|---|---|---|
| `success` | bool | |
| `message` | string | |

**Example**
```json
// Request
{ "access_token": "eyJ..." }

// Response
{ "success": true, "message": "Password change email sent" }
```

---

## ConfirmPasswordChange
Sets a new password using the token received in the email link (unauthenticated at this point).

**Request**
| Field | Type | Required | Description |
|---|---|---|---|
| `token` | string | yes | Token from the email link |
| `new_pass` | string | yes | New pre-hashed password |

**Response**
| Field | Type | Description |
|---|---|---|
| `success` | bool | |
| `message` | string | |

**Example**
```json
// Request
{ "token": "c3d4e5f6...", "new_pass": "hashed_new_password" }

// Response
{ "success": true, "message": "Password changed successfully" }
```

---

## Setup2FA
Generates a TOTP secret, returns a QR code and backup codes; 2FA is not active until `Verify2FA` is called once.

**Request**
| Field | Type | Required | Description |
|---|---|---|---|
| `access_token` | string | yes | Valid JWT of the authenticated user |

**Response**
| Field | Type | Description |
|---|---|---|
| `success` | bool | |
| `qr_code` | string | Base64 PNG — display as `<img src="...">` |
| `secret` | string | Raw TOTP secret (show to user for manual entry) |
| `backup_codes` | string[] | 8 one-time codes — show once, store safely |

**Example**
```json
// Request
{ "access_token": "eyJ..." }

// Response
{
  "success": true,
  "qr_code": "data:image/png;base64,iVBOR...",
  "secret": "JBSWY3DPEHPK3PXP",
  "backup_codes": ["a1b2c3d4", "e5f6g7h8", ...]
}
```

---

## Verify2FA
Verifies a TOTP code or backup code; on first use activates 2FA, on login completes the session and returns full tokens.

**Request**
| Field | Type | Required | Description |
|---|---|---|---|
| `code` | string | yes | 6-digit TOTP or 8-char backup code |
| `access_token` | string | yes | Short-lived token from login's `requires_2fa` response |

**Response**
| Field | Type | Description |
|---|---|---|
| `success` | bool | |
| `message` | string | |
| `access_token` | string | Full JWT with `acr: "2fa"` claim (1h) |
| `refresh_token` | string | Opaque token (30d) |

**Example**
```json
// Request
{ "code": "482910", "access_token": "eyJ_short_lived..." }

// Response
{ "success": true, "message": "2FA verified", "access_token": "eyJ_full...", "refresh_token": "x9y8z7..." }
```

---

## VerifyEmail
Marks the user's email as verified using the token sent during registration.

**Request**
| Field | Type | Required | Description |
|---|---|---|---|
| `token` | string | yes | Token from the verification email link |

**Response**
| Field | Type | Description |
|---|---|---|
| `success` | bool | |
| `message` | string | |

**Example**
```json
// Request
{ "token": "f1e2d3c4b5a6..." }

// Response
{ "success": true, "message": "Email verified successfully" }
```

---

## RefreshTokens
Rotates both tokens — old refresh token is invalidated, new pair is returned.

**Request**
| Field | Type | Required |
|---|---|---|
| `refresh_token` | string | yes |

**Response**
| Field | Type | Description |
|---|---|---|
| `access_token` | string | New JWT (1h) |
| `refresh_token` | string | New opaque token (30d) |

**Example**
```json
// Request
{ "refresh_token": "a1b2c3..." }

// Response
{ "access_token": "eyJ_new...", "refresh_token": "d4e5f6_new..." }
```

---

## Logout
Revokes the refresh token and removes the session; access token expires naturally.

**Request**
| Field | Type | Required |
|---|---|---|
| `refresh_token` | string | yes |

**Response**
| Field | Type | Description |
|---|---|---|
| `success` | bool | |
| `message` | string | |

**Example**
```json
// Request
{ "refresh_token": "a1b2c3..." }

// Response
{ "success": true, "message": "Logged out successfully" }
```
