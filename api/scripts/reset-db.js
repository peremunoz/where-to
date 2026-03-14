const { Client } = require('pg');

async function resetDatabase() {
  const client = new Client({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    user: process.env.DB_USERNAME || 'whereto',
    password: process.env.DB_PASSWORD || 'whereto',
    database: process.env.DB_NAME || 'where_to',
  });

  await client.connect();

  try {
    await client.query('BEGIN');
    await client.query('DROP SCHEMA IF EXISTS public CASCADE;');
    await client.query('CREATE SCHEMA public;');
    await client.query('GRANT ALL ON SCHEMA public TO public;');
    await client.query('COMMIT');
    console.log(
      'Database schema reset completed. Restart the API to recreate tables.',
    );
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Database reset failed:', error.message);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

void resetDatabase();
