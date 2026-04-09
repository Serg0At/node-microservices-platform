import knex from 'knex';
import knexConfigs from '../src/config/knex.config.js';

function up(knex) {
  return (
    knex.schema
    .createTable("users", (t) => {
        t.bigIncrements("id").primary();
        t.specificType('username', 'citext').notNullable().unique();
        t.specificType('email', 'citext').notNullable().unique();
        t.binary("password_hash").nullable();
        t.smallint("role").notNullable().defaultTo(0);
        t.check('role IN (0, 1)');
        t.boolean("is_active").notNullable().defaultTo(false);
        t.string("device_fingerprint", 255).nullable();
        t.timestamp("last_login", { useTz: true });
        t.timestamp("banned_at", { useTz: true }).nullable().index();
        t.text("ban_reason").nullable();
        t.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
        t.timestamp("updated_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
      })

    .createTable("user_oauth", (t) => {
        t.bigIncrements("id").primary();
        t.bigInteger("user_id").unsigned().notNullable().references("id").inTable("users").onDelete("CASCADE");
        t.string("provider", 32).notNullable();
        t.check("provider IN ('google', 'apple')");
        t.string("external_id", 255).notNullable();
        t.text("access_token").nullable();
        t.text("refresh_token").nullable();
        t.unique(["provider", "external_id"]);
        t.timestamp("expires_at").nullable();
        t.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
        t.timestamp("updated_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
      })

    .createTable("user_2fa", (t) => {
        t.bigIncrements("id").primary();
        t.bigInteger("user_id").unsigned().notNullable().unique().references("id").inTable("users").onDelete("CASCADE");
        t.text("secret").notNullable();
        t.jsonb("backup_codes").nullable();
        t.boolean("enabled").notNullable().defaultTo(false);
        t.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
        t.timestamp("updated_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
      })
  )
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
        await trx.raw('CREATE EXTENSION IF NOT EXISTS citext');
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
  }}

init();
