import jwt from 'jsonwebtoken';
import fs from 'fs';
import config from '../config/variables.config.js';

const publicKey = fs.readFileSync(config.TOKENS.ACCESS.PUBLIC_KEY_PATH, 'utf8');

export default class JwtUtil {
  static verifyAccessToken(token) {
    try {
      return jwt.verify(token, publicKey, {
        algorithms: [config.TOKENS.ACCESS.ALG],
      });
    } catch (err) {
      return null;
    }
  }
}
