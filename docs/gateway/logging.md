# Logging

## Overview

The gateway uses **Winston** for structured logging with console and file transports. The setup matches the pattern used in auth-service and user-service.

---

## Configuration

**File:** `src/utils/logger.js`

| Setting | Value | Source |
|---------|-------|--------|
| Log level | `info` (default) | `LOG_LEVEL` env var |
| Service name | `graphql-gateway` | `defaultMeta` |
| Timestamp format | `YYYY-MM-DD HH:mm:ss` | Winston format |
| Error stacks | Captured | `errors({ stack: true })` |

---

## Log Format

```
{timestamp} [{level}] [{service}] [{method}] {message} ({duration}ms) {metadata}
```

### Example Outputs

```
2026-03-03 14:48:29 [info] [graphql-gateway] GraphQL Gateway running at http://localhost:4000/graphql
2026-03-03 14:49:19 [error] [graphql-gateway] GraphQL Error "email" must be a valid email {"code":"BAD_USER_INPUT","path":["register"]}
```

### Format Fields

| Field | Source | Always Present |
|-------|--------|---------------|
| `timestamp` | Winston timestamp | Yes |
| `level` | Log level (info, error, etc.) | Yes |
| `service` | `defaultMeta.service` | Yes |
| `method` | Passed in log meta | No |
| `message` | First argument to logger | Yes |
| `stack` | Error stack trace (replaces message) | Only for Error objects |
| `duration` | Passed in log meta | No |
| Extra metadata | Any remaining fields | No |

---

## Transports

### Console

- **Active:** Always
- **Colorized:** Yes in development, no in production
- **Level:** All levels (controlled by `LOG_LEVEL`)

### File — Error Log

| Setting | Value |
|---------|-------|
| File | `logs/error.log` |
| Level | `error` only |
| Max size | 5 MB |
| Max files | 5 (rotation) |

### File — Combined Log

| Setting | Value |
|---------|-------|
| File | `logs/combined.log` |
| Level | All levels |
| Max size | 10 MB |
| Max files | 5 (rotation) |

### File Rotation

Winston automatically rotates log files when they reach the max size:

```
logs/
├── error.log          # Current error log
├── error1.log         # Previous (rotated)
├── error2.log         # Older
├── combined.log       # Current combined log
├── combined1.log      # Previous (rotated)
└── combined2.log      # Older
```

Up to 5 rotated files are kept per transport. Oldest files are deleted automatically.

---

## Production Behavior

When `NODE_ENV=production`:
- Console output is **not colorized** (suitable for log aggregators)
- All other behavior remains the same

When `SERVICE_ENV=production`:
- Error stacktraces are stripped from GraphQL responses (but still logged to files)

---

## Where Logging Happens

### Server Startup

**File:** `src/server.js`

```js
logger.info(`GraphQL Gateway running at http://localhost:${config.port}/graphql`);
```

### JWT Verification Failures

**File:** `src/middlewares/auth-context.js`

```js
logger.debug('JWT verification failed', { error: err.message });
```

Logged at `debug` level — won't appear unless `LOG_LEVEL=debug`. This prevents log noise from expired tokens.

### GraphQL Errors

**File:** `src/utils/error-formatter.js`

```js
logger.error('GraphQL Error', {
  message: formattedError.message,
  code: formattedError.extensions?.code,
  path: formattedError.path,
});
```

Every GraphQL error is logged at `error` level, including:
- Validation errors (`BAD_USER_INPUT`)
- Auth errors (`UNAUTHENTICATED`)
- gRPC backend errors
- Rate limit errors

---

## Usage Guide

### Basic Logging

```js
import { logger } from './utils/logger.js';

logger.info('Server started');
logger.warn('Deprecation notice', { field: 'oldField' });
logger.error('Something failed', { userId: '42' });
logger.debug('Debug info');  // only visible when LOG_LEVEL=debug
```

### With Method Context

```js
logger.info('Profile fetched', {
  method: 'GetProfile',
  userId: '42',
  duration: 15,
});
// Output: 2026-03-03 15:00:00 [info] [graphql-gateway] [GetProfile] Profile fetched (15ms) {"userId":"42"}
```

### Logging Errors with Stack Traces

```js
try {
  await someOperation();
} catch (err) {
  logger.error(err);
  // Winston captures err.stack automatically via errors({ stack: true })
}
```

---

## Log Levels

| Level | Priority | Use |
|-------|----------|-----|
| `error` | 0 | Failures that need attention |
| `warn` | 1 | Potential issues |
| `info` | 2 | Normal operation events |
| `http` | 3 | HTTP request logging |
| `verbose` | 4 | Detailed operational info |
| `debug` | 5 | Development debugging |
| `silly` | 6 | Extremely detailed tracing |

Default level is `info`, which includes `error`, `warn`, and `info`.

Set via environment variable:

```bash
LOG_LEVEL=debug npm run dev   # Shows all levels including debug
LOG_LEVEL=error npm start     # Only errors
```
