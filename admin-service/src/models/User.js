import db from '../config/db.js';

const USER_COLUMNS = [
  'id', 'email', 'username', 'role',
  'banned_at', 'ban_reason',
  'created_at', 'updated_at',
];

export default class UserModel {
  static _db(trx) {
    return trx || db;
  }

  static async findById(id, trx) {
    return UserModel._db(trx)('users')
      .select(USER_COLUMNS)
      .where({ id })
      .first();
  }

  static async list({ page = 1, limit = 20, search, role, status } = {}, trx) {
    const query = UserModel._db(trx)('users').select(USER_COLUMNS);

    if (search) {
      query.where(function () {
        this.whereILike('email', `%${search}%`)
          .orWhereILike('username', `%${search}%`);
      });
    }

    if (role !== undefined && role !== -1) {
      query.where('role', role);
    }

    if (status !== undefined && status !== -1) {
      if (status === 1) {
        query.whereNotNull('banned_at');
      } else {
        query.whereNull('banned_at');
      }
    }

    const countQuery = query.clone().count('* as total').first();
    const total = (await countQuery).total;

    const offset = (page - 1) * Math.min(limit, 100);
    const users = await query
      .orderBy('created_at', 'desc')
      .limit(Math.min(limit, 100))
      .offset(offset);

    return {
      users,
      pagination: {
        page,
        limit: Math.min(limit, 100),
        total: Number(total),
        total_pages: Math.ceil(Number(total) / Math.min(limit, 100)),
      },
    };
  }

  static async updateRole(id, role, trx) {
    const [user] = await UserModel._db(trx)('users')
      .where({ id })
      .update({ role, updated_at: db.fn.now() })
      .returning(USER_COLUMNS);
    return user;
  }

  static async ban(id, reason, trx) {
    const [user] = await UserModel._db(trx)('users')
      .where({ id })
      .update({ banned_at: db.fn.now(), ban_reason: reason, updated_at: db.fn.now() })
      .returning(USER_COLUMNS);
    return user;
  }

  static async unban(id, trx) {
    const [user] = await UserModel._db(trx)('users')
      .where({ id })
      .update({ banned_at: null, ban_reason: null, updated_at: db.fn.now() })
      .returning(USER_COLUMNS);
    return user;
  }

  static async countAll(trx) {
    const result = await UserModel._db(trx)('users').count('* as total').first();
    return Number(result.total);
  }

  static async countBanned(trx) {
    const result = await UserModel._db(trx)('users')
      .whereNotNull('banned_at')
      .count('* as total')
      .first();
    return Number(result.total);
  }

  static async countToday(trx) {
    const result = await UserModel._db(trx)('users')
      .where('created_at', '>=', db.raw("CURRENT_DATE"))
      .count('* as total')
      .first();
    return Number(result.total);
  }

  static async countArticles(trx) {
    const result = await UserModel._db(trx)('articles').count('* as total').first();
    return Number(result.total);
  }

  static async countArticlesToday(trx) {
    const result = await UserModel._db(trx)('articles')
      .where('created_at', '>=', db.raw("CURRENT_DATE"))
      .count('* as total')
      .first();
    return Number(result.total);
  }

  static async countCategories(trx) {
    const result = await UserModel._db(trx)('categories').count('* as total').first();
    return Number(result.total);
  }

  static async totalViews(trx) {
    const result = await UserModel._db(trx)('articles').sum('view_count as total').first();
    return Number(result.total || 0);
  }

  static async getAllEmails(trx) {
    const rows = await UserModel._db(trx)('users')
      .select('id', 'email')
      .whereNull('banned_at')
      .whereNotNull('email');
    return rows;
  }
}
