import grpc from '@grpc/grpc-js';
import protoLoader from '@grpc/proto-loader';
import path from 'path';
import { fileURLToPath } from 'url';
import config from '../../config/variables.config.js';
import logger from '../../utils/logger.util.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const protoPath = path.join(__dirname, '../../../proto/notification.proto');
const pkgDef = protoLoader.loadSync(protoPath, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});

const notificationProto = grpc.loadPackageDefinition(pkgDef).notification;
const notificationClient = new notificationProto.NotificationService(
  config.GRPC.NOTIFICATION_SERVICE_URL,
  grpc.credentials.createInsecure(),
);

logger.info(`Notification gRPC client connected to ${config.GRPC.NOTIFICATION_SERVICE_URL}`);

function callRpc(method, request) {
  return new Promise((resolve, reject) => {
    notificationClient[method](request, (err, response) => {
      if (err) return reject(err);
      resolve(response);
    });
  });
}

export function sendNotification({ user_id, email, type, channel, subject, body }) {
  return callRpc('SendNotification', { user_id, email, type, channel, subject, body });
}
