# Auth Service --- Обновленное ТЗ

## 1. Предназначение

Сервис отвечает за управление **Core Entity `User`** и её Supporting
Entities (`UserOAuth`, `User2FA`).\
Обрабатывает **gRPC-вызовы** от GraphQL Gateway для регистрации,
аутентификации, OAuth/2FA.\
Публикует события в **RabbitMQ** для других Core Entities
(**Subscription**, **Notification**).

## 2. Основная функциональность

### 2.1. Регистрация пользователя (`RegisterUser`)

**Процесс:**
1. Принимает gRPC: `email`, `username`, `password_hash`, `fingerprint`, `ip`.
2. **Layer 4:** Email normalization (Gmail dot-removal, alias stripping).
3. **Layer 3:** Disposable email blocking (`disposable-email-domains` package).
4. Conflict check: email + username uniqueness.
5. **Layer 1 & 2:** Trial abuse detection — checks `fingerprint` and `ip` against Redis:
   - `trial_devices:{sha256(fp)}` — 365-day TTL
   - `trial_ips:{sha256(ip)}` — 30-day TTL
   - Builds `trial_signals: { fingerprint_seen, ip_seen, disposable_email }`.
6. `INSERT` в таблицу `users`:
`id: auto    username: "user123"    email: "mail@example.com"    password_hash: BYTEA    role: 0    is_active: FALSE    created_at/updated_at: NOW()`
7. Stores trial tracking keys in Redis (fingerprint + IP hashes).
8. Генерирует verify-token → `Redis verify_token:{token}`.
9. Генерирует JWT с `sub_type: 0` (no subscription).
10. Публикует событие:\
**auth-events.subscription.user.registered → Subscription Service** (trial).\
Payload включает `trial_signals` — Subscription Service uses them to set trial duration (15 days clean / 3 days suspicious).
11. Возвращает **JWT + UserPayload**.

> See [trial-abuse-prevention.md](trial-abuse-prevention.md) for full detection details.
  
### 2.2. Аутентификация (`LoginUser`)
1.`SELECT password_hash FROM users WHERE email=? OR username=?`
2.  `Сравнение bcrypt`.
3.  `UPDATE users SET last_login=NOW()`
4.  Генерация JWT:
    -   `access_token`: 15m\
    -   `refresh_token`: 15d\
    -   `ua_hash`
5.  Redis:

        user_sessions:{user_id} → ADD sha256(User-Agent)

6.  `Возвращает UserPayload + tokens`.

### 2.3. OAuth 2.0 (`OIDCLogin`)

**Процесс:** 1. Обмен `code` → Google tokens → `external_id`, `email`.
2. UPSERT в `UserOAuth`:
`user_id, provider: "google",    external_id: "google_123",    access_token: ENCRYPTED,    expires_at`
3. Поиск/создание User по `external_id`/`email`. 4. Возврат JWT +
id_token.

### 2.4. 2FA Management (`Setup2FA`, `Verify2FA`)

#### Setup2FA

- Генерация TOTP-секрета → QR code.
- `INSERT INTO user_2fa`:
    -`secret`: KMS.ENCRYPT(secret)\
    -`backup_codes`: JSONB

#### Verify2FA

- `TOTP.validate(code, KMS.DECRYPT(secret))`
- `UPDATE users SET is_2fa_enabled=TRUE`

### 2.5. JWT Validation (`ValidateAccessToken`)

1. `jwt.Verify(signature, exp, ua_hash)` — gateway validates locally with public key
2. `Redis SISMEMBER user_sessions:{user_id}` → 401
3. `Redis HGETALL user_cache:{user_id}`\
    или SELECT из БД
4. Возвращает **ValidatedUser**\
    `(id, email, role, sub_type, subscription_id)`

> JWT payload includes `sub_type` (0=None, 1=Lite, 2=Standard, 3=PRO). Auth service keeps it in sync via subscription-events consumer (see section 6).

### 2.6. Refresh & Logout

**RefreshTokens:** - Проверяет opaque refresh token в Redis - Выдаёт новую пару - Выполняет
ротацию (старый удаляется, новый создаётся)

**Logout:**

    Redis DEL refresh:{token}

## 3. Модель данных (PostgreSQL)

### 3.1. Core Entity: users

