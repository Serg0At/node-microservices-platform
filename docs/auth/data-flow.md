# Поток данных 
## 1. Auth Service
###  1.1. GraphQL Gateway → Auth Service (gRPC)
```javascript
RegisterUser(email: "mail@example.com", username: "user123", password_hash: "bcrypt$2b$12$...")
LoginUser(email_username: "user@example.com", password_hash: "bcrypt$2b$12$...")
OIDCLogin(code: "abc123", provider: "google", state: "xyz789")
ForgotPassword(email: "mail@example.com")
VerifyResetCode(email: "mail@example.com", code: "654321")
ResetPassword(email: "mail@example.com", code: "654321", new_pass: "newPassword123")
ChangePassword(old_pass: "oldPassword", new_pass: "newPassword123", access_token: "eyJ...")
Setup2FA(access_token: "eyJ...")
Verify2FA(code: "123456", access_token: "eyJ...")
VerifyEmail(token: "eyJ...")
ValidateAccessToken(access_token: "eyJhbGciOiJSUzI1NiJ9...")
RefreshTokens(refresh_token: "eyJhbGciOiJIUzI1NiJ9...")
```

### 1.2. Auth Service ↔️ PostgreSQL (users)
```sql
INSERT users (
email: "mail@example.com",
username: "user123",
password_hash: "bcrypt$2b$12$...", 
created_at: "2025-12-09T21:30:00Z"
)

SELECT 
password_hash: "bcrypt$2b$12$..." 
FROM users WHERE email="mail@example.com"
UPDATE users SET password_hash="bcrypt$new_hash", updated_at="2025-12-09T21:31:00Z" WHERE id=123

SELECT
id:123, 
email:"mail@example.com", 
subscription_id:"sub1" FROM users WHERE id=123
```

### 1.3. Auth Service ↔️ Redis
```json
// Refresh-токен (opaque, 30 дней)
refresh:a3f8b2c1d4e5f6... → {"user_id":123,"device":"sha256(UA)","expires_at":1711192000000} // [TTL=2592000s]

// Обратный индекс для очистки старых токенов при повторном логине
device_token:123:sha256(UA) → "a3f8b2c1d4e5f6..." // [TTL=2592000s]

// Активные устройства пользователя (fingerprint по User-Agent)
user_sessions:123 → [
  "sha256(Chrome/120.0)",
  "sha256(Safari/17.0)"
]  // [TTL=604800s] ~ 7 дней

// Коды сброса пароля (email захэширован для privacy)
reset_codes:sha256("mail@example.com") → {
  "code": "654321",
  "userId": 123,
  "exp": 1734103999
} // [TTL=900s]

// Кэш профиля пользователя
user_cache:123 → {
  "email": "mail@example.com",
  "subscription": "PRO"
} // [TTL=300s]
```

### 1.4. Auth Service → RabbitMQ (auth-events.subscription, fanout)/Subcription Service

#### 1.4.1. auth-events.subcription.user.registered
```json
{
    "user_id":123,
    "email":"user@example.com",
    "ts":1734103999
}
```

### 1.5 Auth Service → RabbitMQ (auth-events.notification, topics)/Notification Service

#### 1.5.1. *user.registered
```json
{
    "user_id":123,
    "email":"mail@example.com",
    "ts":1734103999
}
```

#### 1.5.2. *user.logged_in
```json
 {
    "user_id":123,
    "device":"Chrome/120.0",
    "ts":1734103999
 }
 ```

#### 1.5.3. *user.password_changed
```json
{
    "user_id":123,
    "ts":1734103999
}
```

#### 1.5.4. *user.profile_updated
```json
{
    "user_id":123,
    "field":"email",
    "old":"old@example.com",
    "ts":1734103999
}
```

#### 1.5.5. *user.verify_email
```json
{
    "user_id":123,
    "email":"mail@example.com",
    "ts":1734103999
}
```

### 1.6 Auth Service → GraphQL Gateway (gRPC Response Data)

#### 1.6.1. RegisterUser → RegisterUserResponse
```json
{
  "success": true,
  "user": {
    "id": 123,
    "email": "mail@example.com",
    "username": "user123"
  },
  "access_token": "eyJhbGciOiJSUzI1NiJ9...",  // JWT
  "refresh_token": "eyJhbGciOiJIUzI1NiJ9...",
  "token_type": "Bearer",
  "expires_in": 3600
}
```

