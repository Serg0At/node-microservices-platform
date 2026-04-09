import knex from 'knex';
import knexConfigs from '../src/config/knex.config.js';

function up(knex) {
  return (
    knex.schema
    .createTable("articles", (t) => {
        t.bigIncrements("id").primary();
        t.text("title").notNullable();
        t.text("slug").notNullable().unique();
        t.text("content").nullable();
        t.bigInteger("author_id").notNullable();
        t.text("type").notNullable().defaultTo('news');
        t.specificType("categories", "text[]").notNullable().defaultTo('{}');
        t.text("cover_image_url").nullable();
        t.bigInteger("view_count").notNullable().defaultTo(0);
        t.timestamp("published_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
        t.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
        t.timestamp("updated_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());

        t.check("type IN ('blog', 'news')");
        t.index("author_id", "idx_articles_author_id");
        t.index("type", "idx_articles_type");
      })

    .then(() =>
      knex.raw(`
        CREATE INDEX idx_articles_published_at ON articles (published_at DESC NULLS LAST);
        CREATE INDEX idx_articles_fts ON articles
          USING GIN (to_tsvector('english', coalesce(title,'') || ' ' || coalesce(content,'')));
      `)
    )
  );
}

async function init() {
  try {
    const options =
      process.env.NODE_ENV === 'production'
        ? knexConfigs.production
        : knexConfigs.development;

    const pg = knex(options);

    try {
      await pg.transaction(async trx => {
        await up(trx);
      });

      console.log('✅ Successfully created all tables in transaction');
    } finally {
      await pg.destroy();
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  }
}

init();
