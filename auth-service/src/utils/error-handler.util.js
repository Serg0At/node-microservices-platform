import * as grpc from '@grpc/grpc-js';
import logger from './logger.util.js';

/**
 * Maps custom error names to gRPC status codes.
 */
const ERROR_TO_GRPC_STATUS = {
  ExpiredEmailConfirmError:  grpc.status.DEADLINE_EXCEEDED,
  ExpiredTokenConfirmError:  grpc.status.DEADLINE_EXCEEDED,
  ConflictError:             grpc.status.ALREADY_EXISTS,
  Forbidden:                 grpc.status.PERMISSION_DENIED,
  PermissionError:           grpc.status.PERMISSION_DENIED,
  InputValidationError:      grpc.status.INVALID_ARGUMENT,
  InvalidEmailConfirmError:  grpc.status.INVALID_ARGUMENT,
  Invalid2FACodeError:        grpc.status.UNAUTHENTICATED,
  InvalidPasswordError:      grpc.status.UNAUTHENTICATED,
  MicroserviceError:         grpc.status.INTERNAL,
  UnauthorizedError:         grpc.status.UNAUTHENTICATED,
  ResourceNotFoundError:     grpc.status.NOT_FOUND
};

/**
 * Maps Postgres error codes to gRPC status codes.
 */
const PG_CODE_TO_GRPC_STATUS = {
  '23505': grpc.status.ALREADY_EXISTS,      // unique_violation
  '23503': grpc.status.FAILED_PRECONDITION, // foreign_key_violation
  '23502': grpc.status.INVALID_ARGUMENT,    // not_null_violation
  '23514': grpc.status.INVALID_ARGUMENT     // check_violation
};

const ERRORS_NAME = [
  'ExpiredEmailConfirmError',
  'ExpiredTokenConfirmError',
  'ConflictError',
  'Forbidden',
  'PermissionError',
  'InputValidationError',
  'Invalid2FACodeError',
  'InvalidEmailConfirmError',
  'InvalidPasswordError',
  'MicroserviceError',
  'UnauthorizedError',
  'ResourceNotFoundError'
];

/**
 * Custom error classes (preserved from original implementation).
 */
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
  /**
   * Get all custom error classes.
   */
  static get errors() {
    return ErrorsUtil;
  }

  /**
   * Resolve gRPC status code from any error.
   */
  static resolveGrpcStatus(error) {
    if (error.name && ERROR_TO_GRPC_STATUS[error.name]) {
      return ERROR_TO_GRPC_STATUS[error.name];
    }
    if (error.code && PG_CODE_TO_GRPC_STATUS[error.code]) {
      return PG_CODE_TO_GRPC_STATUS[error.code];
    }
    return grpc.status.INTERNAL;
  }

  /**
   * Handle any error: log it and send a gRPC error callback.
   *
   * @param {Function} callback - gRPC callback
   * @param {Error}    error    - Caught error
   * @param {object}   [meta]   - Extra log context { method, userId, ... }
   */
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

  /**
   * Handle validation / bad input errors.
   */
  static invalidArgument(callback, message, meta = {}) {
    const { method = 'unknown', ...extra } = meta;

    logger.warn(message, { method, grpcCode: grpc.status.INVALID_ARGUMENT, ...extra });
    callback({ code: grpc.status.INVALID_ARGUMENT, message });
  }

  /**
   * Handle authentication failures.
   */
  static unauthenticated(callback, message = 'Invalid credentials', meta = {}) {
    const { method = 'unknown', ...extra } = meta;

    logger.warn(message, { method, grpcCode: grpc.status.UNAUTHENTICATED, ...extra });
    callback({ code: grpc.status.UNAUTHENTICATED, message });
  }

  /**
   * Handle permission / authorization errors.
   */
  static permissionDenied(callback, message = 'Permission denied', meta = {}) {
    const { method = 'unknown', ...extra } = meta;

    logger.warn(message, { method, grpcCode: grpc.status.PERMISSION_DENIED, ...extra });
    callback({ code: grpc.status.PERMISSION_DENIED, message });
  }

  /**
   * Handle resource not found errors.
   */
  static notFound(callback, message = 'Resource not found', meta = {}) {
    const { method = 'unknown', ...extra } = meta;

    logger.warn(message, { method, grpcCode: grpc.status.NOT_FOUND, ...extra });
    callback({ code: grpc.status.NOT_FOUND, message });
  }

  /**
   * Handle conflict / duplicate errors (e.g. unique constraint).
   */
  static alreadyExists(callback, message = 'Resource already exists', meta = {}) {
    const { method = 'unknown', ...extra } = meta;

    logger.warn(message, { method, grpcCode: grpc.status.ALREADY_EXISTS, ...extra });
    callback({ code: grpc.status.ALREADY_EXISTS, message });
  }

  /**
   * Handle internal / unexpected errors.
   */
  static internal(callback, message = 'Internal server error', meta = {}) {
    const { method = 'unknown', ...extra } = meta;

    logger.error(message, { method, grpcCode: grpc.status.INTERNAL, ...extra });
    callback({ code: grpc.status.INTERNAL, message });
  }
}
