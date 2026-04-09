# 🚀 Node Microservices Platform

## Overview

Scalable microservices backend designed to handle high-load distributed systems.

* GraphQL Gateway as a single entry point
* gRPC-based internal communication
* Event-driven architecture (RabbitMQ + Kafka)
* Stateless services with horizontal scaling support
* Production-grade authentication (JWT, 2FA, OAuth)

---

## 🧠 Architecture

Client Applications (Web / Mobile) communicate via HTTPS with a centralized GraphQL Gateway.

Internally:

* Gateway → gRPC → Microservices
* Services communicate asynchronously via message brokers

### Core Components:

* **GraphQL Gateway** — API aggregation layer
* **gRPC Services** — low-latency internal communication
* **RabbitMQ** — real-time service events
* **Kafka** — event streaming & data pipelines
* **Redis** — caching, sessions, idempotency
* **PostgreSQL** — per-service data ownership

---

## ⚙️ Services

* **Auth Service** — JWT (RS256), refresh tokens, 2FA (TOTP), Google OAuth
* **User Service** — profiles, avatars (MinIO)
* **Notification Service** — emails + in-app notifications
* **News Service** — content + full-text search (PostgreSQL GIN)
* **Subscription Service** — plans, trials, billing logic
* **Payment Service** — crypto + card payments, webhook handling
* **Admin Service** — user management, system control

---

## 🧩 Design Decisions

* **GraphQL Gateway**
  Reduces client complexity by aggregating multiple services into a single endpoint

* **gRPC for internal communication**
  Chosen for low latency and strong contracts via Protocol Buffers

* **RabbitMQ vs Kafka**

  * RabbitMQ → service-to-service communication (low latency, routing)
  * Kafka → event streaming & analytics pipelines

* **Stateless services**
  Enables horizontal scaling and easier deployment

---

## 🔒 Security

* JWT access tokens (RS256)
* Opaque refresh tokens stored in Redis
* 2FA using TOTP
* OAuth (Google OIDC)
* Rate limiting via GraphQL directives
* Password hashing (bcrypt)

---

## ⚡ Resilience & Reliability

* Circuit breakers (opossum) for external calls
* Idempotency keys for payment operations
* Fault isolation between services
* Retry strategies for message processing

---

## 📊 Performance

Load tested in local environment using autocannon:

* ~250–400 requests/sec sustained
* ~700 concurrent connections
* Average latency: 45–80ms
* P95 latency: ~120ms

Test scenario:

* Mixed workload (auth + read-heavy queries)
* Redis caching enabled for hot paths

*(Measured using autocannon / k6 in local environment)*

---

## 📦 Tech Stack

* **Runtime:** Node.js (ES Modules)
* **API:** GraphQL (Apollo Server v4), Express
* **Inter-service:** gRPC, Protocol Buffers
* **Database:** PostgreSQL (Knex.js)
* **Cache:** Redis (ioredis)
* **Messaging:** RabbitMQ, Kafka
* **Storage:** MinIO (S3-compatible)
* **Auth:** JWT, bcrypt, TOTP
* **Logging:** Winston
* **Infra:** Docker, Docker Compose

---

## 🚀 Why This Project

This project demonstrates:

* Distributed systems design
* Event-driven architecture
* Scalable backend development
* Production-level authentication & security
* Real-world service decomposition

---

## 🛠️ Getting Started

### 1. Start infrastructure

cd infra
docker compose up -d

### 2. Install dependencies

npm run install:all

### 3. Configure environment

Copy `.env.example` in each service

### 4. Generate RSA keys

(see auth-service setup)

### 5. Run migrations

npm run migrate:all

### 6. Start services

npm run dev

GraphQL endpoint:
http://localhost:4000/graphql

---

## 📁 Project Structure

* graphql-gateway/
* auth-service/
* user-service/
* notification-service/
* news-service/
* subscription-service/
* payment-service/
* admin-service/
* infra/
* docs/

Each service is fully isolated with its own config, database schema, and deployment setup.

---

## 📌 Future Improvements

* Distributed tracing (OpenTelemetry)
* Centralized logging (ELK stack)
* Kubernetes deployment
* Auto-scaling policies
