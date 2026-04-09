import db from '../config/db.js';

export default class ArticleModel {
  static _db(trx) {
    return trx || db;
  }

  static async findById(id, trx) {
    return ArticleModel._db(trx)('articles')
      .where('id', id)
      .first();
  }

  static async findBySlug(slug, trx) {
    return ArticleModel._db(trx)('articles')
      .where('slug', slug)
      .first();
  }

  static async create(data, trx) {
    const [article] = await ArticleModel._db(trx)('articles')
      .insert(data)
      .returning('*');
    return article;
  }

  static async delete(id, trx) {
    return ArticleModel._db(trx)('articles')
      .where({ id })
      .del();
  }

  static async incrementViewCount(id, trx) {
    await ArticleModel._db(trx)('articles')
      .where({ id })
      .increment('view_count', 1);
  }

  static async list({ page, limit, category, author_id }, trx) {
    const query = ArticleModel._db(trx)('articles')
      .select(
        'id', 'title', 'slug', 'author_id',
        'type', 'categories', 'cover_image_url',
        'view_count', 'published_at', 'created_at'
      );

    if (category) query.whereRaw('? = ANY(categories)', [category]);
    if (author_id) query.where('author_id', author_id);

    const countQuery = query.clone().clearSelect().clearOrder().count('id as total').first();

    query.orderBy('published_at', 'desc');
    query.limit(limit).offset((page - 1) * limit);

    const [articles, countResult] = await Promise.all([query, countQuery]);
    return { articles, total: parseInt(countResult.total, 10) };
  }

  static async search({ query: searchQuery, page, limit, category, author_id }, trx) {
    const baseQuery = ArticleModel._db(trx)('articles')
      .whereRaw(
        "to_tsvector('english', coalesce(title,'') || ' ' || coalesce(content,'')) @@ plainto_tsquery('english', ?)",
        [searchQuery]
      );

    if (category) baseQuery.whereRaw('? = ANY(categories)', [category]);
    if (author_id) baseQuery.where('author_id', author_id);

    const countQuery = baseQuery.clone().clearSelect().clearOrder().count('id as total').first();

    baseQuery.select(
      'id', 'title', 'slug', 'author_id',
      'type', 'categories', 'cover_image_url',
      'view_count', 'published_at', 'created_at',
      db.raw("ts_rank(to_tsvector('english', coalesce(title,'') || ' ' || coalesce(content,'')), plainto_tsquery('english', ?)) as relevance", [searchQuery])
    );

    baseQuery.orderBy('relevance', 'desc');
    baseQuery.limit(limit).offset((page - 1) * limit);

    const [articles, countResult] = await Promise.all([baseQuery, countQuery]);
    return { articles, total: parseInt(countResult.total, 10) };
  }

  static async getStats(trx) {
    return ArticleModel._db(trx)('articles')
      .select(
        db.raw('count(*)::int as total_articles'),
        db.raw("count(*) filter (where type = 'blog')::int as total_blog"),
        db.raw("count(*) filter (where type = 'news')::int as total_news"),
        db.raw('coalesce(sum(view_count), 0)::bigint as total_views')
      )
      .first();
  }
}