```sql
| id | BIGSERIAL | PRIMARY KEY |
| username | VARCHAR(32) | UNIQUE NOT NULL |
| email | VARCHAR(255) | UNIQUE NOT NULL |
| password_hash | BYTEA | NOT NULL |
| role | SMALLINT | DEFAULT 0 CHECK (0,1) |
| is_active | BOOLEAN | DEFAULT FALSE |
| banned_at | TIMESTAMPTZ | NULL |
| ban_reason | TEXT | NULL |
| avatar_url | TEXT | NULL |
| last_login | TIMESTAMPTZ | NULL |
| created_at/updated_at | TIMESTAMPTZ | DEFAULT NOW()
```

Индексы: email, username, role, last_login DESC.

### 3.2. Supporting: user_oauth

```sql
| id | BIGSERIAL | PK |
| user_id | BIGINT | REFERENCES users CASCADE |
| provider | VARCHAR(32) | CHECK('google','apple') |
| external_id | VARCHAR(255) | NOT NULL |
| access_token | TEXT | NULL (encrypted) |
| refresh_token | TEXT | NULL (encrypted) |
| expires_at | TIMESTAMPTZ | NULL |
```

Индексы: UNIQUE(user_id), provider, expires_at.

### 3.3. Supporting: user_2fa

```sql
| id | BIGSERIAL | PK |
| user_id | BIGINT | UNIQUE REFERENCES users CASCADE |
| secret | TEXT | NULL (KMS encrypted) |
| backup_codes | JSONB | NULL |
| enabled | BOOLEAN | DEFAULT FALSE |
```

## 4. Redis ключи

``` json
refresh:{token} → {"user_id","device","expires_at"} [TTL=30d]
device_token:{user_id}:{ua_hash} → refresh_token [TTL=30d]
user_sessions:{user_id} → Set[ua_hashes] [TTL=7d]
reset_codes:sha256(email) → {"code":"654321","userId":123,"exp":1734103999} [TTL=15m]
user_cache:{user_id} → {"email":"...","role":0,"subscription_id":"sub1"} [TTL=5m]
verify_token:{token} → {"userId":123,"email":"..."} [TTL=24h]
trial_devices:{sha256(fingerprint)} → user_id [TTL=365d]
trial_ips:{sha256(ip)} → user_id [TTL=30d]
user_sub_type:{user_id} → sub_type (0-3) [TTL=none, updated via subscription events]
```

## 5. gRPC API (кратко)

| Метод | Request | Response |
|-------|---------|----------|
| RegisterUser | email,username,password_hash,fingerprint,ip | success,UserPayload,access_token,refresh_token |
| LoginUser | email_username,password_hash | success,UserPayload,access_token,refresh_token |
| OIDCLogin | code,provider,state | success,OIDCUserPayload,access_token,id_token |
| RefreshTokens | refresh_token | access_token,refresh_token |
| ForgotPassword | email | success,message |
| VerifyResetCode | email,code | success,message |
| ResetPassword | email,code,new_pass | success,message |
| ChangePassword | old_pass,new_pass,access_token | success,message |
| VerifyEmail | token | success,message |

## 6. RabbitMQ

### 6.1. Published events (auth-events exchange)

    auth-events.subscription.user.registered → Subscription Service (trial)
    auth-events.notification.user.* → Notification Service (welcome, alerts)

Payload (`user.registered`):

``` json
{
  "user_id": 123,
  "email": "mail@example.com",
  "username": "user123",
  "verification_token": "abc123...",
  "trial_signals": {
    "fingerprint_seen": false,
    "ip_seen": false,
    "disposable_email": false
  },
  "ts": 1734103999
}
```

### 6.2. Consumed events (subscription-events exchange)

Auth service consumes `subscription.*` events to keep `sub_type` in sync for JWT:

| Routing Key | Action |
|-------------|--------|
| `subscription.activated` | Set `user_sub_type:{user_id}` = payload `sub_type` |
| `subscription.reactivated` | Set `user_sub_type:{user_id}` = payload `sub_type` |
| `subscription.terminated` | Reset `user_sub_type:{user_id}` = 0 |
| `subscription.canceled` | No change (user retains access until `ended_at`) |
| `subscription.expired` | No change (user retains access during grace period) |

## 7. Связи с другими Core Entities

| Core Entity | Связь | Механизм |
|-------------|-------|----------|
| Subscription | users.subscription_id | Логическая (event-driven) |
| Notification | notifications.user_id | Event: auth-events.notification.* |
| Payment | Через Subscription | Event-driven |
