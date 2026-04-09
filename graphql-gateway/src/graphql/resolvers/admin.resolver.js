import { GraphQLError } from 'graphql';
import * as adminGrpc from '../../grpc/clients/admin-client.js';
import { Validation } from '../../middlewares/validations/index.js';
import { audit } from '../../utils/audit.js';

function mapUser(u) {
  if (!u) return null;
  return {
    id: u.id,
    email: u.email,
    username: u.username,
    role: u.role,
    status: u.status,
    createdAt: u.created_at,
    updatedAt: u.updated_at,
    bannedAt: u.banned_at,
    banReason: u.ban_reason,
  };
}

function mapArticle(a) {
  if (!a) return null;
  return {
    id: a.id,
    title: a.title,
    slug: a.slug,
    content: a.content,
    authorId: a.author_id,
    type: a.type,
    coverImageUrl: a.cover_image_url,
    viewCount: a.view_count,
    publishedAt: a.published_at,
    createdAt: a.created_at,
    updatedAt: a.updated_at,
    categories: a.categories || [],
  };
}

function mapSubscription(s) {
  if (!s) return null;
  return {
    id: s.id,
    userId: s.user_id,
    subType: s.sub_type,
    freeTrial: s.free_trial,
    status: s.status,
    startedAt: s.started_at,
    endedAt: s.ended_at,
    gracePeriodEnd: s.grace_period_end,
    issuedBy: s.issued_by,
    createdAt: s.created_at,
    updatedAt: s.updated_at,
  };
}

function mapPagination(p) {
  if (!p) return null;
  return {
    page: p.page,
    limit: p.limit,
    total: p.total,
    totalPages: p.total_pages,
  };
}

function mapPromoCode(pc) {
  if (!pc) return null;
  return {
    id: pc.id,
    code: pc.code,
    discountType: pc.discount_type,
    discountValue: pc.discount_value,
    maxUses: pc.max_uses,
    usedCount: pc.used_count,
    applicableTiers: pc.applicable_tiers || [],
    minDurationMonths: pc.min_duration_months,
    validFrom: pc.valid_from,
    validUntil: pc.valid_until,
    active: pc.active,
    createdAt: pc.created_at,
    updatedAt: pc.updated_at,
  };
}

