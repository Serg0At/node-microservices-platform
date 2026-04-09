import db from '../config/db.js';

export default class AuthModel {
  static _db(trx) {
    return trx || db;
  }

  static async findByEmailOrUsername(emailUsername, trx) {
    return AuthModel._db(trx)('users')
      .where({ email: emailUsername })
      .orWhere({ username: emailUsername })
      .select('id', 'email', 'username', 'role', 'password_hash', 'is_active')
      .first();
  }

  static async findByEmail(email, trx) {
    return AuthModel._db(trx)('users')
      .where({ email })
      .select('id', 'email', 'username')
      .first();
  }

  static async findByUsername(username, trx) {
    return AuthModel._db(trx)('users')
      .where({ username })
      .select('id', 'email', 'username')
      .first();
  }

  static async findById(id, trx) {
    return AuthModel._db(trx)('users')
      .where({ id })
      .select('id', 'email', 'username', 'role', 'is_active')
      .first();
  }

  static async create(data, trx) {
    const [user] = await AuthModel._db(trx)('users')
      .insert(data)
      .returning(['id', 'email', 'username', 'role']);
    return user;
  }

  static async activate(userId, trx) {
    return AuthModel._db(trx)('users')
      .where({ id: userId })
      .update({ is_active: true });
  }

  static async updateLastLogin(userId, trx) {
    return AuthModel._db(trx)('users')
      .where({ id: userId })
      .update({ last_login: db.fn.now() });
  }

  static async updatePassword(userId, passwordHash, trx) {
    return AuthModel._db(trx)('users')
      .where({ id: userId })
      .update({ password_hash: passwordHash, updated_at: db.fn.now() });
  }

  static async find2FAByUserId(userId, trx) {
    return AuthModel._db(trx)('user_2fa')
      .where({ user_id: userId })
      .select('id', 'user_id', 'secret', 'backup_codes', 'enabled')
      .first();
  }

  static async create2FA(userId, encryptedSecret, backupCodes, trx) {
    const [row] = await AuthModel._db(trx)('user_2fa')
      .insert({
        user_id: userId,
        secret: encryptedSecret,
        backup_codes: JSON.stringify(backupCodes),
        enabled: false,
      })
      .returning(['id', 'user_id', 'enabled']);
    return row;
  }

  static async enable2FA(userId, trx) {
    return AuthModel._db(trx)('user_2fa')
      .where({ user_id: userId })
      .update({ enabled: true, updated_at: db.fn.now() });
  }

  static async delete2FA(userId, trx) {
    return AuthModel._db(trx)('user_2fa')
      .where({ user_id: userId })
      .del();
  }

  static async update2FABackupCodes(userId, backupCodes, trx) {
    return AuthModel._db(trx)('user_2fa')
      .where({ user_id: userId })
      .update({ backup_codes: JSON.stringify(backupCodes), updated_at: db.fn.now() });
  }

  static async updateUsername(userId, username, trx) {
    return AuthModel._db(trx)('users')
      .where({ id: userId })
      .update({ username, updated_at: db.fn.now() });
  }
}