#### 1.6.2. LoginUser → LoginUserResponse
```json
{
  "success": true,
  "user": 
  {
    "id": 123,
    "email": "mail@example.com",
    "username": "user123",
    "subscription": "PREMIUM"
  },
  "access_token": "eyJhbGciOiJSUzI1NiJ9...",
  "refresh_token": "eyJhbGciOiJIUzI1NiJ9...",
  "expires_in": 3600
}
```

#### 1.6.3. OIDCLogin → OIDCLoginResponse
```json
{
  "success": true,
  "user": {
    "id": 123,
    "email": "mail@gmail.com",
    "external_id": "google_123456789",
    "provider": "google"
  },
  "access_token": "eyJhbGciOiJSUzI1NiJ9...",
  "id_token": "eyJhbGciOiJSUzI1NiJ9...",     // OIDC-specific
  "refresh_token": "eyJhbGciOiJIUzI1NiJ9..."
}
```

#### 1.6.4. ResetPassword → ResetPasswordResponse
```json
{
  "success": true,
  "message": "Password updated successfully"
}
```

#### 1.6.5. ForgotPassword → ForgotPasswordResponse
```json
{
  "success": true,
  "message": "Reset code sent to mail@example.com"
}
```

#### 1.6.6. Setup2FA → Setup2FASuccess
```json
{
  "success": true,
  "qr_code": "otpauth://totp/AuthService:user123?secret=JBSWY3DPEHPK3PXP&issuer=AuthService",
  "secret": "JBSWY3DPEHPK3PXP",
  "backup_codes": "12345678"
}
```

#### 1.6.7. Verify2FA → Verify2FAResponse
```json
{
  "success": true,
  "message": "2FA enabled successfully",
  "access_token": "eyJhbGciOiJSUzI1NiJ9..."  // Новый токен с acr=2
}
```

#### 1.6.8. VerifyEmail → VerifyEmailResponse
```json
{
  "success": true,
  "message": "Email verified successfully"
}
```

#### 1.6.9. ValidateAccessToken → ValidateAccessTokenResponse
```json
{
  "valid": true,
  "user": {
    "id": 123,
    "email": "user@example.com",
    "roles": ["user", "pro"],
    "subscription": {
      "id": "sub1",
      "type": "pro",
      "status": "active",
      "expires_at": 1736822399
    },
    "session": {
      "device": "Chrome/120.0",
      "active": true,
      "last_seen": 1734103999
    }
  }
}
```

#### 1.6.10. RefreshTokens → RefreshTokensResponse
```json
{
  "access_token": "eyJhbGciOiJSUzI1NiJ9...",   // Новый access
  "refresh_token": "eyJhbGciOiJIUzI1NiJ9...", // Новый refresh (ротация)
  "expires_in": 3600,
  "token_type": "Bearer"
}
```


## 2. Parser Service

### 2.1. API-exchanges –> Parser Service

Получает данные с бирж, огромный объем json файлов, должен обраотать эти данные и взять только основные 

### 2.2. Parser Service -> RabbitMQ(Direct exchange)/Screener Service

#### **2.2.1. markets**
```json
{
    "exchange": "binance",
    "ts": 1735689123456,
    "markets": [
                {
        "id": "AIUSDT",
        "symbol": "AI/USDT",
        "base": "AI",
        "quote": "USDT",
        "baseId": "ai",
        "quoteId": "usdt",
        "type": "spot",
        "active": true,
        "precision": { "price": 0.0001, "amount": 0.01 },
        "limits": {
        "amount": { "min": 0.01, "max": 1000000 },
        "price": { "min": 0.0001, "max": null },
        "cost": { "min": 1, "max": null }
        },
        "taker": 0.001,
        "maker": 0.0008,
        "contractSize": 1,
        "info": { "contractAddress": "0x...", "coinId": "ai", "network": "ERC20" }
    }]
}
```
#### **2.2.2. ticker**
```json
{
    "exchange":"binance",
    "symbol":"AI/USDT",
    "ts": 1735689123456,
    "datetime":"2025-12-01T12:34:56.789Z",
    "last":1.2345,
    "high":1.2980,
    "low":1.1800,
    "volume":1254321.5,
    "quoteVolume":1543210.8,
    "change":0.045,
    "percentage":3.78,
    "bid":1.2340,
    "ask":1.2350
}
```
#### **2.2.3. orderbook**
```json
{
    "exchange":"binance",
    "symbol":"AI/USDT",
    "ts": 1735689123456,
    "bids": [[1.234, 3.5], [1.2335, 1.2], ...],
    "asks": [[1.235, 2.1], [1.2355, 4.0], ...],
    "nonce": 123456789
}
```

