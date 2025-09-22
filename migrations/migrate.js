const fs = require('fs');
const path = require('path');
const db = require('../config/database');

async function runMigrations() {
  try {
    console.log('Starting database migrations...');
    
    // Create migrations table if it doesn't exist
    await db.query(`
      CREATE TABLE IF NOT EXISTS migrations (
        id SERIAL PRIMARY KEY,
        filename VARCHAR(255) NOT NULL UNIQUE,
        executed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Get list of migration files
    const migrationsDir = __dirname;
    const files = fs.readdirSync(migrationsDir)
      .filter(file => file.endsWith('.sql'))
      .sort();

    // Check which migrations have already been run
    const { rows: executedMigrations } = await db.query(
      'SELECT filename FROM migrations ORDER BY filename'
    );
    const executedFiles = executedMigrations.map(row => row.filename);

    // Run pending migrations
    for (const file of files) {
      if (!executedFiles.includes(file)) {
        console.log(`Running migration: ${file}`);
        
        const migrationPath = path.join(migrationsDir, file);
        const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
        
        // Execute migration in a transaction
        const client = await db.getClient();
        try {
          await client.query('BEGIN');
          await client.query(migrationSQL);
          await client.query('INSERT INTO migrations (filename) VALUES ($1)', [file]);
          await client.query('COMMIT');
          console.log(`✓ Migration ${file} completed successfully`);
        } catch (error) {
          await client.query('ROLLBACK');
          throw error;
        } finally {
          client.release();
        }
      } else {
        console.log(`⏭ Migration ${file} already executed`);
      }
    }

    console.log('All migrations completed successfully!');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

// Run migrations if this file is executed directly
if (require.main === module) {
  runMigrations().then(() => {
    process.exit(0);
  });
}

module.exports = { runMigrations };