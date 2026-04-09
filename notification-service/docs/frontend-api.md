# Notification Service — Frontend Developer Reference

**Service:** Notification Service  
**Responsibility:** Delivers transactional emails triggered by auth events (registration, login alerts, password changes, 2FA) and manages an in-app notification inbox that users can read, mark as read, and delete. Admin and system RPCs are internal; user-facing RPCs are exposed via the gateway.

> All RPCs are exposed through the GraphQL gateway. `user_id` is typically resolved from the JWT by the gateway.

---

## GetNotifications
Returns a paginated list of notifications for the current user.

**Request**
| Field | Type | Required | Description |
|---|---|---|---|
| `user_id` | string | yes | |
| `limit` | int | no | Default `20`, max `100` |
| `offset` | int | no | Default `0` |
| `type_filter` | string | no | e.g. `"welcome"`, `"verify_email"`, `"new_login"` |
| `read_filter` | string | no | `"read"`, `"unread"`, or `""` for all |

**Response**
| Field | Type | Description |
|---|---|---|
| `success` | bool | |
| `notifications` | Notification[] | |
| `total_count` | int64 | Total matching notifications |

**Notification fields:** `id`, `user_id`, `type`, `channel` (`email`/`in_app`/`push`), `title`, `body`, `status` (`pending`/`sent`/`failed`/`read`), `read`, `created_at`, `sent_at`, `read_at`

**Example**
```json
// Request
{ "user_id": "42", "limit": 20, "read_filter": "unread" }

// Response
{
  "success": true,
  "total_count": 2,
  "notifications": [
    { "id": "notif_1", "type": "new_login", "title": "New login detected", "body": "A new login was detected from Chrome on Windows.", "read": false, "created_at": "2026-04-01T09:00:00Z" }
  ]
}
```

---

## GetUnreadCount
Returns the count of unread notifications for a user — use for badge counters.

**Request**
| Field | Type | Required |
|---|---|---|
| `user_id` | string | yes |

**Response**
| Field | Type |
|---|---|
| `success` | bool |
| `count` | int64 |

**Example**
```json
// Request
{ "user_id": "42" }

// Response
{ "success": true, "count": 3 }
```

---

## MarkAsRead
Marks a single notification as read.

**Request**
| Field | Type | Required |
|---|---|---|
| `notification_id` | string | yes |
| `user_id` | string | yes |

**Response**
| Field | Type |
|---|---|
| `success` | bool |
| `message` | string |

**Example**
```json
// Request
{ "notification_id": "notif_1", "user_id": "42" }

// Response
{ "success": true, "message": "Marked as read" }
```

---

## MarkAllAsRead
Marks all of a user's notifications as read at once.

**Request**
| Field | Type | Required |
|---|---|---|
| `user_id` | string | yes |

**Response**
| Field | Type | Description |
|---|---|---|
| `success` | bool | |
| `message` | string | |
| `updated_count` | int64 | Number of notifications marked read |

**Example**
```json
// Request
{ "user_id": "42" }

// Response
{ "success": true, "message": "All marked as read", "updated_count": 5 }
```

---

## DeleteNotification
Permanently deletes a single notification.

**Request**
| Field | Type | Required |
|---|---|---|
| `notification_id` | string | yes |
| `user_id` | string | yes |

**Response**
| Field | Type |
|---|---|
| `success` | bool |
| `message` | string |

**Example**
```json
// Request
{ "notification_id": "notif_1", "user_id": "42" }

// Response
{ "success": true, "message": "Notification deleted" }
```
