# Google OIDC Login Flow

## Overview

Single `OIDCLogin` gRPC method handles both registration and login — determined internally by whether the user exists. No separate "register with Google" endpoint.

---

## Architecture Diagram

```
┌─────────────┐         ┌──────────────────┐         ┌──────────────┐
│   Browser   │         │  GraphQL Gateway │         │ Auth Service │
└──────┬──────┘         └────────┬─────────┘         └──────┬───────┘
       │                         │                           │
       │  1. Click "Sign in      │                           │
       │     with Google"        │                           │
       │─────────────────────────▶                           │
       │                         │                           │
       │  2. Redirect to Google  │                           │
       │     auth URL            │                           │
       │     (with redirect_uri, │                           │
       │      state, scope,      │                           │
       │      access_type=offline│                           │
       │◀────────────────────────│                           │
       │                         │                           │
       │  ─── User logs in on Google's page ───              │
       │                         │                           │
       │  3. Google redirects    │                           │
       │     back to gateway:    │                           │
       │     /callback?code=xxx  │                           │
       │─────────────────────────▶                           │
       │                         │  4. gRPC OIDCLogin(       │
       │                         │     code, provider,       │
       │                         │     state)                │
       │                         │──────────────────────────▶│
       │                         │                           │
       │                         │              ┌────────────┴──────────┐
       │                         │              │  5. POST to Google     │
       │                         │              │  oauth2.googleapis.com │
       │                         │              │  /token                │
       │                         │              │  → google_access_token │
       │                         │              │    google_refresh_token│
       │                         │              │    id_token            │
       │                         │              └────────────┬──────────┘
       │                         │                           │
       │                         │              ┌────────────┴──────────┐
       │                         │              │  6. GET userinfo       │
       │                         │              │  googleapis.com        │
       │                         │              │  /oauth2/v2/userinfo   │
       │                         │              │  → external_id, email, │
       │                         │              │    picture             │
       │                         │              └────────────┬──────────┘
       │                         │                           │
       │                         │              ┌────────────┴──────────┐
       │                         │              │  7. DB transaction     │
       │                         │              │                        │
       │                         │              │  find user_oauth       │
       │                         │              │  by (provider,         │
       │                         │              │     external_id)       │
       │                         │              │       │                │
       │                         │              │    found ──▶ update    │
       │                         │              │    │        tokens +   │
       │                         │              │    │        last_login  │
       │                         │              │    │                   │
       │                         │              │  not found             │
       │                         │              │    │                   │
       │                         │              │    find user by email  │
       │                         │              │       │                │
       │                         │              │    found ──▶ link new  │
       │                         │              │    │        oauth to   │
       │                         │              │    │        account    │
       │                         │              │    │                   │
       │                         │              │  not found             │
       │                         │              │    │                   │
       │                         │              │    INSERT users        │
       │                         │              │    (is_active=true,    │
       │                         │              │     random username)   │
       │                         │              │    + INSERT user_oauth │
       │                         │              └────────────┬──────────┘
       │                         │                           │
       │                         │              ┌────────────┴──────────┐
       │                         │              │  8. Redis              │
       │                         │              │  SADD user_sessions    │
       │                         │              │      :{user_id}        │
       │                         │              │      sha256(userAgent) │
       │                         │              └────────────┬──────────┘
       │                         │                           │
       │                         │              ┌────────────┴──────────┐
       │                         │              │  9. Issue YOUR JWTs   │
       │                         │              │  access_token  (15m)  │
       │                         │              │  refresh_token (20d)  │
       │                         │              └────────────┬──────────┘
       │                         │                           │
       │                         │              ┌────────────┴──────────┐
       │                         │              │  10. RabbitMQ         │
       │                         │              │  new user →           │
       │                         │              │    user.registered    │
       │                         │              │    (both exchanges)   │
       │                         │              │  returning user →     │
       │                         │              │    user.logged_in     │
       │                         │              │    (notification only)│
       │                         │              └────────────┬──────────┘
       │                         │                           │
       │                         │  11. Response:            │
       │                         │  { user, id_token,        │
       │                         │    access_token,          │
       │                         │    refresh_token }        │
       │                         │◀──────────────────────────│
       │  12. Gateway returns    │                           │
       │  tokens to browser      │                           │
       │◀────────────────────────│                           │
```

---

## Step-by-Step Breakdown

### Steps 1–3 — Browser ↔ Google (Gateway responsibility)

The gateway constructs the Google auth URL and redirects the user. **Required parameters:**

```
https://accounts.google.com/o/oauth2/v2/auth
  ?client_id=YOUR_CLIENT_ID
  &redirect_uri=YOUR_GATEWAY_CALLBACK_URL   ← must match GOOGLE_CALLBACK_URL in .env
  &response_type=code
  &scope=openid email profile
  &access_type=offline                       ← required to get refresh_token
  &prompt=consent                            ← forces refresh_token on every auth
  &state=RANDOM_CSRF_TOKEN
```

