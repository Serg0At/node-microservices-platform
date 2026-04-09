import grpc from '@grpc/grpc-js';
import protoLoader from '@grpc/proto-loader';
import path from 'path';
import { fileURLToPath } from 'url';
import config from '../../config/variables.config.js';
import logger from '../../utils/logger.util.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const protoPath = path.join(__dirname, '../../../proto/news.proto');
const pkgDef = protoLoader.loadSync(protoPath, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});

const newsProto = grpc.loadPackageDefinition(pkgDef).news;
const newsClient = new newsProto.NewsService(
  config.GRPC.NEWS_SERVICE_URL,
  grpc.credentials.createInsecure(),
);

logger.info(`News gRPC client connected to ${config.GRPC.NEWS_SERVICE_URL}`);

function callRpc(method, request) {
  return new Promise((resolve, reject) => {
    newsClient[method](request, (err, response) => {
      if (err) return reject(err);
      resolve(response);
    });
  });
}

export function createArticle({ access_token, title, content, type, cover_image_url, categories }) {
  return callRpc('CreateArticle', { access_token, title, content, type, cover_image_url, categories });
}

export function deleteArticle({ access_token, id }) {
  return callRpc('DeleteArticle', { access_token, id });
}

export function getUploadUrl({ access_token, filename, content_type, article_id }) {
  return callRpc('GetUploadUrl', { access_token, filename, content_type, article_id });
}

export function getArticleStats({ access_token }) {
  return callRpc('GetArticleStats', { access_token });
}
