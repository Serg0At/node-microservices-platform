# MinIO Object Storage

## Overview

``npm run seed:avatars — uploads only missing avatars (idempotent)``
``npm run seed:avatars:force — deletes existing defaults and re-uploads all``

---

The user-service uses MinIO as S3-compatible object storage for user avatar images. MinIO runs as a self-hosted Docker container alongside other infrastructure services and provides the same API as AWS S3, making it easy to migrate to S3 in production.

---

## Infrastructure

### Docker Setup

MinIO runs as part of the project's docker-compose stack:

- **API port**: `9000` (S3-compatible endpoint)
- **Console port**: `9001` (web UI for managing buckets/objects)
- **Volume**: `minio-data` (persistent storage)
- **Health check**: `GET /minio/health/live`

Access the MinIO console at `http://localhost:9001` with the configured credentials.

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `MINIO_ENDPOINT` | Internal S3 API endpoint (used by SDK) | `http://minio:9000` |
| `MINIO_PUBLIC_URL` | Public-facing URL (stored in DB, served to clients) | `http://localhost:9000` |
| `MINIO_ACCESS_KEY` | S3 access key | `minioadmin` |
| `MINIO_SECRET_KEY` | S3 secret key | `minioadmin` |
| `MINIO_BUCKET` | Bucket name | `arbex-assets` |
| `MINIO_REGION` | S3 region (required by SDK) | `us-east-1` |

**Important**: `MINIO_ENDPOINT` is the address the service uses internally (e.g., `http://minio:9000` inside Docker). `MINIO_PUBLIC_URL` is the address clients/browsers use to fetch images (e.g., `http://localhost:9000` in dev, or a CDN URL in production).

---

## Bucket Structure

```
arbex-assets/
  avatars/
    defaults/
      avatar-01.png
      avatar-02.png
      ...
      avatar-20.png
    users/
      {user_id}/
        {uuid}.{ext}
```

- **`avatars/defaults/`** - 20 pre-loaded default avatar images, seeded on startup
- **`avatars/users/{user_id}/`** - Custom avatars uploaded by users, namespaced by user ID

### Bucket Policy

A public-read policy is applied to `avatars/*` on startup, allowing anonymous `s3:GetObject` access. This means all avatar URLs are directly accessible via browser without authentication.

---

## Initialization Flow

On service startup, `initMinio()` runs before the gRPC server starts:

```
app.js startup sequence:
  1. initRedis()
  2. initMinio()           <-- bucket + seed + policy
  3. initRabbitPublisher()
  4. initRabbitConsumer()
  5. startGrpc()
```

`initMinio()` performs three steps:

1. **Ensure bucket exists** - Creates `arbex-assets` if it doesn't exist, then applies the public-read policy
2. **Seed default avatars** - Reads images from `assets/default-avatars/`, checks if each already exists in MinIO (via `HeadObject`), and uploads any missing ones. This is idempotent and safe to run on every restart
3. **Log completion** - Confirms MinIO is ready

---

## Default Avatar Assignment

When a new user registers via auth-service, the `user.registered` RabbitMQ event is consumed. The consumer assigns a random default avatar:

```
user.registered event received
  -> getRandomDefaultAvatarUrl()  // picks random avatar-01..20
  -> ProfileModel.create({ user_id, username, avatar_url })
```

The URL stored is the full public path, e.g.:
`http://localhost:9000/arbex-assets/avatars/defaults/avatar-07.png`

---

## Avatar Upload (UploadAvatar RPC)

### gRPC Definition

```proto
rpc UploadAvatar(UploadAvatarRequest) returns (UploadAvatarResponse);

message UploadAvatarRequest {
  string access_token = 1;
  bytes image_data = 2;       // raw binary image data
  string content_type = 3;    // image/png, image/jpeg, image/webp, image/gif
  string file_name = 4;       // original filename (used for extension)
}

message UploadAvatarResponse {
  bool success = 1;
  string message = 2;
  string avatar_url = 3;      // new public URL
  UserProfile profile = 4;    // updated profile
}
```