Google redirects back to `redirect_uri?code=xxx&state=xxx`. The gateway validates the state, then calls Auth Service.

---

### Step 4 — gRPC call

```protobuf
OIDCLogin(OIDCLoginRequest) returns (OIDCLoginResponse)

message OIDCLoginRequest {
  string code     = 1;   // authorization code from Google
  string provider = 2;   // "google"
  string state    = 3;   // passed through, validated by gateway
}
```

> State validation is the **gateway's responsibility** before calling this RPC.

---

### Steps 5–6 — Auth Service calls Google

```
POST https://oauth2.googleapis.com/token
  code, client_id, client_secret, redirect_uri, grant_type=authorization_code
→ { google_access_token, google_refresh_token, id_token, expires_in }

GET https://www.googleapis.com/oauth2/v2/userinfo
  Authorization: Bearer google_access_token
→ { id (external_id), email, picture }
```

> `google_refresh_token` is only returned on the **first** authorization (or when `prompt=consent` is used). Subsequent logins will have it as `null` — the service preserves the stored one.

---

### Step 7 — DB Transaction (UPSERT logic)

Three branches, executed in a single transaction:

| Scenario | Action |
|---|---|
| `user_oauth` row exists for `(provider, external_id)` | Update Google tokens + `last_login` |
| No OAuth row, but `users` row with same email exists | Insert `user_oauth` row linking to existing account, update `last_login` |
| Neither exists | Insert `users` (`is_active=true`, random username, no `password_hash`) + insert `user_oauth` |

> OAuth users get `is_active = true` immediately — Google already verified the email.
> OAuth users have `password_hash = NULL` — they can set a password later via ForgotPassword.

---

### Step 8 — Redis Session

```
SADD user_sessions:{user_id}  →  AES-256-GCM(userAgent)
EXPIRE user_sessions:{user_id}  →  7 days
```

---

### Step 9 — Your JWTs (not Google's)

After this point Google is completely out of the picture. The service issues its own tokens:

| Token | Algorithm | TTL |
|---|---|---|
| `access_token` | RS256 (asymmetric) | 15 minutes |
| `refresh_token` | HS256 (symmetric) | 20 days |

---

### Step 10 — RabbitMQ Events

| Scenario | Routing key | Exchange |
|---|---|---|
| New user | `user.registered` | subscription + notification |
| Returning user | `user.logged_in` | notification only |

**Payloads:**

```json
// user.registered
{ "user_id": 123, "email": "user@example.com", "ts": 1734103999 }

// user.logged_in
{ "user_id": 123, "device": "Chrome/120.0", "ts": 1734103999 }
```

---

### Step 11 — Response

```json
{
  "success": true,
  "user": {
    "id": "123",
    "email": "user@example.com",
    "username": "SwiftWolf4821",
    "external_id": "google_123456789",
    "provider": "google"
  },
  "id_token": "eyJ...",       // Google's id_token — passed through to client
  "tokens": {
    "access_token": "eyJ...", // YOUR JWT
    "refresh_token": "eyJ...",
    "token_type": "Bearer",
    "expires_in": 3600
  }
}
```

---

## Token Distinction (Important)

| Token | Origin | Stored where | Used for |
|---|---|---|---|
| `google_access_token` | Google | `user_oauth.access_token` (encrypted) | Calling Google APIs on behalf of user |
| `google_refresh_token` | Google | `user_oauth.refresh_token` (encrypted) | Refreshing Google access token |
| `id_token` | Google | Not stored | Passed through to client |
| `access_token` (JWT) | Auth Service | Client only | Authenticating requests in your system |
| `refresh_token` (JWT) | Auth Service | Client only | Getting a new JWT pair |

---

## Environment Variables Required

```env
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_CALLBACK_URL=http://localhost:3000/auth/google/callback  # must match Google Cloud Console
```

> `GOOGLE_CALLBACK_URL` is the **GraphQL Gateway's** HTTP endpoint, not the auth service (which is gRPC only).
> This exact URL must be registered in Google Cloud Console → APIs & Services → Credentials → Authorized redirect URIs.

---

## Google Cloud Console Setup Checklist

- [ ] Create OAuth 2.0 Client ID (Web application type)
- [ ] Add `GOOGLE_CALLBACK_URL` to Authorized redirect URIs
- [ ] OAuth consent screen → add scopes: `openid`, `email`, `profile`
- [ ] OAuth consent screen → add test users (while app is in Testing status)
- [ ] Copy Client ID and Client Secret to `.env`
