# Admin Service — Frontend Developer Reference

**Service:** Admin Service  
**Responsibility:** Provides admin-panel operations including dashboard statistics, user management (roles, bans), and proxy access to article, subscription, promo code, and notification management on behalf of authenticated admins. All routes require an admin-role JWT.

> All RPCs are exposed through the GraphQL gateway. `access_token` is a valid admin JWT.

---

## GetDashboardStats
Returns aggregated platform statistics for the admin dashboard.

**Request**
| Field | Type | Required |
|---|---|---|
| `access_token` | string | yes |

**Response**
| Field | Type | Description |
|---|---|---|
| `success` | bool | |
| `total_users` | int | Total registered users |
| `total_articles` | int | Total published articles |
| `total_categories` | int | Total article categories |
| `total_views` | int | Total article views |
| `articles_today` | int | Articles created today |
| `users_today` | int | Users registered today |
| `total_banned` | int | Total banned users |

**Example**
```json
// Request
{ "access_token": "eyJ..." }

// Response
{ "success": true, "total_users": 1500, "total_articles": 240, "total_categories": 12, "total_views": 48200, "articles_today": 3, "users_today": 17, "total_banned": 4 }
```

---

## ListUsers
Returns a paginated, filterable list of all users.

**Request**
| Field | Type | Required | Description |
|---|---|---|---|
| `access_token` | string | yes | |
| `page` | int | no | Default `1` |
| `limit` | int | no | Default `20` |
| `search` | string | no | Search by email or username |
| `role` | int | no | `-1` = all, `0` = user, `1` = admin |
| `status` | int | no | `-1` = all, `0` = active, `1` = banned |

**Response**
| Field | Type | Description |
|---|---|---|
| `success` | bool | |
| `users` | UserRecord[] | |
| `pagination.page` | int | |
| `pagination.limit` | int | |
| `pagination.total` | int | |
| `pagination.total_pages` | int | |

**UserRecord fields:** `id`, `email`, `username`, `role` (0/1), `status` (0/1), `created_at`, `updated_at`, `banned_at`, `ban_reason`

**Example**
```json
// Request
{ "access_token": "eyJ...", "page": 1, "limit": 20, "search": "john", "role": -1, "status": -1 }

// Response
{
  "success": true,
  "users": [{ "id": "42", "email": "john@example.com", "username": "john_doe", "role": 0, "status": 0, "created_at": "2024-01-15T10:00:00Z" }],
  "pagination": { "page": 1, "limit": 20, "total": 1, "total_pages": 1 }
}
```

---

## GetUser
Returns full details for a single user by ID.

**Request**
| Field | Type | Required |
|---|---|---|
| `access_token` | string | yes |
| `user_id` | string | yes |

**Response**
| Field | Type |
|---|---|
| `success` | bool |
| `user` | UserRecord |

**Example**
```json
// Request
{ "access_token": "eyJ...", "user_id": "42" }

// Response
{ "success": true, "user": { "id": "42", "email": "john@example.com", "username": "john_doe", "role": 0, "status": 0 } }
```

---

## UpdateUserRole
Changes a user's role (0 = user, 1 = admin).

**Request**
| Field | Type | Required |
|---|---|---|
| `access_token` | string | yes |
| `user_id` | string | yes |
| `role` | int | yes — `0` or `1` |

**Response**
| Field | Type |
|---|---|
| `success` | bool |
| `message` | string |
| `user` | UserRecord |

**Example**
```json
// Request
{ "access_token": "eyJ...", "user_id": "42", "role": 1 }

// Response
{ "success": true, "message": "Role updated", "user": { "id": "42", "role": 1 } }
```

---

## BanUser
Bans a user account by setting `banned_at`; the user will be blocked from logging in immediately.

**Request**
| Field | Type | Required |
|---|---|---|
| `access_token` | string | yes |
| `user_id` | string | yes |
| `reason` | string | yes |

**Response**
| Field | Type |
|---|---|
| `success` | bool |
| `message` | string |

**Example**
```json
// Request
{ "access_token": "eyJ...", "user_id": "42", "reason": "Spam activity" }

// Response
{ "success": true, "message": "User banned" }
```

---

## UnbanUser
Removes the ban from a user account.

**Request**
| Field | Type | Required |
|---|---|---|
| `access_token` | string | yes |
| `user_id` | string | yes |

**Response**
| Field | Type |
|---|---|
| `success` | bool |
| `message` | string |

**Example**
```json
// Request
{ "access_token": "eyJ...", "user_id": "42" }

// Response
{ "success": true, "message": "User unbanned" }
```

---

## CreateArticle
Creates a new article (proxied to news-service).

