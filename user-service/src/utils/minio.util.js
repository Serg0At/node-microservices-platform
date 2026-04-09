import { S3Client, CreateBucketCommand, HeadBucketCommand, HeadObjectCommand, PutObjectCommand, DeleteObjectCommand, PutBucketPolicyCommand } from '@aws-sdk/client-s3';
import { readFileSync, readdirSync } from 'fs';
import { join, extname } from 'path';
import config from '../config/variables.config.js';
import logger from './logger.util.js';

const { MINIO } = config;

let s3Client = null;

const MIME_MAP = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
};

export const initMinio = async () => {
  s3Client = new S3Client({
    endpoint: MINIO.ENDPOINT,
    region: MINIO.REGION,
    credentials: {
      accessKeyId: MINIO.ACCESS_KEY,
      secretAccessKey: MINIO.SECRET_KEY,
    },
    forcePathStyle: true,
  });

  await ensureBucket();
  await seedDefaultAvatars();
  logger.info('MinIO initialized', { bucket: MINIO.BUCKET });
};

const ensureBucket = async () => {
  try {
    await s3Client.send(new HeadBucketCommand({ Bucket: MINIO.BUCKET }));
  } catch {
    await s3Client.send(new CreateBucketCommand({ Bucket: MINIO.BUCKET }));
    logger.info('MinIO bucket created', { bucket: MINIO.BUCKET });
  }

  const policy = {
    Version: '2012-10-17',
    Statement: [
      {
        Effect: 'Allow',
        Principal: '*',
        Action: ['s3:GetObject'],
        Resource: [`arn:aws:s3:::${MINIO.BUCKET}/avatars/*`],
      },
    ],
  };

  await s3Client.send(
    new PutBucketPolicyCommand({
      Bucket: MINIO.BUCKET,
      Policy: JSON.stringify(policy),
    })
  );
};

const seedDefaultAvatars = async () => {
  const assetsDir = join(process.cwd(), 'assets', 'default-avatars');

  let files;
  try {
    files = readdirSync(assetsDir).filter((f) => /\.(png|jpe?g|webp|gif|svg)$/i.test(f));
  } catch {
    logger.warn('No default-avatars directory found — skipping seed', { path: assetsDir });
    return;
  }

  if (files.length === 0) {
    logger.warn('No avatar images found in assets/default-avatars/');
    return;
  }

  let seeded = 0;
  for (const file of files) {
    const key = `${MINIO.DEFAULT_AVATARS_PREFIX}${file}`;

    try {
      await s3Client.send(new HeadObjectCommand({ Bucket: MINIO.BUCKET, Key: key }));
    } catch {
      const body = readFileSync(join(assetsDir, file));
      const ext = extname(file).toLowerCase();
      await s3Client.send(
        new PutObjectCommand({
          Bucket: MINIO.BUCKET,
          Key: key,
          Body: body,
          ContentType: MIME_MAP[ext] || 'application/octet-stream',
        })
      );
      seeded++;
    }
  }

  if (seeded > 0) logger.info(`Seeded ${seeded} default avatars into MinIO`);
};

export const uploadObject = async (key, body, contentType) => {
  await s3Client.send(
    new PutObjectCommand({
      Bucket: MINIO.BUCKET,
      Key: key,
      Body: body,
      ContentType: contentType,
    })
  );
  return getPublicUrl(key);
};

export const deleteObject = async (key) => {
  await s3Client.send(new DeleteObjectCommand({ Bucket: MINIO.BUCKET, Key: key }));
};

export const getPublicUrl = (key) => `${MINIO.PUBLIC_URL}/${MINIO.BUCKET}/${key}`;

export const getRandomDefaultAvatarUrl = () => {
  const index = Math.floor(Math.random() * MINIO.DEFAULT_AVATAR_COUNT) + 1;
  const fileName = `avatar-${String(index).padStart(2, '0')}.png`;
  return getPublicUrl(`${MINIO.DEFAULT_AVATARS_PREFIX}${fileName}`);
};

export const extractKeyFromUrl = (url) => {
  const prefix = `${MINIO.PUBLIC_URL}/${MINIO.BUCKET}/`;
  if (url.startsWith(prefix)) return url.slice(prefix.length);
  return null;
};

export const isDefaultAvatar = (url) => {
  if (!url) return true;
  return url.includes(MINIO.DEFAULT_AVATARS_PREFIX);
};
