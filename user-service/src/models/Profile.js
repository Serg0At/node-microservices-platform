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

  /**
   * Idempotent insert. Safe to call from a RabbitMQ consumer that may
   * receive the same `user.registered` event more than once (at-least-once
   * delivery + redelivery on consumer crash between commit and ack).
   *
   * Returns the existing or newly-created profile row either way.
   */
  static async createIfNotExists(data, trx) {
    const inserted = await ProfileModel._db(trx)('profiles')
      .insert(data)
      .onConflict('user_id')
      .ignore()
      .returning(['id', 'user_id', 'username', 'display_name', 'avatar_url']);

    if (inserted.length > 0) return { profile: inserted[0], created: true };

    const existing = await ProfileModel.findByUserId(data.user_id, trx);
    return { profile: existing, created: false };
  }

  static async update(userId, data, trx) {
    const [profile] = await ProfileModel._db(trx)('profiles')
      .where({ user_id: userId })
      .update({ ...data, updated_at: db.fn.now() })
      .returning(['id', 'user_id', 'username', 'display_name', 'avatar_url']);
    return profile;
  }
}
