require('dotenv').config();
const { pool } = require('./index');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

async function migrate() {
  const client = await pool.connect();
  try {
    console.log('Running migrations...');
    const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
    await client.query(schema);
    console.log('Schema applied.');

    // Seed demo data
    const existingUser = await client.query("SELECT id FROM users WHERE email = 'admin@ops.com'");
    if (existingUser.rows.length === 0) {
      console.log('Seeding demo data...');
      const hash = await bcrypt.hash('password123', 10);

      // Users
      const adminRes = await client.query(
        `INSERT INTO users (name, email, password_hash, role, avatar_color) VALUES ($1,$2,$3,$4,$5) RETURNING id`,
        ['David Denis', 'admin@ops.com', hash, 'admin', '#6366f1']
      );
      const mgr1Res = await client.query(
        `INSERT INTO users (name, email, password_hash, role, avatar_color) VALUES ($1,$2,$3,$4,$5) RETURNING id`,
        ['Mercy Alfayo', 'mercy@ops.com', hash, 'manager', '#10b981']
      );
      const mbr1Res = await client.query(
        `INSERT INTO users (name, email, password_hash, role, avatar_color) VALUES ($1,$2,$3,$4,$5) RETURNING id`,
        ['Ojungu Jackson', 'jackson@ops.com', hash, 'member', '#f59e0b']
      );
      const mbr2Res = await client.query(
        `INSERT INTO users (name, email, password_hash, role, avatar_color) VALUES ($1,$2,$3,$4,$5) RETURNING id`,
        ['Kephason Tumaini', 'kephason@ops.com', hash, 'member', '#ef4444']
      );

      const adminId = adminRes.rows[0].id;
      const mgr1Id = mgr1Res.rows[0].id;
      const mbr1Id = mbr1Res.rows[0].id;
      const mbr2Id = mbr2Res.rows[0].id;

      // Operation 1: Production
      const op1Res = await client.query(
        `INSERT INTO operations (name, description, key, owner_id, color) VALUES ($1,$2,$3,$4,$5) RETURNING id`,
        ['Production & R&D', 'Hair hydrolysis and fertilizer production operations', 'PROD', adminId, '#10b981']
      );
      const op1Id = op1Res.rows[0].id;

      // Operation 2: Sales
      const op2Res = await client.query(
        `INSERT INTO operations (name, description, key, owner_id, color) VALUES ($1,$2,$3,$4,$5) RETURNING id`,
        ['Sales & Distribution', 'Market outreach and Alibaba sales operations', 'SALE', adminId, '#6366f1']
      );
      const op2Id = op2Res.rows[0].id;

      // Add members
      await client.query(
        `INSERT INTO operation_members (operation_id, user_id, role) VALUES ($1,$2,'manager'),($1,$3,'member'),($1,$4,'member')`,
        [op1Id, mgr1Id, mbr1Id, mbr2Id]
      );
      await client.query(
        `INSERT INTO operation_members (operation_id, user_id, role) VALUES ($1,$2,'manager'),($1,$3,'member')`,
        [op2Id, mbr1Id, mbr2Id]
      );

      // Workflow for op1
      const wf1Res = await client.query(
        `INSERT INTO workflows (operation_id, name) VALUES ($1,'Production Workflow') RETURNING id`,
        [op1Id]
      );
      const wf1Id = wf1Res.rows[0].id;

      const s1 = await client.query(`INSERT INTO statuses (workflow_id,name,color,position,category) VALUES ($1,'Backlog','#6b7280',0,'todo') RETURNING id`, [wf1Id]);
      const s2 = await client.query(`INSERT INTO statuses (workflow_id,name,color,position,category) VALUES ($1,'In Progress','#3b82f6',1,'in_progress') RETURNING id`, [wf1Id]);
      const s3 = await client.query(`INSERT INTO statuses (workflow_id,name,color,position,category) VALUES ($1,'QA Review','#f59e0b',2,'in_progress') RETURNING id`, [wf1Id]);
      const s4 = await client.query(`INSERT INTO statuses (workflow_id,name,color,position,category) VALUES ($1,'Done','#10b981',3,'done') RETURNING id`, [wf1Id]);

      const s1id = s1.rows[0].id, s2id = s2.rows[0].id, s3id = s3.rows[0].id, s4id = s4.rows[0].id;

      // Transitions
      await client.query(`INSERT INTO transitions (workflow_id,from_status_id,to_status_id,name) VALUES ($1,$2,$3,'Start Work')`, [wf1Id, s1id, s2id]);
      await client.query(`INSERT INTO transitions (workflow_id,from_status_id,to_status_id,name) VALUES ($1,$2,$3,'Send for Review')`, [wf1Id, s2id, s3id]);
      await client.query(`INSERT INTO transitions (workflow_id,from_status_id,to_status_id,name) VALUES ($1,$2,$3,'Approve')`, [wf1Id, s3id, s4id]);
      await client.query(`INSERT INTO transitions (workflow_id,from_status_id,to_status_id,name) VALUES ($1,$2,$3,'Reject')`, [wf1Id, s3id, s2id]);
      await client.query(`INSERT INTO transitions (workflow_id,from_status_id,to_status_id,name) VALUES ($1,$2,$3,'Backlog')`, [wf1Id, s2id, s1id]);

      // Sample tasks
      const taskData = [
        ['Prepare VunaBoost batch #12', 'Mix amino acids with humic acid at 5g/L ratio', 'high', mgr1Id, s2id, 1],
        ['Update McheKuza label artwork', 'Revise Swahili instructions per TARI feedback', 'medium', mbr1Id, s1id, 2],
        ['QA test SoilBoost batch', 'Run pH and NPK concentration checks', 'critical', mgr1Id, s3id, 3],
        ['Document Tokyo-8 hydrolysis results', 'Create R&D report for batch #11', 'low', mgr1Id, s4id, 4],
        ['Hair collection Arusha route', 'Weekly barbershop collection run', 'medium', mbr2Id, s2id, 5],
      ];
      for (const [title, desc, priority, assignee, status, num] of taskData) {
        await client.query(
          `INSERT INTO tasks (operation_id,workflow_id,status_id,title,description,priority,assignee_id,reporter_id,task_number,due_date)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,NOW() + INTERVAL '7 days')`,
          [op1Id, wf1Id, status, title, desc, priority, assignee, adminId, num]
        );
      }

      // Workflow for op2
      const wf2Res = await client.query(
        `INSERT INTO workflows (operation_id, name) VALUES ($1,'Sales Workflow') RETURNING id`,
        [op2Id]
      );
      const wf2Id = wf2Res.rows[0].id;

      const t1 = await client.query(`INSERT INTO statuses (workflow_id,name,color,position,category) VALUES ($1,'Lead','#6b7280',0,'todo') RETURNING id`, [wf2Id]);
      const t2 = await client.query(`INSERT INTO statuses (workflow_id,name,color,position,category) VALUES ($1,'Contacted','#3b82f6',1,'in_progress') RETURNING id`, [wf2Id]);
      const t3 = await client.query(`INSERT INTO statuses (workflow_id,name,color,position,category) VALUES ($1,'Negotiating','#f59e0b',2,'in_progress') RETURNING id`, [wf2Id]);
      const t4 = await client.query(`INSERT INTO statuses (workflow_id,name,color,position,category) VALUES ($1,'Closed','#10b981',3,'done') RETURNING id`, [wf2Id]);

      await client.query(`INSERT INTO transitions (workflow_id,from_status_id,to_status_id,name) VALUES ($1,$2,$3,'Contact Lead')`, [wf2Id, t1.rows[0].id, t2.rows[0].id]);
      await client.query(`INSERT INTO transitions (workflow_id,from_status_id,to_status_id,name) VALUES ($1,$2,$3,'Begin Negotiation')`, [wf2Id, t2.rows[0].id, t3.rows[0].id]);
      await client.query(`INSERT INTO transitions (workflow_id,from_status_id,to_status_id,name) VALUES ($1,$2,$3,'Close Deal')`, [wf2Id, t3.rows[0].id, t4.rows[0].id]);

      console.log('Seed data inserted.');
      console.log('\nDemo login: admin@ops.com / password123');
    } else {
      console.log('Seed data already exists, skipping.');
    }

    console.log('Migration complete!');
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  } finally {
    client.release();
    pool.end();
  }
}

migrate();
