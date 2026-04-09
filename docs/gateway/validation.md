# Input Validation

## Overview

All user-facing GraphQL inputs are validated with **Joi** before reaching the gRPC layer. Validation follows the same class-based pattern used in auth-service and user-service.

---

## Structure

```
src/middlewares/validations/
├── index.js                    # Re-exports Validation class
├── validation.js               # Static validate* methods
└── schemas/
    ├── index.js                # Re-exports schema classes
    ├── auth.schemas.js         # AuthSchemas (10 schemes)
    └── user.schemas.js         # UserSchemas (1 scheme)
```

---

## Schema Classes

### AuthSchemas

**File:** `src/middlewares/validations/schemas/auth.schemas.js`

| Scheme | Fields | Rules |
|--------|--------|-------|
| `RegisterScheme` | email, username, password | email: valid format; username: 3–30 chars, no `@`; password: 8–128 chars |
| `LoginScheme` | emailUsername, password | Both non-empty |
| `ForgotPasswordScheme` | email | Valid email format |
| `VerifyResetCodeScheme` | email, code | Valid email; code: exactly 6 digits |
| `ResetPasswordScheme` | email, code, newPassword | Valid email; 6-digit code; password: 8–128 chars |
| `ChangePasswordScheme` | oldPassword, newPassword | oldPassword: non-empty; newPassword: 8–128 chars |
| `RefreshTokenScheme` | refreshToken | Non-empty string |
| `VerifyEmailScheme` | token | Non-empty string |
| `LogoutScheme` | refreshToken | Non-empty string |
| `Verify2FAScheme` | code | 6-digit TOTP **or** 8-char hex backup code |

### UserSchemas

**File:** `src/middlewares/validations/schemas/user.schemas.js`

| Scheme | Fields | Rules |
|--------|--------|-------|
| `UpdateProfileScheme` | username?, displayName?, avatarUrl? | At least 1 field required; username: 3–30 chars, no `@`; displayName: max 50; avatarUrl: valid URI |

---

## Validation Class

**File:** `src/middlewares/validations/validation.js`

Static methods that call the corresponding schema with `abortEarly: false`:

```js
import { AuthSchemas, UserSchemas } from './schemas/index.js';

const auth = new AuthSchemas();
const user = new UserSchemas();

export default class Validation {
  static validateRegister(data) {
    return auth.RegisterScheme.validate(data, { abortEarly: false });
  }

  static validateLogin(data) { ... }
  static validateForgotPassword(data) { ... }
  static validateVerifyResetCode(data) { ... }
  static validateResetPassword(data) { ... }
  static validateChangePassword(data) { ... }
  static validateRefreshToken(data) { ... }
  static validateVerifyEmail(data) { ... }
  static validateLogout(data) { ... }
  static validateVerify2FA(data) { ... }
  static validateUpdateProfile(data) { ... }
}
```

---

## Usage in Resolvers

### Auth Resolver Pattern

```js
import { Validation } from '../../middlewares/validations/index.js';

function validate(validatorFn, data) {
  const { error } = validatorFn(data);
  if (error) {
    throw new GraphQLError(
      error.details.map((d) => d.message).join('; '),
      { extensions: { code: 'BAD_USER_INPUT' } },
    );
  }
}

// In resolver:
async register(_, { email, username, password }, { userAgent }) {
  validate(Validation.validateRegister, { email, username, password });
  // ... proceed to gRPC call
}
```

### User Resolver Pattern

The user resolver calls `Validation.validateUpdateProfile()` directly since it needs to build the input object first (only provided fields):

```js
const input = {};
if (username !== undefined) input.username = username;
if (displayName !== undefined) input.displayName = displayName;
if (avatarUrl !== undefined) input.avatarUrl = avatarUrl;

const { error } = Validation.validateUpdateProfile(input);
if (error) {
  throw new GraphQLError(
    error.details.map((d) => d.message).join('; '),
    { extensions: { code: 'BAD_USER_INPUT' } },
  );
}
```

---

## Key Behaviors

### abortEarly: false

All validations use `{ abortEarly: false }` which collects **every** validation error, not just the first one. Errors are joined with `; `:

```json
{
  "message": "\"email\" must be a valid email; \"username\" length must be at least 3 characters long; \"password\" length must be at least 8 characters long",
  "extensions": { "code": "BAD_USER_INPUT" }
}
```

### Custom Messages

Some schemas include custom error messages for clarity:

```js
username: Joi.string()
  .pattern(/^[^@]+$/, { name: 'no-at-sign' })
  .messages({ 'string.pattern.name': 'Username must not contain "@"' })

code: Joi.string()
  .length(6).pattern(/^\d+$/)
  .messages({ 'string.pattern.base': 'Code must be a 6-digit number' })
```

### 2FA Code Validation

The `Verify2FAScheme` accepts two formats via `Joi.alternatives()`:

- **TOTP code**: exactly 6 digits (e.g., `"482910"`)
- **Backup code**: exactly 8 hex characters (e.g., `"a1b2c3d4"`)

---

## Adding a New Validation

1. Add the Joi schema to the appropriate class in `schemas/`
2. Add a static method in `validation.js`
3. Call it in the resolver using `validate(Validation.validateXxx, data)`
