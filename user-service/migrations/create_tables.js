import knex from 'knex';
import knexConfigs from '../src/config/knex.config.js';

function up(knex) {
  return knex.schema.createTable('profiles', (t) => {
    t.bigIncrements('id').primary();
    t.bigInteger('user_id').unsigned().notNullable().unique()
      .references('id').inTable('users').onDelete('CASCADE');
    t.specificType('username', 'citext').notNullable().unique();
    t.string('display_name', 100).nullable();
    t.text('avatar_url').nullable();
    t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });
}

async function init() {
  try {
    const options =
      process.env.NODE_ENV === 'production'
        ? knexConfigs.production
        : knexConfigs.development;

    const pg = knex(options);

    try {
      await pg.transaction(async (trx) => {
        await trx.raw('CREATE EXTENSION IF NOT EXISTS citext');
        await up(trx);
      });

      console.log('Successfully created profiles table');
    } finally {
      await pg.destroy();
    }

    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error.message);
    process.exit(1);
  }
}

init();
