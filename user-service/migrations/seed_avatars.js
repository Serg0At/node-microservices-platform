import 'dotenv/config';
import { S3Client, CreateBucketCommand, HeadBucketCommand, HeadObjectCommand, PutObjectCommand, ListObjectsV2Command, DeleteObjectCommand, PutBucketPolicyCommand } from '@aws-sdk/client-s3';
import { readFileSync, readdirSync } from 'fs';
import { join, extname } from 'path';

const MINIO_ENDPOINT = process.env.MINIO_ENDPOINT || 'http://localhost:9000';
const MINIO_PUBLIC_URL = process.env.MINIO_PUBLIC_URL || 'http://localhost:9000';
const ACCESS_KEY = process.env.MINIO_ACCESS_KEY || 'minioadmin';
const SECRET_KEY = process.env.MINIO_SECRET_KEY || 'minioadmin';
const BUCKET = process.env.MINIO_BUCKET || 'arbex-assets';
const REGION = process.env.MINIO_REGION || 'us-east-1';
const PREFIX = 'avatars/defaults/';

const MIME_MAP = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
};

const args = process.argv.slice(2);
const forceReseed = args.includes('--force');

async function seed() {
  const s3 = new S3Client({
    endpoint: MINIO_ENDPOINT,
    region: REGION,
    credentials: { accessKeyId: ACCESS_KEY, secretAccessKey: SECRET_KEY },
    forcePathStyle: true,
  });

  // 1. Ensure bucket
  try {
    await s3.send(new HeadBucketCommand({ Bucket: BUCKET }));
    console.log(`Bucket "${BUCKET}" exists`);
  } catch {
    await s3.send(new CreateBucketCommand({ Bucket: BUCKET }));
    console.log(`Bucket "${BUCKET}" created`);
  }

  // 2. Set public-read policy on avatars/*
  const policy = {
    Version: '2012-10-17',
    Statement: [
      {
        Effect: 'Allow',
        Principal: '*',
        Action: ['s3:GetObject'],
        Resource: [`arn:aws:s3:::${BUCKET}/avatars/*`],
      },
    ],
  };

  await s3.send(new PutBucketPolicyCommand({ Bucket: BUCKET, Policy: JSON.stringify(policy) }));
  console.log('Bucket policy set (public-read on avatars/*)');

  // 3. If --force, delete existing defaults first
  if (forceReseed) {
    console.log('--force flag detected, removing existing default avatars...');
    const existing = await s3.send(new ListObjectsV2Command({ Bucket: BUCKET, Prefix: PREFIX }));
    if (existing.Contents) {
      for (const obj of existing.Contents) {
        await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: obj.Key }));
      }
      console.log(`Deleted ${existing.Contents.length} existing default avatars`);
    }
  }

  // 4. Read local avatar files
  const assetsDir = join(process.cwd(), 'assets', 'default-avatars');
  let files;
  try {
    files = readdirSync(assetsDir)
      .filter((f) => /\.(png|jpe?g|webp|gif|svg)$/i.test(f))
      .sort();
  } catch {
    console.error(`Directory not found: ${assetsDir}`);
    console.error('Place avatar images in assets/default-avatars/ and try again');
    process.exit(1);
  }

  if (files.length === 0) {
    console.error('No image files found in assets/default-avatars/');
    process.exit(1);
  }

  // 5. Upload
  let uploaded = 0;
  let skipped = 0;

  for (const file of files) {
    const key = `${PREFIX}${file}`;

    if (!forceReseed) {
      try {
        await s3.send(new HeadObjectCommand({ Bucket: BUCKET, Key: key }));
        skipped++;
        continue;
      } catch {
        // not found, will upload
      }
    }

    const body = readFileSync(join(assetsDir, file));
    const ext = extname(file).toLowerCase();

    await s3.send(new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: body,
      ContentType: MIME_MAP[ext] || 'application/octet-stream',
    }));

    uploaded++;
    const url = `${MINIO_PUBLIC_URL}/${BUCKET}/${key}`;
    console.log(`  Uploaded: ${file} -> ${url}`);
  }

  console.log(`\nDone. Uploaded: ${uploaded}, Skipped: ${skipped}, Total: ${files.length}`);
  process.exit(0);
}

seed().catch((err) => {
  console.error('Seed failed:', err.message);
  process.exit(1);
});
