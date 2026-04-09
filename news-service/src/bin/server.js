import 'dotenv/config';
import grpc from '@grpc/grpc-js';
import logger from '../utils/logger.util.js';
import { loadNewsProto } from './loader.js';
import { ArticleController } from '../controllers/index.js';

export const startGrpc = async () => {
  let proto;
  try {
    proto = loadNewsProto();
  } catch (err) {
    logger.error('Failed to load news proto', { error: err.message, stack: err.stack });
    throw err;
  }
  const server = new grpc.Server();

  server.addService(proto.NewsService.service, {
    // Articles
    CreateArticle: ArticleController.createArticle.bind(ArticleController),
    DeleteArticle: ArticleController.deleteArticle.bind(ArticleController),
    GetArticle: ArticleController.getArticle.bind(ArticleController),
    ListArticles: ArticleController.listArticles.bind(ArticleController),
    SearchArticles: ArticleController.searchArticles.bind(ArticleController),
    // Media
    GetUploadUrl: ArticleController.getUploadUrl.bind(ArticleController),
    // Stats
    GetArticleStats: ArticleController.getArticleStats.bind(ArticleController),
  });

  const port = process.env.SERVICE_PORT || 50054;

  await new Promise((res, rej) =>
    server.bindAsync(
      `0.0.0.0:${port}`,
      grpc.ServerCredentials.createInsecure(),
      (err) => {
        if (err) return rej(err);
        logger.info(`gRPC server started on ${port}`);
        res();
      }
    )
  );

  const shutdown = () => {
    logger.info('gRPC shutdown signal received');
    server.tryShutdown((err) => {
      if (err) {
        logger.error('gRPC force shutdown due to errors', { error: err.message, stack: err.stack });
        server.forceShutdown();
        process.exit(1);
      } else {
        logger.info('gRPC graceful shutdown completed');
        process.exit(0);
      }
    });
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
};
