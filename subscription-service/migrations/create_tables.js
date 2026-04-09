import knex from 'knex';
import knexConfigs from '../src/config/knex.config.js';

function up(knex) {
  return (
    knex.schema
    .createTable("subscriptions", (t) => {
      t.bigIncrements("id").primary();
      t.bigInteger("user_id").notNullable();
      t.smallint("sub_type").notNullable().defaultTo(0);
      t.boolean("free_trial").notNullable().defaultTo(false);
      t.text("status").notNullable().defaultTo("active");
      t.timestamp("started_at", { useTz: true }).notNullable();
      t.timestamp("ended_at", { useTz: true }).notNullable();
      t.timestamp("grace_period_end", { useTz: true }).nullable();
      t.text("issued_by").notNullable().defaultTo("System");
      t.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
      t.timestamp("updated_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());

      // Indexes
      t.index(["user_id"], "idx_subscriptions_user_id");
      t.index(["status"], "idx_subscriptions_status");
      t.index(["ended_at"], "idx_subscriptions_ended_at");
    })
    .raw(`
      ALTER TABLE subscriptions
        ADD CONSTRAINT chk_subscriptions_sub_type CHECK (sub_type IN (0, 1, 2, 3)),
        ADD CONSTRAINT chk_subscriptions_status CHECK (status IN ('active', 'expired', 'canceled', 'terminated')),
        ADD CONSTRAINT chk_subscriptions_issued_by CHECK (issued_by IN ('System', 'Payment', 'Admin', 'Promo', 'User'))
    `)

    .createTable("promo_codes", (t) => {
      t.bigIncrements("id").primary();
      t.text("code").notNullable().unique();
      t.text("discount_type").notNullable();
      t.integer("discount_value").notNullable();
      t.integer("max_uses").notNullable().defaultTo(0);
      t.integer("used_count").notNullable().defaultTo(0);
      t.specificType("applicable_tiers", "smallint[]").nullable();
      t.integer("min_duration_months").notNullable().defaultTo(0);
      t.timestamp("valid_from", { useTz: true }).notNullable().defaultTo(knex.fn.now());
      t.timestamp("valid_until", { useTz: true }).nullable();
      t.boolean("active").notNullable().defaultTo(true);
      t.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
      t.timestamp("updated_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());

      // Indexes
      t.index(["code"], "idx_promo_codes_code");
      t.index(["active"], "idx_promo_codes_active");
    })
    .raw(`
      ALTER TABLE promo_codes
        ADD CONSTRAINT chk_promo_codes_discount_type CHECK (discount_type IN ('percentage', 'fixed')),
        ADD CONSTRAINT chk_promo_codes_discount_value CHECK (discount_value > 0),
        ADD CONSTRAINT chk_promo_codes_max_uses CHECK (max_uses >= 0),
        ADD CONSTRAINT chk_promo_codes_used_count CHECK (used_count >= 0)
    `)
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

      console.log('Successfully created subscriptions table');
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
