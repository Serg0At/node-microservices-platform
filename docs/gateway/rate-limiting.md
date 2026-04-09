# Rate Limiting

## Overview

The gateway implements rate limiting at two levels:

1. **Express-level** — global per-IP limit on all HTTP requests via `express-rate-limit`
2. **GraphQL-level** — per-field, per-IP limit via the custom `@rateLimit` directive

---

## Express Rate Limit (Global)

**File:** `src/app.js`

Applied to all routes before they reach Apollo Server:

```js
app.use(
  rateLimit({
    windowMs: config.rateLimit.windowMs,  // default: 60000 (1 minute)
    max: config.rateLimit.max,            // default: 100
    standardHeaders: true,                // RateLimit-* headers in response
    legacyHeaders: false,                 // no X-RateLimit-* headers
  }),
);
```

### Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `RATE_LIMIT_WINDOW_MS` | `60000` | Time window in milliseconds |
| `RATE_LIMIT_MAX` | `100` | Max requests per window per IP |

### Response Headers

When `standardHeaders: true`:

```
RateLimit-Limit: 100
RateLimit-Remaining: 97
RateLimit-Reset: 1709503660
```

When limit exceeded:

```
HTTP 429 Too Many Requests
```

---

## @rateLimit Directive (Per-Field)

**File:** `src/graphql/directives/rate-limit.directive.js`

The custom `@rateLimit` directive provides granular rate limiting per GraphQL field. It is applied in the schema:

```graphql
directive @rateLimit(max: Int!, window: String!) on FIELD_DEFINITION
```

### Usage in Schema

```graphql
type Mutation {
  register(...): AuthPayload!     @rateLimit(max: 5, window: "1m")
  login(...): AuthPayload!        @rateLimit(max: 10, window: "1m")
  forgotPassword(...): MessagePayload! @rateLimit(max: 3, window: "1m")
  resetPassword(...): MessagePayload!  @rateLimit(max: 3, window: "1m")
}
```

### Rate-Limited Fields

| Field | Max | Window | Rationale |
|-------|-----|--------|-----------|
| `register` | 5 | 1 minute | Prevent mass account creation |
| `login` | 10 | 1 minute | Brute-force protection |
| `forgotPassword` | 3 | 1 minute | Prevent email spam |
| `resetPassword` | 3 | 1 minute | Prevent code brute-force |

---

## How It Works

### Window Parsing

The `window` argument supports three time units:

| Format | Example | Milliseconds |
|--------|---------|-------------|
| `Ns` | `"30s"` | 30,000 |
| `Nm` | `"1m"` | 60,000 |
| `Nh` | `"1h"` | 3,600,000 |

Invalid formats default to 60,000ms (1 minute).

### Tracking

Rate limits are tracked in an **in-memory Map** keyed by `fieldName:ip`:

```
Key: "register:192.168.1.1"
Value: { count: 3, start: 1709500000000 }
```

### Algorithm

```
1. Get client IP from context.ip
2. Build key: "{fieldName}:{ip}"
3. Look up entry in rateLimitStore
4. If no entry or window expired → reset counter
5. Increment counter
6. If counter > max → throw RATE_LIMITED error
7. Otherwise → proceed to resolver
```

### Error Response

```json
{
  "errors": [{
    "message": "Too many requests, please try again later",
    "extensions": { "code": "RATE_LIMITED" }
  }]
}
```

---

## Two Layers Working Together

```
Request arrives at Express:

  1. express-rate-limit checks global limit (100/min)
     → If exceeded: HTTP 429 (never reaches Apollo)

  2. @rateLimit directive checks per-field limit
     → If exceeded: GraphQL error { code: "RATE_LIMITED" }

  3. Resolver executes normally
```

The global Express limit acts as a safety net, while the directive provides precise control over sensitive operations.

---

## Limitations

- The `@rateLimit` directive uses **in-memory storage** — counters are lost on server restart
- In a multi-instance deployment, each instance tracks independently (no shared state)
- For production with multiple instances, consider replacing with Redis-backed rate limiting