## 3. Screener Service

### 3.1. Parser service/RabbitMQ(Direct exchange) –> Screener Service

#### **3.1.1. markets**
```json
{
    "transaction_id": 1,
    "exchange": "binance",
    "ts": 1735689123456,
    "markets": [
                {
        "id": "AIUSDT",
        "symbol": "AI/USDT",
        "base": "AI",
        "quote": "USDT",
        "baseId": "ai",
        "quoteId": "usdt",
        "type": "spot",
        "active": true,
        "precision": { "price": 0.0001, "amount": 0.01 },
        "limits": {
        "amount": { "min": 0.01, "max": 1000000 },
        "price": { "min": 0.0001, "max": null },
        "cost": { "min": 1, "max": null }
        },
        "taker": 0.001,
        "maker": 0.0008,
        "contractSize": 1,
        "info": { "contractAddress": "0x...", "coinId": "ai", "network": "ERC20" }
    }]
}
```
#### **3.1.2. ticker**
```json
{
    "transaction_id": 1,
    "exchange":"binance",
    "symbol":"AI/USDT",
    "ts": 1735689123456,
    "last":1.2345,
    "high":1.2980,
    "low":1.1800,
    "volume":1254321.5,
    "quoteVolume":1543210.8,
    "change":0.045,
    "percentage":3.78,
    "bid":1.2340,
    "ask":1.2350
}
```
#### **3.1.3. orderbook**
```json
{
    "transaction_id": 1,
    "exchange":"binance",
    "symbol":"AI/USDT",
    "ts": 1735689123456,
    "bids": [[1.234, 3.5], [1.2335, 1.2], ...],
    "asks": [[1.235, 2.1], [1.2355, 4.0], ...],
    "nonce": 123456789
}
```

### 3.2. Screener service –> RabbitMQ(Direct exchange)/Fork Service

#### **3.2.1. ActiveScannerFork(максимальный размер очереди 1)**
```json
{
        "id": 1,
        "transaction_id": 1,
        "pair": "BTC/USDT",
        "buy_exchange": "binance",
        "sell_exchange": "bybit",
        "buy_price": 1.2,
        "sell_price": 1.8, 
        "spread" : 12, 
        "profit": 0.6,
        "commission": 1.2, 
        "liquidity_depth": 1,
        "leverage": 5,
        "detected_at": 1678886400,
        "expired_at": 1678886400,
        "created_at": 1678886400, 
        "updated_at": 1678886400,
}   
```

#### **3.2.2. ActiveScreenerFork(максимальный размер очереди 1)**
```json
{
  "id": 1,
  "transaction_id": 1,
  "symbol": "BTC/USDT",
  "exchange": "binance",
  "interval": "1m",
  "indicator_name": "RSI",
  "value": 75.5,
  "threshold": 70.0,
  "alert_type": "overbought",
  "change_percent": 3.78,
  "volume": 1254321.5,
  "volatility": 0.045,
  "detected_at": 1735689123456,
  "expired_at": null,
  "created_at": 1735689123456,
  "updated_at": 1735689123456
}
```

### 3.3. Screener Service —> RabbitMQ(Direct)/History Service

#### **3.3.1. ScannerForks**

```json
{
    "id": 1,
    "transaction_id": 1,
    "pair": "BTC/USDT",
    "buy_exchange": "binance",
    "sell_exchange": "bybit",
    "buy_price": 1.2,
    "sell_price": 1.8, 
    "spread" : 12, 
    "profit": 0.6,
    "commission": 1.2, 
    "liquidity_depth": 1,
    "leverage": 5,
    "detected_at": 1678886400,
    "expired_at": 1678886400,
    "created_at": 1678886400, 
    "updated_at": 1678886400,
}
```

