import jwt from 'jsonwebtoken';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicKey = fs.readFileSync(path.resolve(__dirname, '../../keys/access_public.pem'), 'utf8');

export const verifyAccessToken = (token) => {
  try {
    return jwt.verify(token, publicKey, {
      algorithms: ['RS256'],
      issuer: 'auth-service',
      audience: 'graphql-gateway',
    });
  } catch {
    return null;
  }
};
