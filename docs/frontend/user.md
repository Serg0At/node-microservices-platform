# User Service — Frontend Developer Reference

**Service:** User Service  
**Responsibility:** Manages public user profiles including display name, username, and avatar, creating a profile automatically when a user registers and publishing username-change events so other services stay in sync. `GetProfile` is public; `UpdateProfile` and `UploadAvatar` require authentication.

> All RPCs are exposed through the GraphQL gateway.

---

## GetProfile
Returns the public profile for any user by ID — no authentication required.

**Request**
| Field | Type | Required |
|---|---|---|
| `user_id` | string | yes |

**Response**
| Field | Type | Description |
|---|---|---|
| `success` | bool | |
| `profile.user_id` | string | |
| `profile.username` | string | |
| `profile.display_name` | string | |
| `profile.avatar_url` | string | Full URL to avatar image |

**Example**
```json
// Request
{ "user_id": "42" }

// Response
{ "success": true, "profile": { "user_id": "42", "username": "john_doe", "display_name": "John", "avatar_url": "https://cdn.../avatar.jpg" } }
```

---

## UpdateProfile
Updates the authenticated user's username and/or display name.

**Request**
| Field | Type | Required | Description |
|---|---|---|---|
| `access_token` | string | yes | Valid JWT |
| `username` | string | no | New username (must be unique) |
| `display_name` | string | no | Display name (no uniqueness constraint) |

**Response**
| Field | Type | Description |
|---|---|---|
| `success` | bool | |
| `message` | string | |
| `profile` | UserProfile | Updated profile |

**Example**
```json
// Request
{ "access_token": "eyJ...", "username": "john_updated", "display_name": "Johnny" }

// Response
{ "success": true, "message": "Profile updated", "profile": { "user_id": "42", "username": "john_updated", "display_name": "Johnny", "avatar_url": "https://cdn.../avatar.jpg" } }
```

---

## UploadAvatar
Uploads a new avatar image for the authenticated user and returns the updated profile with the new URL.

**Request**
| Field | Type | Required | Description |
|---|---|---|---|
| `access_token` | string | yes | Valid JWT |
| `image_data` | bytes | yes | Raw image binary |
| `content_type` | string | yes | e.g. `"image/jpeg"`, `"image/png"` |
| `file_name` | string | yes | e.g. `"avatar.jpg"` |

**Response**
| Field | Type | Description |
|---|---|---|
| `success` | bool | |
| `message` | string | |
| `avatar_url` | string | New public URL |
| `profile` | UserProfile | Updated profile |

**Example**
```json
// Request
{ "access_token": "eyJ...", "image_data": "<binary>", "content_type": "image/jpeg", "file_name": "avatar.jpg" }

// Response
{ "success": true, "message": "Avatar uploaded", "avatar_url": "https://cdn.../avatars/42.jpg", "profile": { "user_id": "42", "username": "john_doe", "avatar_url": "https://cdn.../avatars/42.jpg" } }
```