export const adminResolvers = {
  Query: {
    async dashboardStats(_, __, { token, userAgent }) {
      const res = await adminGrpc.getDashboardStats({ access_token: token }, userAgent);
      return {
        success: res.success,
        totalUsers: res.total_users,
        totalBanned: res.total_banned,
        totalArticles: res.total_articles,
        totalCategories: res.total_categories,
        totalViews: res.total_views,
        articlesToday: res.articles_today,
        usersToday: res.users_today,
      };
    },

    async adminUsers(_, { page, limit, search, role, status }, { token, userAgent }) {
      const res = await adminGrpc.listUsers(
        {
          access_token: token,
          page: page || 1,
          limit: limit || 20,
          search: search || '',
          role: role ?? -1,
          status: status ?? -1,
        },
        userAgent,
      );
      return {
        success: res.success,
        users: (res.users || []).map(mapUser),
        pagination: mapPagination(res.pagination),
      };
    },

    async adminUser(_, { userId }, { token, userAgent }) {
      const res = await adminGrpc.getUser({ access_token: token, user_id: userId }, userAgent);
      return { success: res.success, user: mapUser(res.user) };
    },

    async adminArticleStats(_, __, { token, userAgent }) {
      const res = await adminGrpc.getArticleStats({ access_token: token }, userAgent);
      return {
        success: res.success,
        totalArticles: res.total_articles,
        totalBlog: res.total_blog,
        totalNews: res.total_news,
        totalViews: res.total_views,
      };
    },

    async adminSubscriptionStats(_, __, { token, userAgent }) {
      const res = await adminGrpc.getSubscriptionStats({ access_token: token }, userAgent);
      return {
        success: res.success,
        totalActive: res.total_active,
        totalExpired: res.total_expired,
        totalCanceled: res.total_canceled,
        totalTerminated: res.total_terminated,
        byTier: (res.by_tier || []).map(tc => ({ tier: tc.tier, count: tc.count })),
      };
    },
  },

  Mutation: {
    async updateUserRole(_, { userId, role }, { token, userAgent, user, ip }) {
      const res = await adminGrpc.updateUserRole(
        { access_token: token, user_id: userId, role },
        userAgent,
      );
      audit('user.role.update', {
        user, ip, userAgent, resourceType: 'user',
        resourceId: userId, meta: { new_role: role },
      });
      return { success: res.success, message: res.message, user: mapUser(res.user) };
    },

    async banUser(_, { userId, reason }, { token, userAgent, user, ip }) {
      const res = await adminGrpc.banUser(
        { access_token: token, user_id: userId, reason: reason || '' },
        userAgent,
      );
      audit('user.ban', {
        user, ip, userAgent, resourceType: 'user',
        resourceId: userId, meta: { reason },
      });
      return { success: res.success, message: res.message };
    },

    async unbanUser(_, { userId }, { token, userAgent, user, ip }) {
      const res = await adminGrpc.unbanUser(
        { access_token: token, user_id: userId },
        userAgent,
      );
      audit('user.unban', {
        user, ip, userAgent, resourceType: 'user', resourceId: userId,
      });
      return { success: res.success, message: res.message };
    },

    async adminCreateArticle(_, { title, content, type, coverImageUrl, categories }, { token, userAgent, user, ip }) {
      const { error } = Validation.validateAdminCreateArticle({ title, content, type, coverImageUrl, categories });
      if (error) {
        throw new GraphQLError(error.details.map(d => d.message).join('; '), {
          extensions: { code: 'BAD_USER_INPUT' },
        });
      }
      const res = await adminGrpc.createArticle(
        { access_token: token, title, content, type, cover_image_url: coverImageUrl || '', categories: categories || [] },
        userAgent,
      );
      audit('admin.article.create', {
        user, ip, userAgent, resourceType: 'article',
        resourceId: res.article?.id, meta: { title },
      });
      return { success: res.success, article: mapArticle(res.article) };
    },

    async adminDeleteArticle(_, { articleId }, { token, userAgent, user, ip }) {
      const { error } = Validation.validateAdminDeleteArticle({ articleId });
      if (error) {
        throw new GraphQLError(error.details.map(d => d.message).join('; '), {
          extensions: { code: 'BAD_USER_INPUT' },
        });
      }
      const res = await adminGrpc.deleteArticle(
        { access_token: token, article_id: articleId },
        userAgent,
      );
      audit('admin.article.delete', {
        user, ip, userAgent, resourceType: 'article', resourceId: articleId,
      });
      return { success: res.success, message: res.message };
    },

    async adminGetUploadUrl(_, { filename, contentType, articleId }, { token, userAgent, user, ip }) {
      const res = await adminGrpc.getUploadUrl(
        { access_token: token, filename, content_type: contentType, article_id: articleId || '' },
        userAgent,
      );
      audit('admin.media.upload_url', {
        user, ip, userAgent, resourceType: 'media',
        meta: { filename, contentType, articleId },
      });
      return {
        success: res.success,
        uploadUrl: res.upload_url,
        fileUrl: res.file_url,
        expiresIn: res.expires_in,
      };
    },

    async adminSetSubscription(_, { userId, subType, durationMonths, issuedBy }, { token, userAgent, user, ip }) {
      const res = await adminGrpc.adminSetSubscription(
        { access_token: token, user_id: userId, sub_type: subType, duration_months: durationMonths, issued_by: issuedBy },
        userAgent,
      );
      audit('admin.subscription.set', {
        user, ip, userAgent, resourceType: 'subscription',
        resourceId: userId, meta: { subType, durationMonths, issuedBy },
      });
      return { success: res.success, subscription: mapSubscription(res.subscription) };
    },

    async adminRemoveSubscription(_, { userId, reason }, { token, userAgent, user, ip }) {
      const res = await adminGrpc.adminRemoveSubscription(
        { access_token: token, user_id: userId, reason: reason || '' },
        userAgent,
      );
      audit('admin.subscription.remove', {
        user, ip, userAgent, resourceType: 'subscription',
        resourceId: userId, meta: { reason },
      });
      return { success: res.success, message: res.message };
    },

    async adminCreatePromoCode(_, { code, discountType, discountValue, maxUses, applicableTiers, minDurationMonths, validUntil }, { token, userAgent, user, ip }) {
      const res = await adminGrpc.createPromoCode(
        {
          access_token: token,
          code,
          discount_type: discountType,
          discount_value: discountValue,
          max_uses: maxUses || 0,
          applicable_tiers: applicableTiers || [],
          min_duration_months: minDurationMonths || 1,
          valid_until: validUntil || '',
        },
        userAgent,
      );
      audit('admin.promo_code.create', {
        user, ip, userAgent, resourceType: 'promo_code',
        resourceId: res.promo_code?.id, meta: { code, discountType, discountValue },
      });
      return { success: res.success, promoCode: mapPromoCode(res.promo_code) };
    },

    async adminListPromoCodes(_, { page, limit, activeOnly }, { token, userAgent }) {
      const res = await adminGrpc.listPromoCodes(
        {
          access_token: token,
          page: page || 1,
          limit: limit || 20,
          active_only: activeOnly ?? false,
        },
        userAgent,
      );
      return {
        success: res.success,
        promoCodes: (res.promo_codes || []).map(mapPromoCode),
        total: res.total,
      };
    },

    async adminDeactivatePromoCode(_, { code }, { token, userAgent, user, ip }) {
      const res = await adminGrpc.deactivatePromoCode(
        { access_token: token, code },
        userAgent,
      );
      audit('admin.promo_code.deactivate', {
        user, ip, userAgent, resourceType: 'promo_code',
        meta: { code },
      });
      return { success: res.success, message: res.message };
    },

    async adminSendNotification(_, { userId, email, subject, body, channel }, { token, userAgent, user, ip }) {
      const { error } = Validation.validateAdminSendNotification({ userId, email, subject, body, channel });
      if (error) {
        throw new GraphQLError(error.details.map(d => d.message).join('; '), {
          extensions: { code: 'BAD_USER_INPUT' },
        });
      }
      const res = await adminGrpc.adminSendNotification(
        { access_token: token, user_id: userId, email, subject, body, channel: channel || 'email' },
        userAgent,
      );
      audit('admin.notification.send', {
        user, ip, userAgent, resourceType: 'notification',
        resourceId: res.notification_id, meta: { recipient: userId, channel: channel || 'email' },
      });
      return { success: res.success, message: res.message, notificationId: res.notification_id };
    },

    async adminSendBulkNotification(_, { subject, body, channel, recipients }, { token, userAgent, user, ip }) {
      const { error } = Validation.validateAdminSendBulkNotification({ subject, body, channel, recipients });
      if (error) {
        throw new GraphQLError(error.details.map(d => d.message).join('; '), {
          extensions: { code: 'BAD_USER_INPUT' },
        });
      }
      const grpcRecipients = recipients ? recipients.map(r => ({ user_id: r.userId, email: r.email })) : [];
      const res = await adminGrpc.adminSendBulkNotification(
        { access_token: token, subject, body, channel: channel || 'email', recipients: grpcRecipients },
        userAgent,
      );
      audit('admin.notification.bulk', {
        user, ip, userAgent, resourceType: 'notification',
        meta: { channel: channel || 'email', total: res.total, sent: res.sent, failed: res.failed },
      });
      return {
        success: res.success,
        message: res.message,
        total: res.total,
        sent: res.sent,
        failed: res.failed,
      };
    },
  },
};
