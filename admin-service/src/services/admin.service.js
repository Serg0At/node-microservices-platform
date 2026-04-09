import { UserModel } from '../models/index.js';
import { dbBreaker, redisBreaker, grpcBreaker } from '../utils/circuit-breaker.util.js';
import { adminCacheOps } from '../redis/adminCache.js';
import * as newsClient from '../grpc/clients/news-client.js';
import * as notificationClient from '../grpc/clients/notification-client.js';
import * as subscriptionClient from '../grpc/clients/subscription-client.js';
import ErrorHandler from '../utils/error-handler.util.js';
import JwtUtil from '../utils/jwt.util.js';
import logger from '../utils/logger.util.js';

const errors = ErrorHandler.errors;

function requireAdmin(decoded) {
  if (!decoded) throw new errors.UnauthorizedError('Invalid or expired access token');
  if (decoded.role !== 1) throw new errors.Forbidden('Admin access required');
  return decoded;
}

export default class AdminService {
  static async getDashboardStats(accessToken) {
    const decoded = requireAdmin(JwtUtil.verifyAccessToken(accessToken));

    // Try cache first
    try {
      const cached = await redisBreaker.fire(() => adminCacheOps.getDashboardStats());
      if (cached) return cached;
    } catch { /* cache miss, continue */ }

    const settled = await Promise.allSettled([
      dbBreaker.fire(() => UserModel.countAll()),
      dbBreaker.fire(() => UserModel.countBanned()),
      dbBreaker.fire(() => UserModel.countArticles()),
      dbBreaker.fire(() => UserModel.countCategories()),
      dbBreaker.fire(() => UserModel.totalViews()),
      dbBreaker.fire(() => UserModel.countArticlesToday()),
      dbBreaker.fire(() => UserModel.countToday()),
    ]);

    const labels = ['countAll', 'countBanned', 'countArticles', 'countCategories', 'totalViews', 'countArticlesToday', 'countToday'];
    const [totalUsers, totalBanned, totalArticles, totalCategories, totalViews, articlesToday, usersToday] =
      settled.map((r, i) => {
        if (r.status === 'rejected') {
          logger.warn(`Dashboard stat failed: ${labels[i]}`, { error: r.reason?.message });
          return 0;
        }
        return r.value;
      });

    const stats = {
      success: true,
      total_users: totalUsers,
      total_banned: totalBanned,
      total_articles: totalArticles,
      total_categories: totalCategories,
      total_views: totalViews,
      articles_today: articlesToday,
      users_today: usersToday,
    };

    // Populate cache (fire-and-forget)
    try {
      await redisBreaker.fire(() => adminCacheOps.setDashboardStats(stats));
    } catch { /* cache write failure is non-blocking */ }

    logger.info('Dashboard stats fetched', {
      type: 'audit', action: 'dashboard.view',
      actor_id: decoded.id, actor_role: decoded.role,
    });

    return stats;
  }

  static async listUsers(accessToken, { page, limit, search, role, status }) {
    const decoded = requireAdmin(JwtUtil.verifyAccessToken(accessToken));

    const result = await dbBreaker.fire(() =>
      UserModel.list({ page, limit, search, role, status })
    );

    return {
      success: true,
      users: result.users,
      pagination: result.pagination,
    };
  }

  static async getUser(accessToken, userId) {
    const decoded = requireAdmin(JwtUtil.verifyAccessToken(accessToken));

    const user = await dbBreaker.fire(() => UserModel.findById(userId));
    if (!user) throw new errors.ResourceNotFoundError('User not found');

    return { success: true, user };
  }

  static async updateUserRole(accessToken, userId, role) {
    const decoded = requireAdmin(JwtUtil.verifyAccessToken(accessToken));

    if (decoded.id.toString() === userId.toString()) {
      throw new errors.Forbidden('Cannot change your own role');
    }

    const existing = await dbBreaker.fire(() => UserModel.findById(userId));
    if (!existing) throw new errors.ResourceNotFoundError('User not found');

    if (role !== 0 && role !== 1) {
      throw new errors.InputValidationError('Role must be 0 (user) or 1 (admin)');
    }

    const user = await dbBreaker.fire(() => UserModel.updateRole(userId, role));

    logger.info('User role updated', {
      type: 'audit', action: 'user.role.update',
      actor_id: decoded.id, actor_email: decoded.email, actor_role: decoded.role,
      resource_type: 'user', resource_id: userId,
      old_role: existing.role, new_role: role,
    });

    return { success: true, message: 'Role updated', user };
  }

  static async banUser(accessToken, userId, reason) {
    const decoded = requireAdmin(JwtUtil.verifyAccessToken(accessToken));

    if (decoded.id.toString() === userId.toString()) {
      throw new errors.Forbidden('Cannot ban yourself');
    }

    const existing = await dbBreaker.fire(() => UserModel.findById(userId));
    if (!existing) throw new errors.ResourceNotFoundError('User not found');
    if (existing.banned_at) throw new errors.ConflictError('User is already banned');
    if (existing.role === 1) throw new errors.Forbidden('Cannot ban an admin');

    await dbBreaker.fire(() => UserModel.ban(userId, reason));

    logger.info('User banned', {
      type: 'audit', action: 'user.ban',
      actor_id: decoded.id, actor_email: decoded.email, actor_role: decoded.role,
      resource_type: 'user', resource_id: userId, reason,
    });

    return { success: true, message: 'User banned' };
  }

