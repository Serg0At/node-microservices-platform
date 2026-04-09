# Error Handling

## Overview

The gateway translates errors from two sources into standard GraphQL error responses:

1. **gRPC errors** — backend service failures
2. **Validation errors** — Joi input validation failures

All errors are logged and formatted before reaching the client.

---

## gRPC → GraphQL Error Mapping

**File:** `src/utils/error-formatter.js`

When a gRPC call fails, the error is intercepted in the client wrapper and mapped to a GraphQL error:

```js
const GRPC_TO_GQL_CODE = {
  3:  'BAD_USER_INPUT',       // INVALID_ARGUMENT
  5:  'NOT_FOUND',            // NOT_FOUND
  6:  'CONFLICT',             // ALREADY_EXISTS
  7:  'FORBIDDEN',            // PERMISSION_DENIED
  16: 'UNAUTHENTICATED',     // UNAUTHENTICATED
};
```

### Mapping Table

| gRPC Code | gRPC Name | GraphQL Code | Typical Scenario |
|-----------|-----------|-------------|------------------|
| 3 | `INVALID_ARGUMENT` | `BAD_USER_INPUT` | Invalid field value |
| 5 | `NOT_FOUND` | `NOT_FOUND` | User/resource doesn't exist |
| 6 | `ALREADY_EXISTS` | `CONFLICT` | Duplicate email or username |
| 7 | `PERMISSION_DENIED` | `FORBIDDEN` | Insufficient privileges |
| 16 | `UNAUTHENTICATED` | `UNAUTHENTICATED` | Invalid or expired token |
| Other | Any | `INTERNAL_SERVER_ERROR` | Unexpected backend failure |

### Error Message

The error message is taken from `err.details` (gRPC detail string) or falls back to `err.message`, then to `"Internal server error"`.

```js
const message = err.details || err.message || 'Internal server error';
```

---

## Validation Errors

Joi validation failures are thrown as GraphQL errors with `BAD_USER_INPUT` code:

```js
throw new GraphQLError(
  error.details.map((d) => d.message).join('; '),
  { extensions: { code: 'BAD_USER_INPUT' } },
);
```

### Example Response

```json
{
  "errors": [{
    "message": "\"email\" must be a valid email; \"password\" length must be at least 8 characters long",
    "locations": [{ "line": 2, "column": 3 }],
    "path": ["register"],
    "extensions": {
      "code": "BAD_USER_INPUT"
    }
  }],
  "data": null
}
```

---

## Auth Directive Errors

The `@auth` directive throws when `context.user` is null:

```json
{
  "errors": [{
    "message": "Authentication required",
    "extensions": { "code": "UNAUTHENTICATED" }
  }]
}
```

---

## Rate Limit Errors

The `@rateLimit` directive throws when the per-IP limit is exceeded:

```json
{
  "errors": [{
    "message": "Too many requests, please try again later",
    "extensions": { "code": "RATE_LIMITED" }
  }]
}
```

---

## Error Formatting (Apollo)

**File:** `src/utils/error-formatter.js` — `formatError` function

Apollo Server's `formatError` hook processes every error before it reaches the client:

```js
export function formatError(formattedError, error) {
  // 1. Log the error
  logger.error('GraphQL Error', {
    message: formattedError.message,
    code: formattedError.extensions?.code,
    path: formattedError.path,
  });

  // 2. Strip stacktrace in production
  if (process.env.SERVICE_ENV === 'production') {
    delete formattedError.extensions?.stacktrace;
  }

  return formattedError;
}
```

### Behavior by Environment

| Environment | Stacktrace | Logging |
|-------------|-----------|---------|
| `development` | Included in response | Logged to console + files |
| `production` | Stripped from response | Logged to console + files |

---

## Error Flow Diagram

```
gRPC Backend Error
        │
        ▼
  grpcToGraphQLError()         ← maps gRPC status → GQL code
        │
        ▼
  GraphQL Resolver throws
        │
        ▼
  Apollo formatError()         ← logs error, strips stacktrace
        │
        ▼
  JSON response to client
```

```
Joi Validation Failure
        │
        ▼
  validate() helper            ← joins all error messages
        │
        ▼
  throws GraphQLError(BAD_USER_INPUT)
        │
        ▼
  Apollo formatError()         ← logs error, strips stacktrace
        │
        ▼
  JSON response to client
```

---

## Log Output Example

```
2026-03-03 14:49:19 [error] [graphql-gateway] GraphQL Error "email" must be a valid email {"code":"BAD_USER_INPUT","path":["register"]}
```

All errors are written to both `logs/error.log` and `logs/combined.log`.
