import knex from 'knex';
import knexConfigs from '../src/config/knex.config.js';

function up(knex) {
  return knex.schema.createTable("transactions", (t) => {
    t.bigIncrements("id").primary();
    t.bigInteger("user_id").notNullable().index("idx_transactions_user_id");
    t.text("provider").notNullable();
    t.text("provider_order_id").notNullable().unique("idx_transactions_provider_order_id");
    t.text("provider_payment_id").nullable();
    t.integer("amount").notNullable();
    t.varchar("currency", 10).notNullable().defaultTo("USD");
    t.varchar("crypto_currency", 10).nullable();
    t.text("crypto_amount").nullable();
    t.text("status").notNullable().defaultTo("pending");
    t.smallint("plan_type").notNullable();
    t.smallint("duration_months").notNullable().defaultTo(1);
    t.jsonb("metadata").nullable();
    t.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.timestamp("updated_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());

    // Additional index
    t.index(["status"], "idx_transactions_status");
  })
  .then(() => {
    return knex.raw(`
      ALTER TABLE transactions
        ADD CONSTRAINT chk_transactions_provider CHECK (provider IN ('cryptomus', 'fondy')),
        ADD CONSTRAINT chk_transactions_status CHECK (status IN ('pending', 'succeeded', 'failed', 'refunded', 'expired')),
        ADD CONSTRAINT chk_transactions_plan_type CHECK (plan_type IN (1, 2, 3));
    `);
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
      await pg.transaction(async trx => {
        await up(trx);
      });

      console.log('Successfully created transactions table');
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
