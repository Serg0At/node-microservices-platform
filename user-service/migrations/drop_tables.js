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
      await pg.schema.dropTableIfExists('profiles');
      console.log('Successfully dropped profiles table');
    } finally {
      await pg.destroy();
    }

    process.exit(0);
  } catch (error) {
    console.error('Drop failed:', error.message);
    process.exit(1);
  }
}

init();
