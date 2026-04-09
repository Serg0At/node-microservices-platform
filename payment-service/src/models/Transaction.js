import db from '../config/db.js';

export default class TransactionModel {
  static _db(trx) {
    return trx || db;
  }

  static async create(data, trx) {
    const [transaction] = await TransactionModel._db(trx)('transactions')
      .insert(data)
      .returning('*');
    return transaction;
  }

  static async findById(id, trx) {
    return TransactionModel._db(trx)('transactions')
      .where({ id })
      .first();
  }

  static async findByProviderOrderId(providerOrderId, trx) {
    return TransactionModel._db(trx)('transactions')
      .where({ provider_order_id: providerOrderId })
      .first();
  }

  static async findByUserId(userId, { limit = 20, offset = 0, status } = {}, trx) {
    const query = TransactionModel._db(trx)('transactions')
      .where({ user_id: userId })
      .orderBy('created_at', 'desc')
      .limit(Math.min(limit, 100))
      .offset(offset);

    if (status) query.andWhere({ status });

    return query;
  }

  static async countByUserId(userId, { status } = {}, trx) {
    const query = TransactionModel._db(trx)('transactions')
      .where({ user_id: userId })
      .count('id as count');

    if (status) query.andWhere({ status });

    const [{ count }] = await query;
    return Number(count);
  }

  static async updateStatus(id, status, extra = {}, trx) {
    const [updated] = await TransactionModel._db(trx)('transactions')
      .where({ id })
      .update({ status, updated_at: db.fn.now(), ...extra })
      .returning('*');
    return updated;
  }

  static async updateByProviderOrderId(providerOrderId, data, trx) {
    const [updated] = await TransactionModel._db(trx)('transactions')
      .where({ provider_order_id: providerOrderId })
      .update({ ...data, updated_at: db.fn.now() })
      .returning('*');
    return updated;
  }
}
