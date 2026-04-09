import { GraphQLError } from 'graphql';
import { logger } from './logger.js';

const GRPC_TO_GQL_CODE = {
  3:  'BAD_USER_INPUT',       // INVALID_ARGUMENT
  5:  'NOT_FOUND',            // NOT_FOUND
  6:  'CONFLICT',             // ALREADY_EXISTS
  7:  'FORBIDDEN',            // PERMISSION_DENIED
  16: 'UNAUTHENTICATED',     // UNAUTHENTICATED
};

export function grpcToGraphQLError(err) {
  const code = err.code;
  const gqlCode = GRPC_TO_GQL_CODE[code] || 'INTERNAL_SERVER_ERROR';
  const message = err.details || err.message || 'Internal server error';

  return new GraphQLError(message, {
    extensions: { code: gqlCode },
  });
}

export function formatError(formattedError, error) {
  logger.error('GraphQL Error', {
    message: formattedError.message,
    code: formattedError.extensions?.code,
    path: formattedError.path,
  });

  if (process.env.SERVICE_ENV === 'production') {
    delete formattedError.extensions?.stacktrace;
  }

  return formattedError;
}
