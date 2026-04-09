import grpc from '@grpc/grpc-js';
import protoLoader from '@grpc/proto-loader';
import path from 'path';
import { fileURLToPath } from 'url';
import logger from '../utils/logger.util.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let authClient = null;

const getAuthClient = () => {
  if (authClient) return authClient;

  const protoPath = path.join(__dirname, '../../../auth-service/proto/auth.proto');
  const pkgDef = protoLoader.loadSync(protoPath, {
    keepCase: true,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true,
  });

  const authProto = grpc.loadPackageDefinition(pkgDef).auth;
  const host = process.env.AUTH_SERVICE_HOST || 'localhost';
  const port = process.env.AUTH_SERVICE_PORT || 50051;

  authClient = new authProto.AuthService(
    `${host}:${port}`,
    grpc.credentials.createInsecure()
  );

  logger.info('Auth gRPC client initialized', { host, port });
  return authClient;
};

export const getUserById = (userId) => {
  return new Promise((resolve, reject) => {
    const client = getAuthClient();
    client.GetUserById({ user_id: String(userId) }, (err, response) => {
      if (err) {
        logger.error('Auth gRPC GetUserById failed', { error: err.message, userId });
        return reject(err);
      }
      resolve(response);
    });
  });
};