**Request**
| Field | Type | Required | Description |
|---|---|---|---|
| `access_token` | string | yes | |
| `title` | string | yes | |
| `content` | string | yes | Full article body |
| `type` | string | yes | `"blog"` or `"news"` |
| `cover_image_url` | string | no | URL from `GetUploadUrl` |
| `categories` | string[] | no | |

**Response**
| Field | Type |
|---|---|
| `success` | bool |
| `article` | ArticleRecord |

**ArticleRecord fields:** `id`, `title`, `slug`, `content`, `author_id`, `type`, `cover_image_url`, `view_count`, `published_at`, `created_at`, `updated_at`, `categories[]`

**Example**
```json
// Request
{ "access_token": "eyJ...", "title": "Market Update", "content": "...", "type": "news", "categories": ["crypto"] }

// Response
{ "success": true, "article": { "id": "101", "title": "Market Update", "slug": "market-update", "type": "news", "view_count": 0 } }
```

---

## DeleteArticle
Permanently deletes an article (proxied to news-service).

**Request**
| Field | Type | Required |
|---|---|---|
| `access_token` | string | yes |
| `article_id` | string | yes |

**Response**
| Field | Type |
|---|---|
| `success` | bool |
| `message` | string |

**Example**
```json
// Request
{ "access_token": "eyJ...", "article_id": "101" }

// Response
{ "success": true, "message": "Article deleted" }
```

---

## GetUploadUrl
Returns a pre-signed PUT URL for uploading article cover images to object storage.

**Request**
| Field | Type | Required | Description |
|---|---|---|---|
| `access_token` | string | yes | |
| `filename` | string | yes | e.g. `"cover.jpg"` |
| `content_type` | string | yes | e.g. `"image/jpeg"` |
| `article_id` | string | no | Associate with existing article |

**Response**
| Field | Type | Description |
|---|---|---|
| `success` | bool | |
| `upload_url` | string | Pre-signed PUT URL — upload directly from browser |
| `file_url` | string | Public URL to use as `cover_image_url` after upload |
| `expires_in` | int | Seconds until `upload_url` expires |

**Example**
```json
// Request
{ "access_token": "eyJ...", "filename": "cover.jpg", "content_type": "image/jpeg" }

// Response
{ "success": true, "upload_url": "https://s3.../presigned...", "file_url": "https://cdn.../cover.jpg", "expires_in": 300 }
```

---

## GetArticleStats
Returns article counts and total views (proxied to news-service).

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

---

## AdminSetSubscription
Manually assigns a subscription plan to a user (proxied to subscription-service).

**Request**
| Field | Type | Required | Description |
|---|---|---|---|
| `access_token` | string | yes | |
| `user_id` | string | yes | |
| `sub_type` | int | yes | `0`=None, `1`=Lite, `2`=Standard, `3`=PRO |
| `duration_months` | int | yes | `1`, `3`, `6`, or `12` |
| `issued_by` | string | no | e.g. `"Admin"`, `"Promo"` |

**Response**
| Field | Type |
|---|---|
| `success` | bool |
| `subscription` | SubscriptionRecord |

**SubscriptionRecord fields:** `id`, `user_id`, `sub_type`, `free_trial`, `status`, `started_at`, `ended_at`, `grace_period_end`, `issued_by`, `created_at`, `updated_at`

**Example**
```json
// Request
{ "access_token": "eyJ...", "user_id": "42", "sub_type": 3, "duration_months": 12, "issued_by": "Admin" }

// Response
{ "success": true, "subscription": { "id": "sub_1", "user_id": "42", "sub_type": 3, "status": "active", "ended_at": "2027-04-01T00:00:00Z" } }
```

---

## AdminRemoveSubscription
Terminates a user's subscription immediately (proxied to subscription-service).

**Request**
| Field | Type | Required |
|---|---|---|
| `access_token` | string | yes |
| `user_id` | string | yes |
| `reason` | string | no |

**Response**
| Field | Type |
|---|---|
| `success` | bool |
| `message` | string |

**Example**
```json
// Request
{ "access_token": "eyJ...", "user_id": "42", "reason": "Violation of TOS" }

// Response
{ "success": true, "message": "Subscription terminated" }
```

---

## GetSubscriptionStats
Returns subscription counts broken down by status and tier (proxied to subscription-service).

**Request**
| Field | Type | Required |
|---|---|---|
| `access_token` | string | yes |

**Response**
| Field | Type | Description |
|---|---|---|
| `success` | bool | |
| `total_active` | int | |
| `total_expired` | int | |
| `total_canceled` | int | |
| `total_terminated` | int | |
| `by_tier` | `{ tier: int, count: int }[]` | Count per `sub_type` |

