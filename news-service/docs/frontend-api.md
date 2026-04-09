# News Service — Frontend Developer Reference

**Service:** News Service  
**Responsibility:** Stores and serves articles (blogs and news), supports full-text search and category filtering, provides presigned upload URLs for cover images, and publishes `article.created` / `article.deleted` events. Read operations (`GetArticle`, `ListArticles`, `SearchArticles`) are public; write operations require an admin JWT.

> All RPCs are exposed through the GraphQL gateway.

---

## GetArticle
Returns the full content of a single article, looked up by ID or slug.

**Request**
| Field | Type | Required | Description |
|---|---|---|---|
| `id` | string | one of | Article ID |
| `slug` | string | one of | URL-friendly slug |

**Response**
| Field | Type | Description |
|---|---|---|
| `success` | bool | |
| `article.id` | string | |
| `article.title` | string | |
| `article.slug` | string | |
| `article.content` | string | Full article body |
| `article.author_id` | string | |
| `article.type` | string | `"blog"` or `"news"` |
| `article.categories` | string[] | |
| `article.cover_image_url` | string | |
| `article.view_count` | int64 | |
| `article.published_at` | string | ISO 8601 |
| `article.created_at` | string | ISO 8601 |
| `article.updated_at` | string | ISO 8601 |

**Example**
```json
// Request
{ "slug": "market-update-april" }

// Response
{
  "success": true,
  "article": { "id": "101", "title": "Market Update April", "slug": "market-update-april", "content": "...", "type": "news", "categories": ["crypto"], "view_count": 1240, "published_at": "2026-04-01T08:00:00Z" }
}
```

---

## ListArticles
Returns a paginated list of article summaries with optional category and author filters.

**Request**
| Field | Type | Required | Description |
|---|---|---|---|
| `page` | int | no | Default `1` |
| `limit` | int | no | Default `10`, max `50` |
| `category` | string | no | Filter by category name |
| `author_id` | string | no | Filter by author |

**Response**
| Field | Type | Description |
|---|---|---|
| `success` | bool | |
| `articles` | ArticleSummary[] | `id`, `title`, `slug`, `author_id`, `type`, `categories[]`, `cover_image_url`, `view_count`, `published_at`, `created_at` |
| `pagination.page` | int | |
| `pagination.limit` | int | |
| `pagination.total` | int | |
| `pagination.total_pages` | int | |

**Example**
```json
// Request
{ "page": 1, "limit": 10, "category": "crypto" }

// Response
{
  "success": true,
  "articles": [{ "id": "101", "title": "Market Update April", "slug": "market-update-april", "type": "news", "view_count": 1240 }],
  "pagination": { "page": 1, "limit": 10, "total": 42, "total_pages": 5 }
}
```

---

## SearchArticles
Full-text search across article titles and content with optional filters.

**Request**
| Field | Type | Required | Description |
|---|---|---|---|
| `query` | string | yes | Search term |
| `page` | int | no | Default `1` |
| `limit` | int | no | Default `10`, max `50` |
| `category` | string | no | |
| `author_id` | string | no | |

**Response**

Same structure as `ListArticles` response.

**Example**
```json
// Request
{ "query": "bitcoin halving", "page": 1, "limit": 10 }

// Response
{ "success": true, "articles": [{ "title": "Bitcoin Halving 2024 Analysis", "slug": "bitcoin-halving-2024" }], "pagination": { "total": 3, "total_pages": 1 } }
```

---

## CreateArticle
Creates a new article — admin only.

**Request**
| Field | Type | Required | Description |
|---|---|---|---|
| `access_token` | string | yes | Admin JWT |
| `title` | string | yes | |
| `content` | string | yes | Full article body |
| `type` | string | yes | `"blog"` or `"news"` |
| `cover_image_url` | string | no | URL obtained from `GetUploadUrl` |
| `categories` | string[] | no | |

**Response**
| Field | Type |
|---|---|
| `success` | bool |
| `article` | Article (full) |

**Example**
```json
// Request
{ "access_token": "eyJ...", "title": "Bitcoin Halving 2024", "content": "...", "type": "news", "categories": ["bitcoin", "halving"] }

// Response
{ "success": true, "article": { "id": "102", "title": "Bitcoin Halving 2024", "slug": "bitcoin-halving-2024", "type": "news" } }
```

---

## DeleteArticle
Permanently deletes an article — admin only.

**Request**
| Field | Type | Required |
|---|---|---|
| `access_token` | string | yes |
| `id` | string | yes |

**Response**
| Field | Type |
|---|---|
| `success` | bool |
| `message` | string |

**Example**
```json
// Request
{ "access_token": "eyJ...", "id": "102" }

// Response
{ "success": true, "message": "Article deleted" }
```

---

## GetUploadUrl
Returns a pre-signed PUT URL for uploading a cover image directly from the browser — admin only.

**Request**
| Field | Type | Required | Description |
|---|---|---|---|
| `access_token` | string | yes | |
| `filename` | string | yes | e.g. `"cover.jpg"` |
| `content_type` | string | yes | e.g. `"image/jpeg"` |
| `article_id` | string | no | Associate with an existing article |

**Response**
| Field | Type | Description |
|---|---|---|
| `success` | bool | |
| `upload_url` | string | PUT to this URL with image binary — expires in `expires_in` seconds |
| `file_url` | string | Public URL to use as `cover_image_url` after upload |
| `expires_in` | int | Seconds |

**Example**
```json
// Request
{ "access_token": "eyJ...", "filename": "cover.jpg", "content_type": "image/jpeg" }

// Response
{ "success": true, "upload_url": "https://s3.../presigned...", "file_url": "https://cdn.../cover.jpg", "expires_in": 300 }
```

---

## GetArticleStats
Returns aggregate article counts and total views — admin only.

**Request**
| Field | Type | Required |
|---|---|---|
| `access_token` | string | yes |

**Response**
| Field | Type |
|---|---|
| `success` | bool |
| `total_articles` | int |
| `total_blog` | int |
| `total_news` | int |
| `total_views` | int64 |

**Example**
```json
// Response
{ "success": true, "total_articles": 240, "total_blog": 80, "total_news": 160, "total_views": 48200 }
```
