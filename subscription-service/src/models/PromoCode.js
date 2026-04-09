import db from '../config/db.js';

export default class PromoCodeModel {
  static _db(trx) {
    return trx || db;
  }

  static async create(data, trx) {
    const [promoCode] = await PromoCodeModel._db(trx)('promo_codes')
      .insert(data)
      .returning('*');
    return promoCode;
  }

  static async findByCode(code, trx) {
    return PromoCodeModel._db(trx)('promo_codes')
      .where({ code: code.toUpperCase() })
      .first();
  }

  static async findById(id, trx) {
    return PromoCodeModel._db(trx)('promo_codes')
      .where({ id })
      .first();
  }

  static async list({ page = 1, limit = 20, activeOnly = false }, trx) {
    const conn = PromoCodeModel._db(trx);
    const query = conn('promo_codes').orderBy('created_at', 'desc');

    if (activeOnly) {
      query.where({ active: true });
    }

    const countQuery = query.clone().count('id as count').first();
    const dataQuery = query.clone()
      .limit(limit)
      .offset((page - 1) * limit);

    const [{ count }, promoCodes] = await Promise.all([countQuery, dataQuery]);

    return {
      promo_codes: promoCodes,
      total: Number(count),
    };
  }

  static async deactivate(code, trx) {
    const [updated] = await PromoCodeModel._db(trx)('promo_codes')
      .where({ code: code.toUpperCase() })
      .update({ active: false, updated_at: db.fn.now() })
      .returning('*');
    return updated;
  }

  static async incrementUsedCount(code, trx) {
    const [updated] = await PromoCodeModel._db(trx)('promo_codes')
      .where({ code: code.toUpperCase() })
      .increment('used_count', 1)
      .update({ updated_at: db.fn.now() })
      .returning('*');
    return updated;
  }
}
