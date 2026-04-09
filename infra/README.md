# Infrastructure & Deployment

Infrastructure setup and deployment configuration for the Arbex microservices platform.

## Architecture

```text
                    Internet
                       |
                       v  :4000
              ┌─────────────────┐
              │ graphql-gateway │
              └────────┬────────┘
                  gRPC  |
    ┌─────────┬────────┼────────┬──────────┬──────────┐
    v :50051  v :50052 v :50053 v :50054   v :50055   v :50056
 ┌───────┐ ┌──────┐ ┌───────┐ ┌──────┐ ┌───────┐ ┌────────────┐
 │ auth  │ │ user │ │notif. │ │ news │ │ admin │ │subscription│
 └───┬───┘ └──┬───┘ └───┬───┘ └──┬───┘ └───┬───┘ └─────┬──────┘
     |        |         |        |         |            |
     v        v         v        v         v            v
┌──────────────────────────────────────────────────────────────┐
│                   Shared Infrastructure                       │
│  ┌──────────┐ ┌───────┐ ┌──────────────┐ ┌───────┐          │
│  │  Kafka   │ │ Redis │ │  RabbitMQ    │ │ MinIO │          │
│  │  :9092   │ │ :6379 │ │ :5672/:15672 │ │ :9000 │          │
│  └──────────┘ └───────┘ └──────────────┘ └───────┘          │
└──────────────────────────────────────────────────────────────┘
                       |
                       v
              PostgreSQL (Neon — external)

Payment Service (:50057 gRPC + :3001 HTTP webhooks)
```

## Services

| Service | Port | Transport | Description |
|---------|------|-----------|-------------|
| graphql-gateway | 4000 | HTTP | Apollo Server v4 — single entry point for all clients |
| auth-service | 50051 | gRPC | Authentication, JWT, 2FA, OAuth |
| user-service | 50052 | gRPC | User profiles, avatars (MinIO) |
| notification-service | 50053 | gRPC | Email/in-app notifications (SMTP + Handlebars) |
| news-service | 50054 | gRPC | Articles, categories, media (S3/MinIO) |
| admin-service | 50055 | gRPC | Dashboard, user management, proxies to other services |
| subscription-service | 50056 | gRPC | Subscriptions, checkout, promo codes |
| payment-service | 50057 + 3001 | gRPC + HTTP | Crypto (Cryptomus) + card (Fondy) payments |

## Docker Compose Files

| File | Purpose | Usage |
|------|---------|-------|
| `infra/docker-compose.yml` | Infrastructure only (Kafka, Redis, RabbitMQ, MinIO) | Local dev — run infra while services run via `npm run dev` |
| `docker-compose.yml` (root) | Full stack — infra + all application services | Production on VPS / full local testing |

### Local Development

Start only infrastructure, run services with nodemon:

```bash
cd infra
docker compose up -d

# Back in root
npm run dev        # starts services concurrently with nodemon
```

### Full Stack (Production-like)

```bash
# From repo root
docker compose up -d
```

## CI/CD Pipeline (.gitlab-ci.yml)

```text
Push to main / create tag
        |
        v
┌─────────────────────────────────────────┐
│  BUILD stage (parallel)                  │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐│
│  │auth-svc  │ │user-svc  │ │notif-svc ││
│  └──────────┘ └──────────┘ └──────────┘│
│  ┌──────────┐ ┌──────────┐ ┌──────────┐│
│  │admin-svc │ │sub-svc   │ │pay-svc   ││
│  └──────────┘ └──────────┘ └──────────┘│
│  ┌──────────┐ ┌──────────┐             │
│  │news-svc  │ │ gateway  │  → Registry │
│  └──────────┘ └──────────┘             │
└─────────────────────────────────────────┘
        |
        v
┌─────────────────────────────────────────┐
│  DEPLOY stage                            │
│  SSH into VPS →                          │
│    docker compose pull                   │
│    docker compose up -d --remove-orphans │
└─────────────────────────────────────────┘
```

### Triggers

- **Push to `main`** — builds + deploys
- **Git tag** (e.g. `v1.2.0`) — builds + deploys

### Image Tagging

Each build produces two tags:
- `<registry>/<service>:<commit-sha>` — immutable, for rollback
- `<registry>/<service>:latest` — always points to newest

## VPS Setup (One-time)

### 1. Install Docker

```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
```

### 2. Clone and configure

```bash
git clone <your-gitlab-repo> ~/microservices-arbex
cd ~/microservices-arbex
```

### 3. Create .env files

Each service needs a `.env` file with production values:

```bash
cp auth-service/.env.example auth-service/.env
cp user-service/.env.example user-service/.env
cp notification-service/.env.example notification-service/.env
cp news-service/.env.example news-service/.env
cp admin-service/.env.example admin-service/.env
cp subscription-service/.env.example subscription-service/.env
cp payment-service/.env.example payment-service/.env
cp graphql-gateway/.env.example graphql-gateway/.env
```

Key production changes from dev defaults:
- `NODE_ENV=production`
- `REDIS_URL=redis://redis:6379` (container name, not localhost)
- `RABBIT_URL=amqp://admin:admin@rabbitmq:5672` (container name)
- Service URLs use container names: `auth-service:50051`, `user-service:50052`, etc.

### 4. Add JWT keys

```bash
mkdir -p keys
# Copy your access_public.pem and access_private.pem into keys/
```

The `keys/` directory is mounted read-only into containers that need it.

### 5. GitLab CI/CD Variables

Set in **GitLab > Settings > CI/CD > Variables**:

| Variable | Value | Protected | Masked |
|----------|-------|-----------|--------|
| `SSH_PRIVATE_KEY` | Private key content for VPS SSH | Yes | Yes |
| `SSH_KNOWN_HOSTS` | `ssh-keyscan <vps-ip>` output | Yes | No |
| `SSH_USER` | VPS username (e.g. `deploy`) | Yes | No |
| `SSH_HOST` | VPS IP or domain | Yes | No |

## Service Dependencies

```text
graphql-gateway      → auth, user, notification, news, admin, subscription services
admin-service        → news, notification, subscription services + PostgreSQL + Redis
subscription-service → payment-service + PostgreSQL + Redis + RabbitMQ
payment-service      → PostgreSQL + Redis + RabbitMQ + Cryptomus + Fondy
auth-service         → PostgreSQL + Redis + RabbitMQ
user-service         → PostgreSQL + Redis + RabbitMQ + MinIO
notification-service → PostgreSQL + Redis + RabbitMQ + SMTP
news-service         → PostgreSQL + Redis + RabbitMQ + S3/MinIO
```

Infrastructure containers have health checks — application services wait for them before starting.

## Useful Commands

```bash
# View logs for a specific service
docker compose logs -f auth-service

# Restart a single service
docker compose restart graphql-gateway

# Rebuild and restart one service locally
docker compose up -d --build auth-service

# Check container status
docker compose ps

# Run migrations inside a container
docker compose exec auth-service node src/config/knex-migrate.js

# Rollback to a specific image version
TAG=abc1234 docker compose up -d auth-service

# Stop everything
docker compose down

# Stop and remove volumes (destroys Redis/RabbitMQ data)
docker compose down -v
```