  static async unbanUser(accessToken, userId) {
    const decoded = requireAdmin(JwtUtil.verifyAccessToken(accessToken));

    const existing = await dbBreaker.fire(() => UserModel.findById(userId));
    if (!existing) throw new errors.ResourceNotFoundError('User not found');
    if (!existing.banned_at) throw new errors.ConflictError('User is not banned');

    await dbBreaker.fire(() => UserModel.unban(userId));

    logger.info('User unbanned', {
      type: 'audit', action: 'user.unban',
      actor_id: decoded.id, actor_email: decoded.email, actor_role: decoded.role,
      resource_type: 'user', resource_id: userId,
    });

    return { success: true, message: 'User unbanned' };
  }

  // ─────────────────────── News Management ───────────────────────

  static async createArticle(accessToken, { title, content, type, cover_image_url, categories }) {
    const decoded = requireAdmin(JwtUtil.verifyAccessToken(accessToken));

    const result = await grpcBreaker.fire(() =>
      newsClient.createArticle({ access_token: accessToken, title, content, type, cover_image_url, categories })
    );

    logger.info('Article created via admin', {
      type: 'audit', action: 'article.create',
      actor_id: decoded.id, actor_email: decoded.email, actor_role: decoded.role,
      resource_type: 'article', resource_id: result.article?.id, title,
    });

    return { success: true, article: result.article };
  }

  static async deleteArticle(accessToken, articleId) {
    const decoded = requireAdmin(JwtUtil.verifyAccessToken(accessToken));

    await grpcBreaker.fire(() =>
      newsClient.deleteArticle({ access_token: accessToken, id: articleId })
    );

    logger.info('Article deleted via admin', {
      type: 'audit', action: 'article.delete',
      actor_id: decoded.id, actor_email: decoded.email, actor_role: decoded.role,
      resource_type: 'article', resource_id: articleId,
    });

    return { success: true, message: 'Article deleted' };
  }

  static async getUploadUrl(accessToken, { filename, content_type, article_id }) {
    const decoded = requireAdmin(JwtUtil.verifyAccessToken(accessToken));

    const result = await grpcBreaker.fire(() =>
      newsClient.getUploadUrl({ access_token: accessToken, filename, content_type, article_id })
    );

    logger.info('Upload URL generated via admin', {
      type: 'audit', action: 'media.upload_url',
      actor_id: decoded.id, actor_email: decoded.email, actor_role: decoded.role,
      filename, content_type, article_id,
    });

    return { success: true, upload_url: result.upload_url, file_url: result.file_url, expires_in: result.expires_in };
  }

  static async getArticleStats(accessToken) {
    const decoded = requireAdmin(JwtUtil.verifyAccessToken(accessToken));

    const result = await grpcBreaker.fire(() =>
      newsClient.getArticleStats({ access_token: accessToken })
    );

    logger.info('Article stats fetched via admin', {
      type: 'audit', action: 'article.stats',
      actor_id: decoded.id, actor_role: decoded.role,
    });

    return {
      success: true,
      total_articles: result.total_articles,
      total_blog: result.total_blog,
      total_news: result.total_news,
      total_views: result.total_views,
    };
  }

  // ─────────────────────── Subscriptions ───────────────────────

  static async adminSetSubscription(accessToken, { user_id, sub_type, duration_months, issued_by }) {
    const decoded = requireAdmin(JwtUtil.verifyAccessToken(accessToken));

    const result = await grpcBreaker.fire(() =>
      subscriptionClient.adminSetSubscription({ access_token: accessToken, user_id, sub_type, duration_months, issued_by })
    );

    logger.info('Subscription set via admin', {
      type: 'audit', action: 'subscription.set',
      actor_id: decoded.id, actor_email: decoded.email, actor_role: decoded.role,
      resource_type: 'subscription', target_user_id: user_id, sub_type, duration_months, issued_by,
    });

    return { success: true, subscription: result.subscription };
  }

  static async adminRemoveSubscription(accessToken, { user_id, reason }) {
    const decoded = requireAdmin(JwtUtil.verifyAccessToken(accessToken));

    await grpcBreaker.fire(() =>
      subscriptionClient.adminRemoveSubscription({ access_token: accessToken, user_id, reason })
    );

    logger.info('Subscription removed via admin', {
      type: 'audit', action: 'subscription.remove',
      actor_id: decoded.id, actor_email: decoded.email, actor_role: decoded.role,
      resource_type: 'subscription', target_user_id: user_id, reason,
    });

    return { success: true, message: 'Subscription removed' };
  }

