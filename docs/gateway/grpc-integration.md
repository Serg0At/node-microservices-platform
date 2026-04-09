# gRPC Integration

## Overview

The gateway communicates with backend microservices over gRPC using `@grpc/grpc-js` and `@grpc/proto-loader`. Proto files are copied from the respective services to ensure exact compatibility.

---

## Proto Files

**Location:** `src/grpc/protos/`

| Proto | Package | Service | Port |
|-------|---------|---------|------|
| `auth.proto` | `auth` | `AuthService` | 50051 |
| `user.proto` | `user` | `UserService` | 50052 |

Proto files must be kept in sync with the backend services. Copy them when RPCs change:

```bash
cp ../auth-service/proto/auth.proto src/grpc/protos/
cp ../user-service/proto/user.proto src/grpc/protos/
```

---

## Client Setup

**File:** `src/config/grpc-clients.js`

### Proto Loader Options

```js
const loaderOptions = {
  keepCase: true,    // field names stay snake_case (match proto)
  longs: String,     // int64 → string (avoids JS number precision loss)
  enums: String,     // enum values as strings
  defaults: true,    // include default values for unset fields
  oneofs: true,      // support oneof fields
};
```

### Client Singletons

Clients are created once at startup and reused across all requests:

```js
export const authClient = new authProto.AuthService(
  'localhost:50051',
  grpc.credentials.createInsecure(),  // TLS in production
);

export const userClient = new userProto.UserService(
  'localhost:50052',
  grpc.credentials.createInsecure(),
);
```

---

## Client Wrapper Pattern

**Files:** `src/grpc/clients/auth-client.js`, `src/grpc/clients/user-client.js`

Each gRPC RPC is wrapped in a Promise-based function that:

1. Creates gRPC metadata (with `user-agent`)
2. Calls the RPC with callback
3. Rejects with a mapped GraphQL error on failure
4. Resolves with the response on success

### Core Pattern

```js
function createMetadata(userAgent) {
  const metadata = new grpc.Metadata();
  if (userAgent) {
    metadata.set('user-agent', userAgent);
  }
  return metadata;
}

function callRpc(method, request, metadata) {
  return new Promise((resolve, reject) => {
    authClient[method](request, metadata, (err, response) => {
      if (err) return reject(grpcToGraphQLError(err));
      resolve(response);
    });
  });
}

// Usage:
export function loginUser({ email_username, password_hash }, userAgent) {
  return callRpc('LoginUser', { email_username, password_hash }, createMetadata(userAgent));
}
```

---

## RPC Reference

### Auth Service (12 RPCs)

| Function | gRPC RPC | Request Fields | Response Fields |
|----------|----------|---------------|-----------------|
| `registerUser` | `RegisterUser` | email, username, password_hash | success, user, tokens |
| `loginUser` | `LoginUser` | email_username, password_hash | success, user, tokens, requires_2fa |
| `oidcLogin` | `OIDCLogin` | code, provider, state | success, user, id_token, tokens |
| `forgotPassword` | `ForgotPassword` | email | success, message |
| `verifyResetCode` | `VerifyResetCode` | email, code | success, message |
| `resetPassword` | `ResetPassword` | email, code, new_pass | success, message |
| `changePassword` | `ChangePassword` | old_pass, new_pass, access_token | success, message |
| `setup2FA` | `Setup2FA` | access_token | success, qr_code, secret, backup_codes |
| `verify2FA` | `Verify2FA` | code, access_token | success, message, access_token, refresh_token |
| `verifyEmail` | `VerifyEmail` | token | success, message |
| `refreshTokens` | `RefreshTokens` | refresh_token | access_token, refresh_token |
| `logout` | `Logout` | refresh_token | success, message |

### User Service (2 RPCs)

| Function | gRPC RPC | Request Fields | Response Fields |
|----------|----------|---------------|-----------------|
| `getProfile` | `GetProfile` | user_id | success, profile |
| `updateProfile` | `UpdateProfile` | access_token, username, display_name, avatar_url | success, message, profile |

---

## Field Name Mapping

Because `keepCase: true` is set, gRPC fields arrive in snake_case. Resolvers map them to camelCase for GraphQL:

| gRPC (snake_case) | GraphQL (camelCase) |
|--------------------|---------------------|
| `access_token` | `accessToken` |
| `refresh_token` | `refreshToken` |
| `token_type` | `tokenType` |
| `expires_in` | `expiresIn` |
| `requires_2fa` | `requires2FA` |
| `external_id` | `externalId` |
| `id_token` | `idToken` |
| `qr_code` | `qrCode` |
| `backup_codes` | `backupCodes` |
| `user_id` | `userId` |
| `display_name` | `displayName` |
| `avatar_url` | `avatarUrl` |
| `expires_at` | `expiresAt` |
| `email_username` | `emailUsername` |
| `password_hash` | (mapped from `password`) |
| `new_pass` | (mapped from `newPassword`) |
| `old_pass` | (mapped from `oldPassword`) |

Mapping is done in resolver helper functions (`mapUser`, `mapTokens`, `mapProfile`).

---

## Metadata

Every gRPC call includes metadata:

| Key | Source | Purpose |
|-----|--------|---------|
| `user-agent` | `req.headers['user-agent']` | Session binding, device fingerprinting |

The `user-agent` header is extracted during context building and passed to every gRPC client function as the second argument.

---

## Error Handling

gRPC errors are intercepted in `callRpc` and converted to GraphQL errors via `grpcToGraphQLError()`:

```
gRPC INVALID_ARGUMENT (3)   → BAD_USER_INPUT
gRPC NOT_FOUND (5)          → NOT_FOUND
gRPC ALREADY_EXISTS (6)     → CONFLICT
gRPC PERMISSION_DENIED (7)  → FORBIDDEN
gRPC UNAUTHENTICATED (16)   → UNAUTHENTICATED
Other                       → INTERNAL_SERVER_ERROR
```

See [Error Handling](error-handling.md) for full details.