#### **3.3.2. ScreenerForks**
```json
{
  "id": 1,
  "transaction_id": 1,
  "symbol": "BTC/USDT",
  "exchange": "binance",
  "interval": "1m",
  "indicator_name": "RSI",
  "value": 75.5,
  "threshold": 70.0,
  "alert_type": "overbought",
  "change_percent": 3.78,
  "volume": 1254321.5,
  "volatility": 0.045,
  "detected_at": 1735689123456,
  "expired_at": null,
  "created_at": 1735689123456,
  "updated_at": 1735689123456
}
```

## 4. Fork Service

### 4.1. Screener Service/RabbitMQ(Direct exchange) –> Fork Service

#### **4.1.1. ActiveScannerFork(максимальный размер очереди 1)**
```json
{
        "id": 1,
        "transaction_id": 1,
        "pair": "BTC/USDT",
        "buy_exchange": "binance",
        "sell_exchange": "bybit",
        "buy_price": 1.2,
        "sell_price": 1.8, 
        "spread" : 12, 
        "profit": 0.6,
        "commission": 1.2, 
        "liquidity_depth": 1,
        "leverage": 5,
        "detected_at": 1678886400,
        "expired_at": 1678886400,
        "created_at": 1678886400, 
        "updated_at": 1678886400,
}   
```

#### **4.1.2. ActiveScreenerFork(максимальный размер очереди 1)**
```json
{
  "id": 1,
  "transaction_id": 1,
  "symbol": "BTC/USDT",
  "exchange": "binance",
  "interval": "1m",
  "indicator_name": "RSI",
  "value": 75.5,
  "threshold": 70.0,
  "alert_type": "overbought",
  "change_percent": 3.78,
  "volume": 1254321.5,
  "volatility": 0.045,
  "detected_at": 1735689123456,
  "expired_at": null,
  "created_at": 1735689123456,
  "updated_at": 1735689123456
}
```

### 4.2. GraphQL Gateway –> Fork Service

#### **4.2.1.Validate access**
```proto
ValidateForkAccess(access_token)
```

#### **4.2.2. Отправка вилок**
1. Если у пользователя подписка Lite, то используем  
```proto
rpc GetCurrentForks(GetCurrentForksRequest) returns (GetCurrentForksResponse) {}
```
2. Если у пользователя подписка выше Lite, то устанавливаем websocket подключение
```proto
rpc SubscribeForks(SubscribeForksRequest) returns (stream ForkStreamResponse) {}
```

#### **4.2.3. Получение активной вилки**
```proto
rpc GetActiveFork() returns (ArbitrageFork) {}
```

### 4.3. Fork Service –> GraphQL Gateway

#### **4.3.1. Отправка сканнер вилки по gRPC server-streaming**
```proto
message SubscribeForksRequest {
  repeated string symbols = 1;
  repeated string exchanges = 2;
  double min_spread_percent = 3;
  double min_profit_usdt = 4;
  double min_liquidity_usdt = 5;
  int32 min_leverage = 6;
}

message ArbitrageFork { /* те же поля, что выше */ }

message ForkExpired {
  int64 fork_id     = 1;
  int64 expired_at  = 2;
}

message StreamEvent {
  oneof event {
    ArbitrageFork fork     = 1;
    ForkExpired  expired   = 2;
  }
}

service ForkService {
  // Premium — настоящий реал-тайм через gRPC server streaming
  rpc SubscribeForks(SubscribeForksRequest) returns (stream StreamEvent) {}
}
```