  static async getSubscriptionStats(accessToken) {
    const decoded = requireAdmin(JwtUtil.verifyAccessToken(accessToken));

    const result = await grpcBreaker.fire(() =>
      subscriptionClient.getSubscriptionStats({ access_token: accessToken })
    );

    logger.info('Subscription stats fetched via admin', {
      type: 'audit', action: 'subscription.stats',
      actor_id: decoded.id, actor_role: decoded.role,
    });

    return {
      success: true,
      total_active: result.total_active,
      total_expired: result.total_expired,
      total_canceled: result.total_canceled,
      total_terminated: result.total_terminated,
      by_tier: result.by_tier,
    };
  }

  // ─────────────────────── Promo Codes ───────────────────────

  static async createPromoCode(accessToken, { code, discount_type, discount_value, max_uses, applicable_tiers, min_duration_months, valid_until }) {
    const decoded = requireAdmin(JwtUtil.verifyAccessToken(accessToken));

    const result = await grpcBreaker.fire(() =>
      subscriptionClient.createPromoCode({ access_token: accessToken, code, discount_type, discount_value, max_uses, applicable_tiers, min_duration_months, valid_until })
    );

    logger.info('Promo code created via admin', {
      type: 'audit', action: 'promo.create',
      actor_id: decoded.id, actor_email: decoded.email, actor_role: decoded.role,
      resource_type: 'promo_code', code,
    });

    return { success: true, promo_code: result.promo_code };
  }

  static async listPromoCodes(accessToken, { page, limit, active_only }) {
    const decoded = requireAdmin(JwtUtil.verifyAccessToken(accessToken));

    const result = await grpcBreaker.fire(() =>
      subscriptionClient.listPromoCodes({ access_token: accessToken, page, limit, active_only })
    );

    logger.info('Promo codes listed via admin', {
      type: 'audit', action: 'promo.list',
      actor_id: decoded.id, actor_role: decoded.role,
    });

    return { success: true, promo_codes: result.promo_codes || [], total: result.total };
  }

  static async deactivatePromoCode(accessToken, code) {
    const decoded = requireAdmin(JwtUtil.verifyAccessToken(accessToken));

    await grpcBreaker.fire(() =>
      subscriptionClient.deactivatePromoCode({ access_token: accessToken, code })
    );

    logger.info('Promo code deactivated via admin', {
      type: 'audit', action: 'promo.deactivate',
      actor_id: decoded.id, actor_email: decoded.email, actor_role: decoded.role,
      resource_type: 'promo_code', code,
    });

    return { success: true, message: 'Promo code deactivated' };
  }

  // ─────────────────────── Notifications ───────────────────────

  static async sendNotification(accessToken, { user_id, email, subject, body, channel }) {
    const decoded = requireAdmin(JwtUtil.verifyAccessToken(accessToken));

    const result = await grpcBreaker.fire(() =>
      notificationClient.sendNotification({
        user_id, email, type: 'manual', channel: channel || 'email', subject, body,
      })
    );

    logger.info('Notification sent via admin', {
      type: 'audit', action: 'notification.send',
      actor_id: decoded.id, actor_email: decoded.email, actor_role: decoded.role,
      resource_type: 'notification', recipient_user_id: user_id, recipient_email: email,
    });

    return { success: true, message: 'Notification sent', notification_id: result.notification_id };
  }

  static async sendBulkNotification(accessToken, { subject, body, channel, recipients }) {
    const decoded = requireAdmin(JwtUtil.verifyAccessToken(accessToken));

    // If no recipients provided, query all eligible users from DB
    let targetRecipients = recipients;
    if (!targetRecipients || targetRecipients.length === 0) {
      const users = await dbBreaker.fire(() => UserModel.getAllEmails());
      targetRecipients = users.map(u => ({ user_id: u.id, email: u.email }));
    }

    if (targetRecipients.length === 0) {
      return { success: true, message: 'No eligible recipients found', total: 0, sent: 0, failed: 0 };
    }

    const BATCH_SIZE = 50;
    let sent = 0;
    let failed = 0;

    for (let i = 0; i < targetRecipients.length; i += BATCH_SIZE) {
      const batch = targetRecipients.slice(i, i + BATCH_SIZE);

      const results = await Promise.allSettled(
        batch.map(({ user_id, email }) =>
          grpcBreaker.fire(() =>
            notificationClient.sendNotification({
              user_id, email, type: 'manual', channel: channel || 'email', subject, body,
            })
          )
        )
      );

      for (const result of results) {
        if (result.status === 'fulfilled') sent++;
        else failed++;
      }
    }

    logger.info('Bulk notification sent via admin', {
      type: 'audit', action: 'notification.bulk_send',
      actor_id: decoded.id, actor_email: decoded.email, actor_role: decoded.role,
      total: targetRecipients.length, sent, failed,
    });

    return {
      success: true,
      message: `Bulk send complete: ${sent} sent, ${failed} failed`,
      total: targetRecipients.length,
      sent,
      failed,
    };
  }
}
