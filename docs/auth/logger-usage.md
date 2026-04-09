# Logger & Handler Usage Guide

## Imports

```js
import { logger, SuccessHandler, ErrorHandler } from '../utils/index.js';
```

---

## 1. Logger (standalone)

Use `logger` directly when you need to log outside of gRPC handlers (services, startup, workers, etc.).

```js
// Levels: error, warn, info, http, verbose, debug, silly
logger.info('Server started', { port: 50051 });
logger.warn('Redis reconnecting', { attempt: 3 });
logger.error('Failed to connect to DB', { host: 'localhost' });

// With method context
logger.info('Cache invalidated', { service: 'auth-service', method: 'RefreshTokens', userId: '123' });

// Logging errors with stack trace
try {
  await riskyOperation();
} catch (err) {
  logger.error(err.message, { stack: err.stack, method: 'riskyOperation' });
}
```

**Output format:**
```
2026-02-14 12:00:00 [info] [auth-service] [RefreshTokens] Cache invalidated {"userId":"123"}
```

**Log files:**
- `logs/error.log` — errors only
- `logs/combined.log` — all levels

---

## 2. ErrorHandler

### `handle(callback, error, meta)` — Catch-all

Auto-resolves the gRPC status code from the error name or Postgres error code.

```js
static async registerUser(call, callback) {
  const meta = { method: 'RegisterUser' };
  try {
    const result = await AuthService.register(call.request);
    callback(null, result);
  } catch (error) {
    ErrorHandler.handle(callback, error, meta);
    // ConflictError     → ALREADY_EXISTS
    // PG code 23505     → ALREADY_EXISTS
    // UnauthorizedError  → UNAUTHENTICATED
    // Unknown errors     → INTERNAL
  }
}
```

### Specific error methods

Each sends the appropriate gRPC code and logs at `warn` level (except `internal` which logs at `error`).

```js
// Validation / bad input → INVALID_ARGUMENT
ErrorHandler.invalidArgument(callback, 'Email is required', { method: 'RegisterUser' });

// Auth failure → UNAUTHENTICATED
ErrorHandler.unauthenticated(callback, 'Wrong password', { method: 'LoginUser' });

// Forbidden → PERMISSION_DENIED
ErrorHandler.permissionDenied(callback, 'Admin only', { method: 'DeleteUser' });

// Not found → NOT_FOUND
ErrorHandler.notFound(callback, 'User not found', { method: 'GetUser' });

// Duplicate → ALREADY_EXISTS
ErrorHandler.alreadyExists(callback, 'Email taken', { method: 'RegisterUser' });

// Server error → INTERNAL
ErrorHandler.internal(callback, 'Redis unavailable', { method: 'LoginUser' });
```

### Custom error classes

Throw these from your service layer — `handle()` maps them automatically.

```js
const { ConflictError, UnauthorizedError, ResourceNotFoundError } = ErrorHandler.errors;

// In a service method:
throw new ConflictError('Email already registered');
throw new UnauthorizedError('Invalid token');
throw new ResourceNotFoundError('User not found');
```

**Full list:** `ExpiredEmailConfirmError`, `ExpiredTokenConfirmError`, `ConflictError`, `Forbidden`, `PermissionError`, `InputValidationError`, `InvalidEmailConfirmError`, `InvalidPasswordError`, `MicroserviceError`, `UnauthorizedError`, `ResourceNotFoundError`

---

## 3. SuccessHandler

Each method logs at `info` level and calls `callback(null, data)`.

```js
// Generic success
SuccessHandler.ok(callback, data, { method: 'SomeRpc' });

// Registration
SuccessHandler.registered(callback, result, { method: 'RegisterUser', userId: '123', email: 'a@b.com' });

// Login / OIDC
SuccessHandler.authenticated(callback, result, { method: 'LoginUser', userId: '123' });

// Token refresh
SuccessHandler.tokenRefreshed(callback, result, { method: 'RefreshTokens', userId: '123' });

// Token validation
SuccessHandler.tokenValidated(callback, result, { method: 'ValidateAccessToken' });

// Email verification
SuccessHandler.emailVerified(callback, result, { method: 'VerifyEmail', userId: '123' });

// 2FA setup
SuccessHandler.twoFactorSetup(callback, result, { method: 'Setup2FA', userId: '123' });

// 2FA verification
SuccessHandler.twoFactorVerified(callback, result, { method: 'Verify2FA', userId: '123' });

// Password change
SuccessHandler.passwordChanged(callback, result, { method: 'ResetPassword', userId: '123' });
```

---

## 4. Full controller example

```js
import AuthService from '../services/auth.service.js';
import { SuccessHandler, ErrorHandler } from '../utils/index.js';

export default class AuthController {
  static async loginUser(call, callback) {
    const meta = { method: 'LoginUser' };
    try {
      const { email_username, password_hash } = call.request;

      if (!email_username || !password_hash) {
        return ErrorHandler.invalidArgument(callback, 'Missing credentials', meta);
      }

      const result = await AuthService.login({ email_username, password: password_hash });

      SuccessHandler.authenticated(callback, result, { ...meta, userId: result.user.id });
    } catch (error) {
      ErrorHandler.handle(callback, error, meta);
    }
  }
}
```

---

## 5. Environment variables

| Variable | Default | Description |
|---|---|---|
| `LOG_LEVEL` | `info` | Winston log level (`error`, `warn`, `info`, `debug`, etc.) |
| `NODE_ENV` | — | Set to `production` to disable console colors |
