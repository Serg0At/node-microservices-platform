import knex from 'knex';
import knexConfigs from '../src/config/knex.config.js';

function down(pg) {
  return (
    pg.schema
    .dropTableIfExists('user_oauth')
    .dropTableIfExists('user_2fa')
    .dropTableIfExists('users')
  );
}

async function init() {
  try {
    const options =
      process.env.NODE_ENV === 'production'
        ? knexConfigs.production
        : knexConfigs.development;
    const pg = knex(options);
    await down(pg);
    console.log('Successfully dropped all tables');
  } catch (error) {
    console.log(error.message);
  }
}

init();
