import config from './variables.config.js';

const { PSQL } = config;
const { PORT, HOST, DATABASE, USER, PASSWORD, SSL } = PSQL;

const baseConfig = {
  client: 'pg',
  connection: {
    port: PORT,
    host: HOST,
    database: DATABASE,
    user: USER,
    password: PASSWORD,
    ssl: SSL,
  },
  pool: {
    min: 2,
    max: 10,
    acquireTimeoutMillis: 30000,
    createTimeoutMillis: 30000,
    destroyTimeoutMillis: 5000,
    idleTimeoutMillis: 30000,
    reapIntervalMillis: 1000,
    createRetryIntervalMillis: 200,
  },
  acquireConnectionTimeout: 60000,
  debug: false,
};

export default {
  development: baseConfig,
  production: baseConfig,
};
