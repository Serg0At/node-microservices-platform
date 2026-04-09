import jwt from 'jsonwebtoken';
import fs from 'fs';
import config from '../config/variables.config.js';

const publicKey = fs.readFileSync(config.TOKENS.ACCESS.PUBLIC_KEY_PATH, 'utf-8');

export default class JwtUtil {
  static verifyAccessToken(token) {
    return jwt.verify(token, publicKey, {
      algorithms: [config.TOKENS.ACCESS.ALG],
      issuer: config.TOKENS.ISSUER,
      audience: config.TOKENS.AUDIENCE,
    });
  }
}
