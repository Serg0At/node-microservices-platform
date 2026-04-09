import db from '../config/db.js';

export default class OAuthModel {
  static _db(trx) {
    return trx || db;
  }

  static async findByProvider(provider, externalId, trx) {
    return OAuthModel._db(trx)('user_oauth')
      .where({ provider, external_id: externalId })
      .join('users', 'user_oauth.user_id', 'users.id')
      .select('users.id', 'users.email', 'users.username', 'users.role')
      .first();
  }

  static async create(data, trx) {
    return OAuthModel._db(trx)('user_oauth').insert(data);
  }

  static async updateTokens(provider, externalId, data, trx) {
    const update = { ...data, updated_at: db.fn.now() };
    if (update.refresh_token === null) delete update.refresh_token;
    return OAuthModel._db(trx)('user_oauth')
      .where({ provider, external_id: externalId })
      .update(update);
  }
}
