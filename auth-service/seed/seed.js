import knex from 'knex';
import bcrypt from "bcryptjs"
import config  from '../src/config/variables.config.js';
import knexConfig from '../src/config/knex.config.js';

const { ADMIN } = config
const { ADMIN_PASSWORD } = ADMIN

async function seed(pg) {
  try {

    const existingUser = await pg('users').where({ username: 'serg0011' }).first();
    
    if (existingUser) {
      console.log('Admin user already exists, skipping...');
    } else {
      await pg('users').insert([
        {
          username: 'serg0011',
          email: 'serg114454@gmail.com',
          password_hash: await bcrypt.hash(ADMIN_PASSWORD, 10),
        },
      ]);
      console.log('Admin user created successfully');
    }

  } catch (error) {
    console.error('Error inserting data:', error.message);
    throw error
  } 
}

async function init() {
  try {
    const options = process.env.NODE_ENV === 'production'
      ? knexConfig.production
      : knexConfig.development;
    
    const pg = knex(options);
    
    await seed(pg);
    
    // Close the database connection
    await pg.destroy();
    
    console.log('Successfully inserted all data.');
  } catch (error) {
    console.error('Initialization error:', error.message);
    process.exit(1);
  }
}

init();