**Example**
```json
// Response
{ "success": true, "total_active": 320, "total_expired": 45, "total_canceled": 12, "total_terminated": 3, "by_tier": [{ "tier": 1, "count": 100 }, { "tier": 3, "count": 220 }] }
```

---

## CreatePromoCode
Creates a discount promo code (proxied to subscription-service).

**Request**
| Field | Type | Required | Description |
|---|---|---|---|
| `access_token` | string | yes | |
| `code` | string | yes | Unique code string |
| `discount_type` | string | yes | `"percentage"` or `"fixed"` |
| `discount_value` | int | yes | Percentage (1–100) or fixed cents |
| `max_uses` | int | no | `0` = unlimited |
| `applicable_tiers` | int[] | no | Empty = all tiers |
| `min_duration_months` | int | no | Minimum purchase duration |
| `valid_until` | string | no | ISO 8601, empty = no expiry |

**Response**
| Field | Type |
|---|---|
| `success` | bool |
| `promo_code` | PromoCodeRecord |

**Example**
```json
// Request
{ "access_token": "eyJ...", "code": "SAVE20", "discount_type": "percentage", "discount_value": 20, "max_uses": 100, "applicable_tiers": [2, 3], "valid_until": "2026-12-31T00:00:00Z" }

// Response
{ "success": true, "promo_code": { "id": "pc_1", "code": "SAVE20", "discount_type": "percentage", "discount_value": 20, "active": true } }
```

---

## ListPromoCodes
Lists all promo codes with optional active-only filter (proxied to subscription-service).

**Request**
| Field | Type | Required |
|---|---|---|
| `access_token` | string | yes |
| `page` | int | no |
| `limit` | int | no |
| `active_only` | bool | no |

**Response**
| Field | Type |
|---|---|
| `success` | bool |
| `promo_codes` | PromoCodeRecord[] |
| `total` | int |

**Example**
```json
// Request
{ "access_token": "eyJ...", "page": 1, "limit": 20, "active_only": true }

// Response
{ "success": true, "promo_codes": [{ "code": "SAVE20", "discount_value": 20, "used_count": 14, "active": true }], "total": 1 }
```

---

## DeactivatePromoCode
Deactivates a promo code so it can no longer be applied (proxied to subscription-service).

**Request**
| Field | Type | Required |
|---|---|---|
| `access_token` | string | yes |
| `code` | string | yes |

**Response**
| Field | Type |
|---|---|
| `success` | bool |
| `message` | string |

**Example**
```json
// Request
{ "access_token": "eyJ...", "code": "SAVE20" }

// Response
{ "success": true, "message": "Promo code deactivated" }
```

---

## AdminSendNotification
Sends a notification to a single user via email or in-app channel (proxied to notification-service).

**Request**
| Field | Type | Required | Description |
|---|---|---|---|
| `access_token` | string | yes | |
| `user_id` | string | yes | |
| `email` | string | yes | Recipient email |
| `subject` | string | yes | |
| `body` | string | yes | |
| `channel` | string | no | `"email"` (default) or `"in_app"` |

**Response**
| Field | Type |
|---|---|
| `success` | bool |
| `message` | string |
| `notification_id` | string |

**Example**
```json
// Request
{ "access_token": "eyJ...", "user_id": "42", "email": "john@example.com", "subject": "Account Notice", "body": "Your account has been reviewed.", "channel": "email" }

// Response
{ "success": true, "message": "Notification sent", "notification_id": "notif_99" }
```

---

## AdminSendBulkNotification
Sends the same notification to multiple recipients at once (proxied to notification-service).

**Request**
| Field | Type | Required | Description |
|---|---|---|---|
| `access_token` | string | yes | |
| `subject` | string | yes | |
| `body` | string | yes | |
| `channel` | string | no | `"email"` or `"in_app"` |
| `recipients` | `{ user_id, email }[]` | yes | |

**Response**
| Field | Type | Description |
|---|---|---|
| `success` | bool | |
| `message` | string | |
| `total` | int | Total recipients |
| `sent` | int | Successfully delivered |
| `failed` | int | Failed deliveries |

**Example**
```json
// Request
{
  "access_token": "eyJ...",
  "subject": "Platform Maintenance",
  "body": "We will be down for maintenance on April 5.",
  "channel": "email",
  "recipients": [{ "user_id": "42", "email": "john@example.com" }, { "user_id": "55", "email": "jane@example.com" }]
}

// Response
{ "success": true, "message": "Bulk notification sent", "total": 2, "sent": 2, "failed": 0 }
```
