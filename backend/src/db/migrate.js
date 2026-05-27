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

    const sharedSchema = fs.readFileSync(path.join(__dirname, 'shared_database_schema.sql'), 'utf8');
    await client.query(sharedSchema);
    console.log('Shared CRM and competitor schema applied.');

    await client.query(`
      ALTER TABLE users
        ADD COLUMN IF NOT EXISTS disabled_at TIMESTAMPTZ
    `);
    console.log('User deactivation field ready.');

    // Additive task execution-layer fields for existing databases.
    await client.query(`
      ALTER TABLE tasks
        ADD COLUMN IF NOT EXISTS created_by_id UUID REFERENCES users(id) ON DELETE SET NULL,
        ADD COLUMN IF NOT EXISTS linked_entity_type VARCHAR(50),
        ADD COLUMN IF NOT EXISTS linked_entity_id VARCHAR(120)
    `);
    await client.query(`
      UPDATE tasks SET created_by_id = reporter_id WHERE created_by_id IS NULL
    `);
    await client.query('CREATE INDEX IF NOT EXISTS idx_tasks_created_by ON tasks(created_by_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_tasks_linked_entity ON tasks(linked_entity_type, linked_entity_id)');
    await client.query(`
      ALTER TABLE activity_logs
        ADD COLUMN IF NOT EXISTS actor_id UUID REFERENCES users(id) ON DELETE SET NULL,
        ADD COLUMN IF NOT EXISTS metadata JSONB
    `);
    await client.query(`
      UPDATE activity_logs SET actor_id = user_id WHERE actor_id IS NULL
    `);
    await client.query('CREATE INDEX IF NOT EXISTS idx_activity_actor ON activity_logs(actor_id)');
    console.log('Task execution fields ready.');

    await client.query(`
      CREATE TABLE IF NOT EXISTS task_time_entries (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        minutes INTEGER NOT NULL CHECK (minutes > 0),
        note TEXT,
        logged_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    await client.query('CREATE INDEX IF NOT EXISTS idx_task_time_entries_task ON task_time_entries(task_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_task_time_entries_user ON task_time_entries(user_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_task_time_entries_logged_at ON task_time_entries(logged_at DESC)');
    console.log('task_time_entries table ready.');

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

    await client.query(`
      CREATE TABLE IF NOT EXISTS password_reset_tokens (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        token VARCHAR(64) UNIQUE NOT NULL,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        used BOOLEAN DEFAULT false,
        expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '1 hour',
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    await client.query('CREATE INDEX IF NOT EXISTS idx_prt_token ON password_reset_tokens(token)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_prt_user ON password_reset_tokens(user_id)');
    console.log('password_reset_tokens table ready.');

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
