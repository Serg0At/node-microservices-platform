import { mapSchema, getDirective, MapperKind } from '@graphql-tools/utils';
import { GraphQLError } from 'graphql';

const rateLimitStore = new Map();

const ROLE_MULTIPLIER = { 0: 1, 1: 3 };

function parseWindow(window) {
  const match = window.match(/^(\d+)(s|m|h)$/);
  if (!match) return 60_000;
  const value = parseInt(match[1], 10);
  const unit = match[2];
  if (unit === 's') return value * 1_000;
  if (unit === 'm') return value * 60_000;
  return value * 3_600_000;
}

export function rateLimitDirectiveTransformer(schema, directiveName = 'rateLimit') {
  return mapSchema(schema, {
    [MapperKind.OBJECT_FIELD]: (fieldConfig) => {
      const directive = getDirective(schema, fieldConfig, directiveName)?.[0];
      if (!directive) return fieldConfig;

      const { max, window } = directive;
      const windowMs = parseWindow(window);
      const { resolve: originalResolve } = fieldConfig;

      fieldConfig.resolve = async (source, args, context, info) => {
        const user = context.user;
        const identifier = user ? `user:${user.id}` : `ip:${context.ip || 'unknown'}`;
        const key = `${info.fieldName}:${identifier}`;
        const now = Date.now();

        const multiplier = user ? (ROLE_MULTIPLIER[user.role] || 1) : 1;
        const effectiveMax = max * multiplier;

        let entry = rateLimitStore.get(key);
        if (!entry || now - entry.start > windowMs) {
          entry = { count: 0, start: now };
          rateLimitStore.set(key, entry);
        }

        entry.count++;

        if (entry.count > effectiveMax) {
          throw new GraphQLError('Too many requests, please try again later', {
            extensions: { code: 'RATE_LIMITED' },
          });
        }

        return originalResolve(source, args, context, info);
      };

      return fieldConfig;
    },
  });
}