#### **4.3.2. Отправка сканнер вилки по gRPC для пользователей с Lite**
```proto
message GetCurrentForksRequest {
  repeated string symbols = 1;              // например ["BTC/USDT", "ETH/USDT"]
  repeated string exchanges = 2;
  double min_spread_percent = 3;            // ≥ 0.5
  double min_profit_usdt = 4;               // ≥ 10
  double min_liquidity_usdt = 5;
  int32 min_leverage = 6;
}

message ArbitrageFork {
  int64   id                = 1;
  string  pair              = 2;  // "BTC/USDT"
  string  buy_exchange      = 3;
  string  sell_exchange     = 4;
  double  buy_price         = 5;
  double  sell_price        = 6;
  double  spread_percent    = 7;
  double  net_profit_usdt   = 8;
  double  liquidity_usdt    = 9;
  int32   leverage          = 10;
  int64   detected_at       = 11 [json_name = "detected_at"];
  int64   expired_at        = 12 [json_name = "expired_at"]; // 0 = активна
}

message GetCurrentForksResponse {
  repeated ArbitrageFork forks       = 1;
  google.protobuf.Timestamp snapshot_at = 2;
}

service ForkService {
  rpc GetCurrentForks(GetCurrentForksRequest) returns (GetCurrentForksResponse) {}
  }
```

### 4.4. Fork Service –> Redis(DB active fork)
```redis
# Основной хэш — единственный источник правды
HSET fork:8421 \
  id               "8421" \
  pair             "BTC/USDT" \
  buy_exchange     "binance" \
  sell_exchange    "bybit" \
  buy_price        "68234.50" \
  sell_price       "68689.00" \
  spread_percent   "0.67" \
  net_profit_usdt  "28.40" \
  liquidity_usdt   "12400" \
  leverage         "5" \
  detected_at      "1735689123000" \
  last_seen        "1735689185000"   ← КЛЮЧЕВОЕ ПОЛЕ! Обновляется при КАЖДОМ тике
```


## 5. History service

### 5.1. Screener Service/RabbitMQ(Direct exchange) –> History service

#### **5.1.1. ScannerForks**
```json
{
    "id": 1,
    "transaction_id": 1,
    "pair": "BTC/USDT",
    "buy_exchange": "binance",
    "sell_exchange": "bybit",
    "buy_price": 1.2,
    "sell_price": 1.8, 
    "spread" : 12, 
    "profit": 0.6,
    "commission": 1.2, 
    "liquidity_depth": 1,
    "leverage": 5,
    "detected_at": 1678886400,
    "expired_at": 1678886400,
    "created_at": 1678886400, 
    "updated_at": 1678886400,
}
```

#### **5.1.2. ScreenerForks**
```json
{
  "id": 1,
  "transaction_id": 1,
  "symbol": "BTC/USDT",
  "exchange": "binance",
  "interval": "1m",
  "indicator_name": "RSI",
  "value": 75.5,
  "threshold": 70.0,
  "alert_type": "overbought",
  "change_percent": 3.78,
  "volume": 1254321.5,
  "volatility": 0.045,
  "detected_at": 1735689123456,
  "expired_at": null,
  "created_at": 1735689123456,
  "updated_at": 1735689123456
}
```

### 5.2. History service –> PostgreSQL
```sql
-- 1. Новая вилка → INSERT + сразу SELECT
INSERT INTO fork_scanner (
    id, transaction_id, pair, buy_exchange, sell_exchange,
    buy_price, sell_price, spread, profit, commission,
    liquidity_depth, leverage, detected_at
) VALUES (
    8421, 9001, 'BTC/USDT', 'binance', 'bybit',
    68234.5678, 68689.1234, 0.667, 28.40, 2.10,
    12400.00, 5, '2025-12-09T21:30:15.123Z'
)
RETURNING id, pair, spread, profit, detected_at;

-- 2. Обновление вилки (цена изменилась)
INSERT INTO fork_scanner (id, buy_price, sell_price, spread, profit, updated_at)
VALUES (8421, 68250.00, 68710.00, 0.674, 29.10, NOW())
ON CONFLICT (id) DO UPDATE SET
    buy_price = EXCLUDED.buy_price,
    sell_price = EXCLUDED.sell_price,
    spread = EXCLUDED.spread,
    profit = EXCLUDED.profit,
    updated_at = NOW()
RETURNING id, spread, profit;

-- 3. Запись индикаторов
INSERT INTO screener_indicators (
    fork_id, symbol, exchange, interval, indicator_name, value, threshold, alert_type, detected_at
) VALUES
    (8421, 'BTC/USDT', 'binance', '1m', 'RSI', 74.82, 70.0, 'overbought', '2025-12-09T21:30:15Z'),
    (8421, 'BTC/USDT', 'binance', '1m', 'volume_spike', 3.8, 3.0, 'volume_spike', '2025-12-09T21:30:15Z');

-- 4. Вилка закрылась
UPDATE fork_scanner
SET expired_at = '2025-12-09T21:35:42.567Z', updated_at = NOW()
WHERE id = 8421 AND expired_at IS NULL
RETURNING id, pair, profit, detected_at, expired_at;
```

