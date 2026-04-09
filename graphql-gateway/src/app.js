import { readFileSync } from 'fs';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@apollo/server/express4';
import { makeExecutableSchema } from '@graphql-tools/schema';

import { config } from './config/variables.config.js';
import { buildContext } from './middlewares/auth-context.js';
import { authResolvers } from './graphql/resolvers/auth.resolver.js';
import { userResolvers } from './graphql/resolvers/user.resolver.js';
import { notificationResolvers } from './graphql/resolvers/notification.resolver.js';
import { newsResolvers } from './graphql/resolvers/news.resolver.js';
import { adminResolvers } from './graphql/resolvers/admin.resolver.js';
import { subscriptionResolvers } from './graphql/resolvers/subscription.resolver.js';
import { authDirectiveTransformer } from './graphql/directives/auth.directive.js';
import { rateLimitDirectiveTransformer } from './graphql/directives/rate-limit.directive.js';
import { requireRoleDirectiveTransformer } from './graphql/directives/require-role.directive.js';
import { formatError } from './utils/error-formatter.js';
import { logger } from './utils/logger.js';

const typeDefs = readFileSync(
  new URL('./graphql/typeDefs/schema.graphql', import.meta.url),
  'utf8',
);

const resolvers = {
  Query: {
    ...userResolvers.Query,
    ...notificationResolvers.Query,
    ...newsResolvers.Query,
    ...adminResolvers.Query,
    ...subscriptionResolvers.Query,
  },
  Mutation: {
    ...authResolvers.Mutation,
    ...userResolvers.Mutation,
    ...notificationResolvers.Mutation,
    ...newsResolvers.Mutation,
    ...adminResolvers.Mutation,
    ...subscriptionResolvers.Mutation,
  },
};

let schema = makeExecutableSchema({ typeDefs, resolvers });
schema = authDirectiveTransformer(schema);
schema = requireRoleDirectiveTransformer(schema);
schema = rateLimitDirectiveTransformer(schema);

const tokenRefreshPlugin = {
  async requestDidStart() {
    return {
      async willSendResponse({ contextValue, response }) {
        if (contextValue.newTokens) {
          response.extensions = {
            ...response.extensions,
            newTokens: contextValue.newTokens,
          };
        }
      },
    };
  },
};

const server = new ApolloServer({
  schema,
  formatError,
  plugins: [tokenRefreshPlugin],
  introspection: config.env !== 'production',
});

await server.start();

const app = express();

app.use(helmet({ contentSecurityPolicy: config.env === 'production' ? undefined : false }));
app.use(cors({ origin: config.cors.origin, credentials: true }));
app.use(cookieParser());
app.use(
  rateLimit({
    windowMs: config.rateLimit.windowMs,
    max: (req) => {
      try {
        const auth = req.headers.authorization;
        if (auth?.startsWith('Bearer ')) {
          const payload = JSON.parse(
            Buffer.from(auth.slice(7).split('.')[1], 'base64url').toString(),
          );
          return payload.role === 1 ? 500 : 200;
        }
      } catch { /* fall through to default */ }
      return config.rateLimit.max;
    },
    keyGenerator: (req) => {
      try {
        const auth = req.headers.authorization;
        if (auth?.startsWith('Bearer ')) {
          const payload = JSON.parse(
            Buffer.from(auth.slice(7).split('.')[1], 'base64url').toString(),
          );
          if (payload.id || payload.sub) return `user:${payload.id || payload.sub}`;
        }
      } catch { /* fall through to IP */ }
      return ipKeyGenerator(req);
    },
    standardHeaders: true,
    legacyHeaders: false,
  }),
);

app.use(
  '/graphql',
  express.json(),
  expressMiddleware(server, {
    context: async ({ req, res }) => buildContext({ req, res }),
  }),
);

app.get('/health', (_, res) => res.json({ status: 'ok' }));

app.listen(config.port, () => {
  logger.info(`GraphQL Gateway running at http://localhost:${config.port}/graphql`);
});
