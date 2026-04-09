import { mapSchema, getDirective, MapperKind } from '@graphql-tools/utils';
import { GraphQLError } from 'graphql';

const ROLE_MAP = { USER: 0, ADMIN: 1 };

export function requireRoleDirectiveTransformer(
  schema,
  directiveName = 'requireRole',
) {
  return mapSchema(schema, {
    [MapperKind.OBJECT_FIELD]: (fieldConfig) => {
      const directive = getDirective(schema, fieldConfig, directiveName)?.[0];
      if (!directive) return fieldConfig;

      const requiredRole = ROLE_MAP[directive.role];
      const { resolve: originalResolve } = fieldConfig;

      fieldConfig.resolve = async (source, args, context, info) => {
        if (!context.user) {
          throw new GraphQLError('Authentication required', {
            extensions: { code: 'UNAUTHENTICATED' },
          });
        }

        if (context.user.role < requiredRole) {
          throw new GraphQLError('Insufficient permissions', {
            extensions: { code: 'FORBIDDEN' },
          });
        }

        return originalResolve(source, args, context, info);
      };

      return fieldConfig;
    },
  });
}
