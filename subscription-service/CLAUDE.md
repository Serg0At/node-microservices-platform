# Subscription Service — CLAUDE.md

## Overview
Subscription microservice for the Arbex platform. Manages user subscriptions, free trials, plan upgrades with proration, and automatic expiry with grace periods.

## Tech Stack
- Node.js ES modules (type: "module")
- gRPC via @grpc/grpc-js + @grpc/proto-loader
- PostgreSQL via knex
- Redis via ioredis
- RabbitMQ via amqplib
- Joi for validation
- jsonwebtoken (RS256 public key verification)
- opossum circuit breakers
- winston logging

## Port
- gRPC: 50056

## Database
- Table: `subscriptions`
- Sub types: 0=None, 1=Lite, 2=Standard, 3=PRO
- Statuses: active, expired, canceled, terminated
- Issued by: System, Payment, Admin, Promo, User

## gRPC RPCs
1. `GetSubscription` — get current subscription (token required)
2. `CheckAccess` — internal access check (no token, uses user_id)
3. `CreateCheckout` — create payment checkout with proration
4. `CancelSubscription` — cancel active subscription
5. `RestoreSubscription` — restore canceled/expired subscription
6. `AdminSetSubscription` — admin override subscription
7. `GetSubscriptionStats` — admin stats

## RabbitMQ
### Consumed
- `auth-events` exchange → `user.registered` → create trial
- `payment-events` exchange → `payment.succeeded` → activate subscription
- `payment-events` exchange → `payment.refunded` → cancel subscription

### Published (subscription-events exchange)
- `subscription.activated`
- `subscription.expired`
- `subscription.grace_warning`
- `subscription.terminated`
- `subscription.canceled`
- `subscription.reactivated`

## Redis Cache
- `sub:user:{userId}` — TTL 5min
- `sub:stats` — TTL 10min

## Workers
- Expiry worker runs hourly: active→expired→terminated lifecycle

## Commands
```bash
npm run dev          # Development with nodemon
npm start            # Production
npm run migrate      # Create tables
npm run migrate:down # Drop tables
```

## File Structure
```
src/
├── app.js                          # Entry point (IIFE async)
├── bin/server.js                   # gRPC server + graceful shutdown
├── bin/loader.js                   # Proto loader
├── config/                         # Configuration
├── controllers/                    # gRPC handlers
├── middlewares/validations/        # Joi schemas
├── models/                         # Knex models
├── grpc/payment-client.js          # Payment service gRPC client
├── rabbit/                         # RabbitMQ consumer + publisher
├── redis/                          # Redis client + cache ops
├── services/                       # Business logic
├── workers/                        # Expiry worker
└── utils/                          # Logger, error handler, circuit breakers, JWT
```
