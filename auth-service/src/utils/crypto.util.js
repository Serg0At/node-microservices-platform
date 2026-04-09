import bcrypt from 'bcryptjs';
import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const SALT_ROUNDS = 10;

export default class CryptoUtil {
  // --- Password Hashing (Internal use for Register/Login) ---
  static async hashPassword(password) {
    return bcrypt.hash(password, SALT_ROUNDS);
  }

  static async comparePassword(password, hash) {
    return bcrypt.compare(password, hash);
  }

  // --- SHA-256 Hash (For User-Agent session binding) ---
  static hashUA(userAgent) {
    return crypto.createHash('sha256').update(userAgent).digest('hex');
  }

  // --- SHA-256 Hash (Generic — for fingerprint/IP trial tracking) ---
  static sha256(value) {
    return crypto.createHash('sha256').update(value).digest('hex');
  }

  // --- Email Normalization (strip +alias, lowercase) ---
  static normalizeEmail(email) {
    const [local, domain] = email.toLowerCase().split('@');
    const stripped = local.split('+')[0];
    return `${stripped}@${domain}`;
  }

  // --- AES Encryption (For 2FA Secrets & OAuth Tokens) ---
  static encrypt(text, masterKey) {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, Buffer.from(masterKey, 'hex'), iv);
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag().toString('hex');
    
    // We return everything needed to decrypt later: iv, tag, and the data
    return `${iv.toString('hex')}:${authTag}:${encrypted}`;
  }

  static decrypt(encryptedData, masterKey) {
    const [ivHex, authTagHex, encryptedText] = encryptedData.split(':');
    
    const decipher = crypto.createDecipheriv(
      ALGORITHM, 
      Buffer.from(masterKey, 'hex'), 
      Buffer.from(ivHex, 'hex')
    );
    
    decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
    
    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }
}