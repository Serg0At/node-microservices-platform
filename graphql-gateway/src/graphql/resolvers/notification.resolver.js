import { GraphQLError } from 'graphql';
import { Validation } from '../../middlewares/validations/index.js';
import * as notifGrpc from '../../grpc/clients/notification-client.js';

function validate(validatorFn, data) {
  const { error } = validatorFn(data);
  if (error) {
    throw new GraphQLError(
      error.details.map((d) => d.message).join('; '),
      { extensions: { code: 'BAD_USER_INPUT' } },
    );
  }
}

function mapNotification(n) {
  if (!n) return null;
  return {
    id: n.id,
    userId: n.user_id,
    type: n.type,
    channel: n.channel,
    title: n.title,
    body: n.body,
    status: n.status,
    read: n.read,
    createdAt: n.created_at,
    sentAt: n.sent_at,
    readAt: n.read_at,
  };
}

export const notificationResolvers = {
  Query: {
    async notifications(_, { limit, offset, typeFilter, readFilter }, { user, userAgent }) {
      validate(Validation.validateGetNotifications, { limit, offset, typeFilter, readFilter });
      const res = await notifGrpc.getNotifications(
        {
          user_id: user.id,
          limit: limit || 20,
          offset: offset || 0,
          type_filter: typeFilter || '',
          read_filter: readFilter || '',
        },
        userAgent,
      );
      return {
        success: res.success,
        notifications: (res.notifications || []).map(mapNotification),
        totalCount: res.total_count || 0,
      };
    },

    async unreadCount(_, __, { user, userAgent }) {
      const res = await notifGrpc.getUnreadCount({ user_id: user.id }, userAgent);
      return { success: res.success, count: res.count || 0 };
    },
  },

  Mutation: {
    async markAsRead(_, { notificationId }, { user, userAgent }) {
      validate(Validation.validateMarkAsRead, { notificationId });
      const res = await notifGrpc.markAsRead(
        { notification_id: notificationId, user_id: user.id },
        userAgent,
      );
      return { success: res.success, message: res.message };
    },

    async markAllAsRead(_, __, { user, userAgent }) {
      const res = await notifGrpc.markAllAsRead({ user_id: user.id }, userAgent);
      return {
        success: res.success,
        message: res.message,
        updatedCount: res.updated_count || 0,
      };
    },

    async deleteNotification(_, { notificationId }, { user, userAgent }) {
      validate(Validation.validateDeleteNotification, { notificationId });
      const res = await notifGrpc.deleteNotification(
        { notification_id: notificationId, user_id: user.id },
        userAgent,
      );
      return { success: res.success, message: res.message };
    },
  },
};
