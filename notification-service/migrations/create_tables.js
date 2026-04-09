import knex from 'knex';
import knexConfigs from '../src/config/knex.config.js';

function up(knex) {
  return (
    knex.schema
    .createTable("notifications", (t) => {
      t.bigIncrements("id").primary();
      t.bigInteger("user_id").nullable().index();
      t.boolean("is_broadcast").notNullable().defaultTo(false).index();
      t.string("type", 50).notNullable();
      t.string("channel", 20).notNullable().defaultTo("email");
      t.string("title", 255).notNullable();
      t.text("body").nullable();
      t.string("recipient_email", 255).nullable();
      t.string("template", 100).nullable();
      t.jsonb("payload").nullable();
      t.jsonb("provider_response").nullable();
      t.string("status", 20).notNullable().defaultTo("pending");
      t.boolean("read").notNullable().defaultTo(false);
      t.smallint("retry_count").notNullable().defaultTo(0);
      t.text("error_message").nullable();
      t.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
      t.timestamp("sent_at", { useTz: true }).nullable();
      t.timestamp("read_at", { useTz: true }).nullable();

      // Indexes
      t.index(["user_id", "created_at"], "idx_notifications_user_created");
      t.index(["status"], "idx_notifications_status");
    })

    .createTable("notification_archive", (t) => {
      t.bigIncrements("id").primary();
      t.bigInteger("user_id").nullable().index();
      t.boolean("is_broadcast").notNullable().defaultTo(false);
      t.string("type", 50).notNullable();
      t.string("channel", 20).notNullable().defaultTo("email");
      t.string("title", 255).notNullable();
      t.text("body").nullable();
      t.string("recipient_email", 255).nullable();
      t.string("template", 100).nullable();
      t.jsonb("payload").nullable();
      t.jsonb("provider_response").nullable();
      t.string("status", 20).notNullable().defaultTo("pending");
      t.boolean("read").notNullable().defaultTo(false);
      t.smallint("retry_count").notNullable().defaultTo(0);
      t.text("error_message").nullable();
      t.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
      t.timestamp("sent_at", { useTz: true }).nullable();
      t.timestamp("read_at", { useTz: true }).nullable();

      // Indexes
      t.index(["user_id", "created_at"], "idx_notification_archive_user_created");
    })
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

      console.log('Successfully created notifications + notification_archive tables');
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
