# Deployment Architecture — Arbex Platform

## Services Inventory

### Application Services (~12)
| Service | Port | Nature |
|---|---|---|
| graphql-gateway | 4000 | I/O bound |
| auth-service | 50051 | I/O bound |
| user-service | 50052 | I/O bound |
| notification-service | 50053 | I/O bound |
| news-service | 50054 | I/O bound |
| admin-service | 50055 | I/O bound |
| subscription-service | 50056 | I/O bound |
| payment-service | 50057 | I/O bound |
| scanner-service | 50058 | CPU bound |
| screener-service | 50059 | CPU bound |
| parser-service | 50060 | CPU bound |
| history-service | 50061 | I/O bound |

### Infrastructure Components
| Component | Purpose | RAM |
|---|---|---|
| PostgreSQL | Primary data store (all services, same instance) | 2-4GB |
| Redis | Caching, sessions, ephemeral data | 0.5-1GB |
| RabbitMQ | Service-to-service events (topic exchanges) | 0.5-1GB |
| Kafka | Event streaming (scanner/parser data pipelines) | 2-4GB |
| MinIO | S3-compatible object storage (media files) | 0.5GB |

---

## Phase 1 — MVP (current)

**2 VPS on Hetzner, same datacenter, private network (~0.3ms latency)**

### VPS 1: Infrastructure
**Hetzner CPX41** — 8 vCPU, 16GB RAM, 240GB SSD (~€17/mo)

Runs via docker-compose:
- PostgreSQL :5432
- Redis :6379
- RabbitMQ :5672
- Kafka :9092
- MinIO :9000

**Firewall**: No public ports. Only accepts connections from VPS 2 private IP.

### VPS 2: Application Services
**Hetzner CPX41** — 8 vCPU, 16GB RAM, 240GB SSD (~€17/mo)

Runs via docker-compose:
- All 12 application services
- Caddy/Nginx reverse proxy → gateway :4000 (only public port, HTTPS)

### Network
```
VPS 1 (infra):    10.0.0.2  ← private network only
VPS 2 (services): 10.0.0.3  ← public: 443 only, private: connects to 10.0.0.2
```

### .env on VPS 2
```
PSQL_HOST=10.0.0.2
REDIS_URL=redis://10.0.0.2:6379
RABBIT_URL=amqp://admin:admin@10.0.0.2:5672
```

### Backup Strategy (VPS 1)
```bash
# Cron: daily Postgres dump → Backblaze B2 or S3
0 3 * * * pg_dumpall | gzip | aws s3 cp - s3://backups/pg/$(date +\%F).sql.gz

# Redis RDB snapshot: automatic, backup /data/dump.rdb
```

### Total cost: ~€34/mo

---

## Phase 2 — Growing (hundreds of DAU)

**Same 2 VPS, but move Postgres to managed hosting:**

- Managed Postgres (Hetzner Managed DB / Supabase) for automatic backups, replicas, PITR
- Keep Redis, RabbitMQ, Kafka, MinIO on VPS 1 (ephemeral/recoverable data)
- ~1ms latency to managed DB in same datacenter

---

## Phase 3 — Scale (thousands of DAU)

**3 VPS:**

| VPS | Services | Reason |
|---|---|---|
| VPS 1 | Infra (Postgres, Redis, RabbitMQ, Kafka, MinIO) | Data isolation |
| VPS 2 | API services (gateway, auth, user, news, admin, subscription, payment, notification, history) | I/O bound, stable |
| VPS 3 | Workers (scanner, screener, parser) | CPU bound, can spike without affecting APIs |

**Split trigger**: CPU consistently >70% on VPS 2, or parser/scanner spikes cause gateway latency.

---

## Decision: Local Postgres vs. Neon

**Use local Postgres (on VPS 1).**

| | Local | Neon Launch |
|---|---|---|
| Cost | €0 extra | +$19/mo |
| Latency | 0.3ms (private net) | 5-50ms (internet) |
| Cold starts | None | 100-500ms after idle |
| Storage | 240GB SSD (shared) | 10GB limit |
| Backups | DIY (cron + pg_dump) | Automatic |

With 12 services constantly querying, Neon's free tier compute hours exhaust in ~6h/day. Local Postgres is always warm, zero extra cost.
