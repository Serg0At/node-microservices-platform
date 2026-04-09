import db from '../config/db.js';

export default class ProfileModel {
  static _db(trx) {
    return trx || db;
  }

  static async findByUserId(userId, trx) {
    return ProfileModel._db(trx)('profiles')
      .where({ user_id: userId })
      .select('id', 'user_id', 'username', 'display_name', 'avatar_url', 'created_at', 'updated_at')
      .first();
  }

  static async findByUsername(username, trx) {
    return ProfileModel._db(trx)('profiles')
      .where({ username })
      .select('id', 'user_id', 'username', 'display_name', 'avatar_url')
      .first();
  }

  static async create(data, trx) {
    const [profile] = await ProfileModel._db(trx)('profiles')
      .insert(data)
      .returning(['id', 'user_id', 'username', 'display_name', 'avatar_url']);
    return profile;
  }

  static async update(userId, data, trx) {
    const [profile] = await ProfileModel._db(trx)('profiles')
      .where({ user_id: userId })
      .update({ ...data, updated_at: db.fn.now() })
      .returning(['id', 'user_id', 'username', 'display_name', 'avatar_url']);
    return profile;
  }
}
