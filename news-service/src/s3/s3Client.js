import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import config from '../config/variables.config.js';
import logger from '../utils/logger.util.js';

let s3;

export const initS3 = () => {
  s3 = new S3Client({
    endpoint: config.S3.ENDPOINT,
    region: config.S3.REGION,
    credentials: {
      accessKeyId: config.S3.ACCESS_KEY,
      secretAccessKey: config.S3.SECRET_KEY,
    },
    forcePathStyle: config.S3.FORCE_PATH_STYLE,
  });
  logger.info('S3 client initialized', { endpoint: config.S3.ENDPOINT, bucket: config.S3.BUCKET });
  return s3;
};

export const getS3 = () => {
  if (!s3) throw new Error('S3 client not initialized');
  return s3;
};

export const getPresignedUploadUrl = async (key, contentType) => {
  const command = new PutObjectCommand({
    Bucket: config.S3.BUCKET,
    Key: key,
    ContentType: contentType,
  });

  const uploadUrl = await getSignedUrl(getS3(), command, {
    expiresIn: config.S3.PRESIGNED_URL_EXPIRES,
  });

  const fileUrl = `${config.S3.ENDPOINT}/${config.S3.BUCKET}/${key}`;

  return { uploadUrl, fileUrl, expiresIn: config.S3.PRESIGNED_URL_EXPIRES };
};
