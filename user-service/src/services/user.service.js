import crypto from 'crypto';
import { extname } from 'path';
import JwtUtil from '../utils/jwt.util.js';
import { publishToNotification } from '../rabbit/publisher.js';
import { redisOps } from '../redis/redisClient.js';
import { uploadObject, deleteObject, getPublicUrl, extractKeyFromUrl, isDefaultAvatar } from '../utils/minio.util.js';
import config from '../config/variables.config.js';
import db from '../config/db.js';
import { ProfileModel } from '../models/index.js';
import { dbBreaker, redisBreaker, rabbitBreaker, minioBreaker } from '../utils/index.js';
import logger from '../utils/logger.util.js';

export default class UserService {
  static async getProfile({ userId }) {
    const cached = await redisBreaker.fire(() => redisOps.getCachedProfile(userId));
    if (cached) return { success: true, profile: cached };

    const profile = await dbBreaker.fire(() => ProfileModel.findByUserId(userId));
    if (!profile) {
      const err = new Error('Profile not found');
      err.name = 'ResourceNotFoundError';
      throw err;
    }

    const profileData = {
      user_id: profile.user_id.toString(),
      username: profile.username,
      display_name: profile.display_name || '',
      avatar_url: profile.avatar_url || '',
    };

    await redisBreaker.fire(() => redisOps.cacheProfile(userId, profileData));

    return { success: true, profile: profileData };
  }

  static async updateProfile({ accessToken, username, displayName }) {
    const decoded = JwtUtil.verifyAccessToken(accessToken);
    if (!decoded) {
      const err = new Error('Invalid or expired access token');
      err.name = 'UnauthorizedError';
      throw err;
    }

    const userId = decoded.id;

    const existing = await dbBreaker.fire(() => ProfileModel.findByUserId(userId));
    if (!existing) {
      const err = new Error('Profile not found');
      err.name = 'ResourceNotFoundError';
      throw err;
    }

    const updateData = {};
    const fieldsChanged = [];
    let oldUsername = null;

    if (username && username !== existing.username) {
      const conflict = await dbBreaker.fire(() => ProfileModel.findByUsername(username));
      if (conflict) {
        const err = new Error('Username is already taken');
        err.name = 'ConflictError';
        throw err;
      }
      oldUsername = existing.username;
      updateData.username = username;
      fieldsChanged.push('username');
    }

    if (displayName && displayName !== existing.display_name) {
      updateData.display_name = displayName;
      fieldsChanged.push('display_name');
    }

    if (fieldsChanged.length === 0) {
      return {
        success: true,
        message: 'No changes detected',
        profile: {
          user_id: existing.user_id.toString(),
          username: existing.username,
          display_name: existing.display_name || '',
          avatar_url: existing.avatar_url || '',
        },
      };
    }

    const updated = await dbBreaker.fire(() =>
      db.transaction((trx) => ProfileModel.update(userId, updateData, trx))
    );

    await redisBreaker.fire(() => redisOps.invalidateProfileCache(userId));

    if (oldUsername) {
      await rabbitBreaker.fire(() =>
        publishToNotification(
          config.RABBITMQ.ROUTING_KEYS.USER_USERNAME_CHANGED,
          {
            user_id: userId,
            old_username: oldUsername,
            new_username: username,
            ts: Math.floor(Date.now() / 1000),
          }
        )
      );
    }

    const nonUsernameFields = fieldsChanged.filter((f) => f !== 'username');
    if (nonUsernameFields.length > 0) {
      await rabbitBreaker.fire(() =>
        publishToNotification(
          config.RABBITMQ.ROUTING_KEYS.USER_PROFILE_UPDATED,
          {
            user_id: userId,
            fields_changed: nonUsernameFields,
            ts: Math.floor(Date.now() / 1000),
          }
        )
      );
    }

    const profileData = {
      user_id: updated.user_id.toString(),
      username: updated.username,
      display_name: updated.display_name || '',
      avatar_url: updated.avatar_url || '',
    };

    return {
      success: true,
      message: 'Profile updated successfully',
      profile: profileData,
    };
  }

  static async uploadAvatar({ accessToken, imageData, contentType, fileName }) {
    const decoded = JwtUtil.verifyAccessToken(accessToken);
    if (!decoded) {
      const err = new Error('Invalid or expired access token');
      err.name = 'UnauthorizedError';
      throw err;
    }

    const userId = decoded.id;

    const existing = await dbBreaker.fire(() => ProfileModel.findByUserId(userId));
    if (!existing) {
      const err = new Error('Profile not found');
      err.name = 'ResourceNotFoundError';
      throw err;
    }

    if (imageData.length > config.MINIO.MAX_IMAGE_SIZE) {
      const err = new Error('Image exceeds 5MB size limit');
      err.name = 'ValidationError';
      throw err;
    }

    const ext = extname(fileName).toLowerCase() || '.png';
    const objectKey = `${config.MINIO.USER_AVATARS_PREFIX}${userId}/${crypto.randomUUID()}${ext}`;

    await minioBreaker.fire(() => uploadObject(objectKey, imageData, contentType));

    if (existing.avatar_url && !isDefaultAvatar(existing.avatar_url)) {
      const oldKey = extractKeyFromUrl(existing.avatar_url);
      if (oldKey) {
        await minioBreaker.fire(() => deleteObject(oldKey)).catch((err) =>
          logger.warn('Failed to delete old avatar', { error: err.message, key: oldKey })
        );
      }
    }

    const newAvatarUrl = getPublicUrl(objectKey);

    const updated = await dbBreaker.fire(() =>
      db.transaction((trx) => ProfileModel.update(userId, { avatar_url: newAvatarUrl }, trx))
    );

    await redisBreaker.fire(() => redisOps.invalidateProfileCache(userId));

    await rabbitBreaker.fire(() =>
      publishToNotification(
        config.RABBITMQ.ROUTING_KEYS.USER_PROFILE_UPDATED,
        {
          user_id: userId,
          fields_changed: ['avatar_url'],
          ts: Math.floor(Date.now() / 1000),
        }
      )
    );

    const profileData = {
      user_id: updated.user_id.toString(),
      username: updated.username,
      display_name: updated.display_name || '',
      avatar_url: updated.avatar_url || '',
    };

    return {
      success: true,
      message: 'Avatar uploaded successfully',
      avatar_url: newAvatarUrl,
      profile: profileData,
    };
  }
}
