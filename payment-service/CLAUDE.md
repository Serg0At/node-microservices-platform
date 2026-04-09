# Payment Service

## Overview
Payment microservice handling crypto (Cryptomus) and card (Fondy) payments with webhook processing and RabbitMQ event publishing.

## Tech Stack
- Node.js ES modules, gRPC (port 50057), Express HTTP webhooks (port 3001)
- PostgreSQL via knex, Redis via ioredis, RabbitMQ via amqplib
- Joi validation, opossum circuit breakers, winston logging

## Commands
- `npm run dev` — development with nodemon
- `npm start` — production
- `npm run migrate` — create tables
- `npm run migrate:down` — drop tables

## Architecture
- gRPC: CreatePayment, GetTransaction, ListTransactions
- HTTP: POST /webhook/cryptomus, POST /webhook/fondy
- RabbitMQ: publishes payment.succeeded, payment.failed, payment.refunded to payment-events exchange
- Redis: idempotency keys for webhook deduplication (24h TTL)

## Database
- Single `transactions` table with CHECK constraints on provider, status, plan_type

## Providers
- Cryptomus: crypto payments, MD5 signature verification
- Fondy: card payments, SHA1 signature verification
