import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import fs from 'fs';
import config from '../config/variables.config.js';

// Load keys for RS256 (Access Tokens)
const privateKey = fs.readFileSync(config.TOKENS.ACCESS.PRIVATE_KEY_PATH, 'utf8');
const publicKey = fs.readFileSync(config.TOKENS.ACCESS.PUBLIC_KEY_PATH, 'utf8');

export default class JwtUtil {
  static generateAccessToken(payload, uaHash, extraClaims = {}) {
    const accessToken = jwt.sign(
      { ...payload, ua_hash: uaHash, ...extraClaims },
      privateKey,
      {
        algorithm: config.TOKENS.ACCESS.ALG,
        expiresIn: config.TOKENS.ACCESS.TTL,
        issuer: config.TOKENS.ISSUER,
        audience: config.TOKENS.AUDIENCE
      }
    );
    return { accessToken };
  }

  static generateRefreshToken() {
    return crypto.randomBytes(32).toString('hex');
  }

  static verifyAccessToken(token) {
    try {
      return jwt.verify(token, publicKey, {
        algorithms: [config.TOKENS.ACCESS.ALG]
      });
    } catch (err) {
      return null;
    }
  }
}
