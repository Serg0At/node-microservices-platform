import jwt from 'jsonwebtoken';
import { config } from '../config/variables.config.js';

export function verifyAccessToken(token) {
  return jwt.verify(token, config.jwt.publicKey, {
    algorithms: [config.jwt.algorithm],
    audience: config.jwt.audience,
    issuer: config.jwt.issuer,
  });
}

export function isTokenExpiredError(err) {
  return err instanceof jwt.TokenExpiredError;
}