### 5.3. GraphQL Gateway -> History Service

#### **5.3.1. Запрос истории вилок**
```proto
rpc GetForksHistory(GetForksHistoryRequest) returns (GetForksHistoryResponse) {}
```

#### **5.3.2. Получение одной вилки**
```proto
rpc GetFork(GetForkRequest) returns (HistoricalFork) {}
```

### 5.4. History Service –> GraphQL Gateway
```proto
// Детальное описание proto для истории вилок
message GetForksHistoryRequest {
  // Фильтры (все опциональные)
  repeated string symbols = 1;                    // ["BTC/USDT", "ETH/USDT"]
  repeated string buy_exchanges = 2;
  repeated string sell_exchanges = 3;
  double min_spread_percent = 4;                  // ≥ 0.5
  double max_spread_percent = 5;
  double min_profit_usdt = 6;                     // ≥ 10
  double max_profit_usdt = 7;
  int32 min_leverage = 8;
  bool only_closed = 9;                           // true = только expired_at IS NOT NULL
  bool include_indicators = 10;                   // true = присоединить screener_indicators

  // Пагинация
  int32 limit = 20;                               // default 50, max 500
  int32 offset = 21;

  // Временной диапазон
  google.protobuf.Timestamp from_time = 22;       // detected_at >=
  google.protobuf.Timestamp to_time = 23;         // detected_at <=
}

// Одна историческая вилка
message HistoricalFork {
  int64 id = 1;
  int64 transaction_id = 2;
  string pair = 3;
  string buy_exchange = 4;
  string sell_exchange = 5;
  double buy_price = 6;
  double sell_price = 7;
  double spread_percent = 8;
  double profit_usdt = 9;
  double commission_usdt = 10;
  double liquidity_depth_usdt = 11;
  int32 leverage = 12;

  google.protobuf.Timestamp detected_at = 13;     // когда впервые увидели
  google.protobuf.Timestamp expired_at = 14;      // NULL = была активна на момент выгрузки
  google.protobuf.Timestamp created_at = 15;
  google.protobuf.Timestamp updated_at = 16;

  // Присоединённые индикаторы (если include_indicators=true)
  repeated IndicatorSnapshot indicators = 17;
}

// Индикатор, который был в момент вилки
message IndicatorSnapshot {
  string symbol = 1;
  string exchange = 2;
  string interval = 3;                            // 1m, 1h и т.д.
  string indicator_name = 4;                      // RSI, SMA_20, volume_spike
  double value = 5;
  double threshold = 6;
  string alert_type = 7;                          // overbought, ma_cross и т.д.
  google.protobuf.Timestamp detected_at = 8;
}

// Ответ
message GetForksHistoryResponse {
  repeated HistoricalFork forks = 1;
  int64 total_count = 2;                          // для пагинации
  google.protobuf.Timestamp generated_at = 3;
}

service HistoryService {
  // Основной эндпоинт — и gRPC, и REST одновременно
  rpc GetForksHistory(GetForksHistoryRequest) returns (GetForksHistoryResponse) {}

  // Получение одной вилки
  rpc GetFork(GetForkRequest) returns (HistoricalFork) {}

  // Опционально: отдельный эндпоинт только с индикаторами по fork_id
  rpc GetForkIndicators(GetForkIndicatorsRequest) returns (GetForkIndicatorsResponse) {}
}

message GetForkRequest {
  int64 fork_id = 1;
  bool include_indicators = 2;  // опционально, присоединить индикаторы
}

message GetForkIndicatorsRequest {
  int64 fork_id = 1;
}

message GetForkIndicatorsResponse {
  repeated IndicatorSnapshot indicators = 1;
}
```