### Upload Flow

```
1. Verify JWT access token -> extract user_id
2. Fetch existing profile from DB
3. Validate image size (max 5MB)
4. Generate unique object key: avatars/users/{user_id}/{uuid}.{ext}
5. Upload to MinIO via circuit breaker
6. Delete old custom avatar (if not a default)
7. Update profiles.avatar_url in DB
8. Invalidate Redis cache
9. Publish user.profile_updated event
10. Return updated profile
```

### Old Avatar Cleanup

When a user uploads a new avatar, the previous custom avatar is deleted from MinIO. Default avatars (path contains `avatars/defaults/`) are never deleted since they're shared across users.

### Size and Type Restrictions

- **Max size**: 5MB (enforced in service layer and GraphQL gateway)
- **Allowed types**: `image/png`, `image/jpeg`, `image/webp`, `image/gif`

---

## GraphQL Integration

The gateway exposes avatar upload as a mutation that accepts base64-encoded image data:

```graphql
mutation {
  uploadAvatar(
    imageBase64: "iVBORw0KGgo..."
    contentType: "image/png"
    fileName: "avatar.png"
  ) {
    success
    message
    avatarUrl
    profile {
      userId
      username
      avatarUrl
    }
  }
}
```

The gateway decodes base64 to a Buffer, validates size, then forwards as `bytes` to the gRPC `UploadAvatar` RPC.

---

## Resilience

All MinIO operations go through an opossum circuit breaker (`minioBreaker`):

| Setting | Value |
|---------|-------|
| Timeout | 10s |
| Error threshold | 50% |
| Reset timeout | 15s |
| Volume threshold | 5 requests |

If MinIO becomes unavailable, the circuit opens and fails fast rather than timing out on every request. Old avatar deletion failures are caught and logged as warnings — they don't block the upload.

---

## Utility Module Reference

`src/utils/minio.util.js` exports:

| Function | Description |
|----------|-------------|
| `initMinio()` | Initialize client, create bucket, set policy, seed defaults |
| `uploadObject(key, body, contentType)` | Upload a file to MinIO, returns public URL |
| `deleteObject(key)` | Delete a file from MinIO |
| `getPublicUrl(key)` | Build the public URL for an object key |
| `getRandomDefaultAvatarUrl()` | Pick a random default avatar URL (1-20) |
| `extractKeyFromUrl(url)` | Extract the object key from a full public URL |
| `isDefaultAvatar(url)` | Check if a URL points to a default avatar |

---

## Production Considerations

1. **Credentials** - Change `minioadmin/minioadmin` to strong credentials
2. **Public URL** - Set `MINIO_PUBLIC_URL` to your domain or CDN (e.g., `https://cdn.example.com`)
3. **TLS** - Put MinIO behind a reverse proxy (nginx/caddy) with HTTPS
4. **Migration to S3** - Change `MINIO_ENDPOINT` to `https://s3.amazonaws.com` and update credentials. The `@aws-sdk/client-s3` SDK works with both MinIO and AWS S3
5. **Backups** - The `minio-data` Docker volume contains all stored files. Back it up regularly or configure MinIO replication

---

## File Locations

| File | Purpose |
|------|---------|
| `src/utils/minio.util.js` | S3 client wrapper and all MinIO operations |
| `src/config/variables.config.js` | MinIO configuration (MINIO section) |
| `src/utils/circuit-breaker.util.js` | minioBreaker definition |
| `src/services/user.service.js` | uploadAvatar business logic |
| `src/controllers/user.controller.js` | UploadAvatar gRPC handler |
| `src/rabbit/consumer.js` | Default avatar assignment on registration |
| `proto/user.proto` | UploadAvatar RPC definition |
| `assets/default-avatars/` | 20 default avatar image files |
