import knex from 'knex';
import knexConfigs from './knex.config.js';

const db = knex(process.env.NODE_ENV === 'production' ? knexConfigs.production : knexConfigs.development);

export default db;
