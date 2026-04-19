require('dotenv').config();
const { pool } = require('./index');
const fs = require('fs');
const path = require('path');

async function migrate() {
  const client = await pool.connect();
  try {
    console.log('Running migrations...');
    const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
    await client.query(schema);
    console.log('Schema applied.');

    // Create invite_tokens table if not exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS invite_tokens (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        token VARCHAR(64) UNIQUE NOT NULL,
        created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        role VARCHAR(20) DEFAULT 'member' CHECK (role IN ('admin', 'manager', 'member')),
        used BOOLEAN DEFAULT false,
        used_by UUID REFERENCES users(id),
        expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '7 days',
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    console.log('invite_tokens table ready.');

    console.log('\nMigration complete!');
    console.log('No demo data seeded — create your admin account via the app.\n');
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  } finally {
    client.release();
    pool.end();
  }
}

migrate();
