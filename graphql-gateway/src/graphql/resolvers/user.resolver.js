import { GraphQLError } from 'graphql';
import { Validation } from '../../middlewares/validations/index.js';
import * as userGrpc from '../../grpc/clients/user-client.js';

function mapProfile(p) {
  if (!p) return null;
  return {
    userId: p.user_id,
    username: p.username,
    displayName: p.display_name,
    avatarUrl: p.avatar_url,
  };
}

export const userResolvers = {
  Query: {
    async me(_, __, { user, userAgent }) {
      const res = await userGrpc.getProfile({ user_id: user.id }, userAgent);
      return mapProfile(res.profile);
    },

    async profile(_, { userId }, { userAgent }) {
      const res = await userGrpc.getProfile({ user_id: userId }, userAgent);
      return mapProfile(res.profile);
    },
  },

  Mutation: {
    async updateProfile(_, { username, displayName }, { token, userAgent }) {
      const input = {};
      if (username !== undefined) input.username = username;
      if (displayName !== undefined) input.displayName = displayName;

      const { error } = Validation.validateUpdateProfile(input);
      if (error) {
        throw new GraphQLError(
          error.details.map((d) => d.message).join('; '),
          { extensions: { code: 'BAD_USER_INPUT' } },
        );
      }

      const res = await userGrpc.updateProfile(
        {
          access_token: token,
          username: username || '',
          display_name: displayName || '',
        },
        userAgent,
      );

      return {
        success: res.success,
        message: res.message,
        profile: mapProfile(res.profile),
      };
    },

    async uploadAvatar(_, { imageBase64, contentType, fileName }, { token, userAgent }) {
      const { error } = Validation.validateUploadAvatar({ contentType, fileName });
      if (error) {
        throw new GraphQLError(
          error.details.map((d) => d.message).join('; '),
          { extensions: { code: 'BAD_USER_INPUT' } },
        );
      }

      const imageBuffer = Buffer.from(imageBase64, 'base64');
      if (imageBuffer.length > 5 * 1024 * 1024) {
        throw new GraphQLError('Image exceeds 5MB limit', {
          extensions: { code: 'BAD_USER_INPUT' },
        });
      }

      const res = await userGrpc.uploadAvatar(
        {
          access_token: token,
          image_data: imageBuffer,
          content_type: contentType,
          file_name: fileName,
        },
        userAgent,
      );

      return {
        success: res.success,
        message: res.message,
        avatarUrl: res.avatar_url,
        profile: mapProfile(res.profile),
      };
    },
  },
};
