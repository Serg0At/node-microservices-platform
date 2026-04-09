# News Service — Technical Specification

## 1. Purpose

Manages publication, storage, and retrieval of news articles and blog content. Handles gRPC calls from the GraphQL gateway. Admin-only publishing — users are read-only consumers.

## 2. Core Functionality

### 2.1 Content Management (Admin Only)

- Create articles with type (`blog` or `news`)
- Delete articles permanently (no edit/update, no drafts, no archive)
- Auto-generated unique slugs from titles
- Cover image upload via pre-signed S3 URLs

### 2.2 Content Retrieval (Public)

- Paginated article listing ordered by `published_at` descending (no filters)
- Full-text search via PostgreSQL GIN index (title + content)
- Single article fetch by ID or slug (increments view count)

### 2.3 Dashboard Stats (Admin Only)

- Total article count (overall, by type: blog/news)
- Total view count across all articles

### 2.4 Caching (Redis)

- Individual articles cached for 15 minutes
- Latest lists cached for 5 minutes
- Search results cached for 5 minutes (MD5-hashed key)
- Cache invalidated on article create or delete

### 2.5 Media (Admin Only)

- Pre-signed S3 PUT URLs for client-side uploads
- Supported types: JPEG, PNG, WebP, GIF
- Files stored under `articles/{articleId|general}/{timestamp}-{filename}`
- S3 bucket: `news-media-bucket`

### 2.6 Audit Logging

- Admin actions (article create/delete) logged as structured JSON via Winston
- Fields: `action`, `admin_id`, `article_id`, `title`
- Designed for Filebeat ingestion into centralized logging

## 3. Data Model (PostgreSQL)

### 3.1 `articles` table

| Column          | Type        | Description                  |
| --------------- | ----------- | ---------------------------- |
| id              | bigserial   | Primary key                  |
| title           | text        | Article title                |
| slug            | text        | URL-friendly slug (unique)   |
| content         | text        | Body content                 |
| author_id       | bigint      | Admin user ID who created it |
| type            | text        | `'blog'` or `'news'`        |
| cover_image_url | text        | Cover image URL (nullable)   |
| view_count      | bigint      | View counter (default: 0)    |
| published_at    | timestamptz | Set to `now()` on creation   |
| created_at      | timestamptz | Row creation time            |
| updated_at      | timestamptz | Last update time             |

**Indexes:**

- `articles_slug_unique` — B-tree unique on `slug`
- `idx_articles_author_id` — B-tree on `author_id`
- `idx_articles_type` — B-tree on `type`
- `idx_articles_published_at` — B-tree DESC NULLS LAST on `published_at`
- `idx_articles_fts` — GIN on `to_tsvector('english', title || content)`

**Constraints:**

- `CHECK (type IN ('blog', 'news'))`

## 4. gRPC API (proto/news.proto)

### Article RPCs

| RPC            | Auth Required | Description                               |
| -------------- | ------------- | ----------------------------------------- |
| CreateArticle  | Admin only    | Create new article (type: blog/news)      |
| DeleteArticle  | Admin only    | Permanently delete article                |
| GetArticle     | No            | Get by ID or slug (increments view count) |
| ListArticles   | No            | Paginated list (page, limit only)         |
| SearchArticles | No            | Full-text search (query, page, limit)     |

### Media RPCs

| RPC          | Auth Required | Description                  |
| ------------ | ------------- | ---------------------------- |
| GetUploadUrl | Admin only    | Get pre-signed S3 upload URL |

### Stats RPCs

| RPC             | Auth Required | Description                              |
| --------------- | ------------- | ---------------------------------------- |
| GetArticleStats | Admin only    | Total articles, by type, total views     |

## 5. External Integrations

### 5.1 Architecture

```
Client → API Gateway → GraphQL Server → gRPC → News Service
                                                    ↓
                                              PostgreSQL, Redis, RabbitMQ, S3
```

### 5.2 Auth Service

- JWT verification only (RS256 public key)
- Checks `decoded.role === 1` for all write operations (articles, media, stats)
- `decoded.sub` used as `author_id` on article creation

### 5.3 RabbitMQ (news-events exchange)

- `article.created` — { article_id, title, slug, author_id, type, ts }
- `article.deleted` — { article_id, ts }

### 5.4 S3 / MinIO

- Bucket: `news-media-bucket`
- Pre-signed PUT URLs with configurable expiry (default: 1 hour)
- Client uploads directly to S3

### 5.5 Redis Cache Keys

- `news:article:{id}` — TTL 15min
- `news:latest:{page}:{limit}` — TTL 5min
- `news:search:{md5}` — TTL 5min

### 5.6 Subscription Service

- Admin dashboard fetches subscription counts and plan breakdowns from this external service
- News service does NOT manage subscriptions

## 6. Environment Variables

See `.env.example` for full list. Key variables:

- `SERVICE_PORT` — gRPC port (default: 50054)
- `PSQL_*` — PostgreSQL connection
- `REDIS_URL` — Redis connection
- `RABBIT_URL` — RabbitMQ connection
- `S3_*` — S3/MinIO configuration
- `JWT_ACCESS_PUBLIC_KEY_PATH` — Path to auth-service's public key

## 7. View Count Behavior

- Incremented on every `GetArticle` call (fire-and-forget, non-blocking)
- Cached articles still trigger the database increment
- Exposed in both full article and summary responses
- Aggregated in `GetArticleStats` as `total_views`

## 8. Future Ideas

Features considered but deferred. Revisit as the product evolves:

- **Categories / Tags** — Topic-based grouping within blog/news types (e.g., "Crypto", "Stocks", "Trading"). Would require a `categories` table, FK on articles, admin CRUD RPCs, and per-category stats. Dropped for now since the blog/news type distinction is sufficient.
- **Article editing** — Allow admins to update published articles. Would need an `UpdateArticle` RPC, slug re-generation on title change, cache invalidation, and `article.updated` RabbitMQ event.
- **Draft / Archive workflow** — Add `status` field (draft, published, archived) so admins can prepare content before publishing. Would change the create flow (no auto-publish) and require status filtering on list/search.
- **Soft delete & restore** — Add `deleted_at` column instead of hard deleting. Would enable a trash/restore flow for accidental deletions. All queries would need `WHERE deleted_at IS NULL`.
- **Bulk operations** — Bulk delete or bulk status change for admin efficiency. Needs careful error handling (partial success vs all-or-nothing).
- **Featured / Pinned articles** — `is_featured` boolean or `featured_at` timestamp to pin articles to the top of listings. Consider a max pinned limit.
- **Content moderation / Review queue** — `pending_review` status so articles require admin approval before going live. Useful if non-admin authors are ever allowed to submit content.
- **Media tracking table** — Track uploaded files in a `media` table (size, author, article FK) to detect orphaned uploads and monitor storage usage.
- **Audit log table** — Persist admin actions to a DB table instead of just Winston logs. Enables in-app audit history, retention policies, and admin accountability dashboard.
- **Most popular articles** — Rank articles by `view_count` for a "trending" or "most read" section. The view_count infrastructure is already in place.
- **Search analytics** — Log search queries (anonymized) to surface top search terms and content gaps.
- **Article type expansion** — Add more types beyond blog/news (e.g., "tutorial", "announcement") by changing the CHECK constraint.
