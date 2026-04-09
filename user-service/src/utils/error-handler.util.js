import * as grpc from '@grpc/grpc-js';
import logger from './logger.util.js';

const ERROR_TO_GRPC_STATUS = {
  ConflictError:             grpc.status.ALREADY_EXISTS,
  InputValidationError:      grpc.status.INVALID_ARGUMENT,
  UnauthorizedError:         grpc.status.UNAUTHENTICATED,
  ResourceNotFoundError:     grpc.status.NOT_FOUND,
  PermissionError:           grpc.status.PERMISSION_DENIED,
};

const PG_CODE_TO_GRPC_STATUS = {
  '23505': grpc.status.ALREADY_EXISTS,
  '23503': grpc.status.FAILED_PRECONDITION,
  '23502': grpc.status.INVALID_ARGUMENT,
  '23514': grpc.status.INVALID_ARGUMENT,
};

const ERRORS_NAME = [
  'ConflictError',
  'InputValidationError',
  'UnauthorizedError',
  'ResourceNotFoundError',
  'PermissionError',
];

const ErrorsUtil = ERRORS_NAME.reduce((acc, className) => {
  acc[className] = ({
    [className]: class extends Error {
      constructor(msg, status) {
        super(msg);
        this.message = msg;
        this.status = status;
        this.name = className;
      }
    }
  })[className];
  return acc;
}, {});

export default class ErrorHandler {
  static get errors() {
    return ErrorsUtil;
  }

  static resolveGrpcStatus(error) {
    if (error.name && ERROR_TO_GRPC_STATUS[error.name]) {
      return ERROR_TO_GRPC_STATUS[error.name];
    }
    if (error.code && PG_CODE_TO_GRPC_STATUS[error.code]) {
      return PG_CODE_TO_GRPC_STATUS[error.code];
    }
    return grpc.status.INTERNAL;
  }

  static handle(callback, error, meta = {}) {
    const { method = 'unknown', ...extra } = meta;
    const code = ErrorHandler.resolveGrpcStatus(error);

    logger.error(error.message, {
      method,
      errorName: error.name,
      grpcCode: code,
      stack: error.stack,
      ...extra
    });

    callback({ code, message: error.message });
  }

  static invalidArgument(callback, message, meta = {}) {
    const { method = 'unknown', ...extra } = meta;
    logger.warn(message, { method, grpcCode: grpc.status.INVALID_ARGUMENT, ...extra });
    callback({ code: grpc.status.INVALID_ARGUMENT, message });
  }

  static unauthenticated(callback, message = 'Invalid credentials', meta = {}) {
    const { method = 'unknown', ...extra } = meta;
    logger.warn(message, { method, grpcCode: grpc.status.UNAUTHENTICATED, ...extra });
    callback({ code: grpc.status.UNAUTHENTICATED, message });
  }

  static notFound(callback, message = 'Resource not found', meta = {}) {
    const { method = 'unknown', ...extra } = meta;
    logger.warn(message, { method, grpcCode: grpc.status.NOT_FOUND, ...extra });
    callback({ code: grpc.status.NOT_FOUND, message });
  }

  static alreadyExists(callback, message = 'Resource already exists', meta = {}) {
    const { method = 'unknown', ...extra } = meta;
    logger.warn(message, { method, grpcCode: grpc.status.ALREADY_EXISTS, ...extra });
    callback({ code: grpc.status.ALREADY_EXISTS, message });
  }

  static internal(callback, message = 'Internal server error', meta = {}) {
    const { method = 'unknown', ...extra } = meta;
    logger.error(message, { method, grpcCode: grpc.status.INTERNAL, ...extra });
    callback({ code: grpc.status.INTERNAL, message });
  }
}
