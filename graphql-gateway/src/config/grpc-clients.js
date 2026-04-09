import path from 'path';
import { fileURLToPath } from 'url';
import grpc from '@grpc/grpc-js';
import protoLoader from '@grpc/proto-loader';
import { config } from './variables.config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROTO_DIR = path.join(__dirname, '..', 'grpc', 'protos');

const loaderOptions = {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
};

function loadProto(protoFile, packageName) {
  const packageDef = protoLoader.loadSync(path.join(PROTO_DIR, protoFile), loaderOptions);
  return grpc.loadPackageDefinition(packageDef)[packageName];
}

const authProto = loadProto('auth.proto', 'auth');
const userProto = loadProto('user.proto', 'user');
const notificationProto = loadProto('notification.proto', 'notification');
const newsProto = loadProto('news.proto', 'news');
const adminProto = loadProto('admin.proto', 'admin');
const subscriptionProto = loadProto('subscription.proto', 'subscription');

export const authClient = new authProto.AuthService(
  config.grpc.authServiceUrl,
  grpc.credentials.createInsecure(),
);

export const userClient = new userProto.UserService(
  config.grpc.userServiceUrl,
  grpc.credentials.createInsecure(),
);

export const notificationClient = new notificationProto.NotificationService(
  config.grpc.notificationServiceUrl,
  grpc.credentials.createInsecure(),
);

export const newsClient = new newsProto.NewsService(
  config.grpc.newsServiceUrl,
  grpc.credentials.createInsecure(),
);

export const adminClient = new adminProto.AdminService(
  config.grpc.adminServiceUrl,
  grpc.credentials.createInsecure(),
);

export const subscriptionClient = new subscriptionProto.SubscriptionService(
  config.grpc.subscriptionServiceUrl,
  grpc.credentials.createInsecure(),
);
