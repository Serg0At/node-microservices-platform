import knex from 'knex';
import knexConfigs from '../src/config/knex.config.js';

async function init() {
  try {
    const options =
      process.env.NODE_ENV === 'production'
        ? knexConfigs.production
        : knexConfigs.development;

    const pg = knex(options);

    try {
      await pg.transaction(async trx => {
        await trx.schema.dropTableIfExists("notification_archive");
        await trx.schema.dropTableIfExists("notifications");
      });

      console.log('Successfully dropped notifications + notification_archive tables');
    } finally {
      await pg.destroy();
    }

    process.exit(0);
  } catch (error) {
    console.error('Drop tables failed:', error.message);
    process.exit(1);
  }
}

init();
