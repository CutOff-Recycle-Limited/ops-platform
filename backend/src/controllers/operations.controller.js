const { query } = require('../db');
const { asyncHandler } = require('../middleware/error');

const VALID_OPERATION_ROLES = new Set(['manager', 'member']);

/**
 * GET /api/operations
 */
const list = asyncHandler(async (req, res) => {
  let ops;
  if (req.user.role === 'admin') {
    ops = await query(
      `SELECT o.*, u.name as owner_name,
        (SELECT COUNT(*) FROM tasks t WHERE t.operation_id = o.id) as task_count,
        (SELECT COUNT(*) FROM operation_members om WHERE om.operation_id = o.id) as member_count
       FROM operations o JOIN users u ON o.owner_id = u.id
       ORDER BY o.created_at DESC`
    );
  } else {
    ops = await query(
      `SELECT o.*, u.name as owner_name,
        (SELECT COUNT(*) FROM tasks t WHERE t.operation_id = o.id) as task_count,
        (SELECT COUNT(*) FROM operation_members om2 WHERE om2.operation_id = o.id) as member_count
       FROM operations o
       JOIN users u ON o.owner_id = u.id
       LEFT JOIN operation_members om ON om.operation_id = o.id AND om.user_id = $1
       WHERE o.owner_id = $1 OR om.user_id = $1
       ORDER BY o.created_at DESC`,
      [req.user.id]
    );
  }
  res.json({ operations: ops.rows });
});

/**
 * POST /api/operations
 */
const create = asyncHandler(async (req, res) => {
  const { name, description, key, color = '#6366f1' } = req.body;
  if (!name || !key) return res.status(400).json({ error: 'Name and key are required' });

  const upperKey = key.toUpperCase().replace(/[^A-Z0-9]/g, '').substring(0, 10);

  const op = await query(
    `INSERT INTO operations (name, description, key, owner_id, color) VALUES ($1,$2,$3,$4,$5) RETURNING *`,
    [name.trim(), description, upperKey, req.user.id, color]
  );
  const opId = op.rows[0].id;

  // Auto-create default workflow
  const wf = await query(
    `INSERT INTO workflows (operation_id, name) VALUES ($1,'Default Workflow') RETURNING id`,
    [opId]
  );
  const wfId = wf.rows[0].id;

  // Default statuses
  const defaultStatuses = [
    { name: 'To Do', color: '#6b7280', position: 0, category: 'todo' },
    { name: 'In Progress', color: '#3b82f6', position: 1, category: 'in_progress' },
    { name: 'Review', color: '#f59e0b', position: 2, category: 'in_progress' },
    { name: 'Done', color: '#10b981', position: 3, category: 'done' },
  ];

  const statusIds = [];
  for (const s of defaultStatuses) {
    const sr = await query(
      `INSERT INTO statuses (workflow_id, name, color, position, category) VALUES ($1,$2,$3,$4,$5) RETURNING id`,
      [wfId, s.name, s.color, s.position, s.category]
    );
    statusIds.push(sr.rows[0].id);
  }

  // Default transitions (linear flow + back-steps)
  await query(`INSERT INTO transitions (workflow_id,from_status_id,to_status_id,name) VALUES ($1,$2,$3,'Start')`, [wfId, statusIds[0], statusIds[1]]);
  await query(`INSERT INTO transitions (workflow_id,from_status_id,to_status_id,name) VALUES ($1,$2,$3,'Send for Review')`, [wfId, statusIds[1], statusIds[2]]);
  await query(`INSERT INTO transitions (workflow_id,from_status_id,to_status_id,name) VALUES ($1,$2,$3,'Approve')`, [wfId, statusIds[2], statusIds[3]]);
  await query(`INSERT INTO transitions (workflow_id,from_status_id,to_status_id,name) VALUES ($1,$2,$3,'Request Changes')`, [wfId, statusIds[2], statusIds[1]]);
  await query(`INSERT INTO transitions (workflow_id,from_status_id,to_status_id,name) VALUES ($1,$2,$3,'Back to To Do')`, [wfId, statusIds[1], statusIds[0]]);

  res.status(201).json({ operation: op.rows[0] });
});

/**
 * GET /api/operations/:id
 */
const getOne = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const op = await query(
    `SELECT o.*, u.name as owner_name FROM operations o JOIN users u ON o.owner_id = u.id WHERE o.id = $1`,
    [id]
  );
  if (!op.rows.length) return res.status(404).json({ error: 'Operation not found' });

  const members = await query(
    `SELECT u.id, u.name, u.email, u.role, u.avatar_color, om.role as op_role
     FROM operation_members om JOIN users u ON om.user_id = u.id
     WHERE om.operation_id = $1 ORDER BY u.name`,
    [id]
  );

  const workflow = await query(
    `SELECT w.*, json_agg(s.* ORDER BY s.position) as statuses
     FROM workflows w
     LEFT JOIN statuses s ON s.workflow_id = w.id
     WHERE w.operation_id = $1
     GROUP BY w.id LIMIT 1`,
    [id]
  );

  res.json({
    operation: op.rows[0],
    members: members.rows,
    workflow: workflow.rows[0] || null,
  });
});

/**
 * PUT /api/operations/:id
 */
const update = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { name, description, color, status } = req.body;

  const op = await query(
    `UPDATE operations SET name=COALESCE($1,name), description=COALESCE($2,description),
     color=COALESCE($3,color), status=COALESCE($4,status), updated_at=NOW()
     WHERE id=$5 RETURNING *`,
    [name, description, color, status, id]
  );
  if (!op.rows.length) return res.status(404).json({ error: 'Operation not found' });

  res.json({ operation: op.rows[0] });
});

/**
 * DELETE /api/operations/:id
 */
const remove = asyncHandler(async (req, res) => {
  const { id } = req.params;
  await query('DELETE FROM operations WHERE id=$1', [id]);
  res.json({ success: true });
});

/**
 * POST /api/operations/:id/members
 */
const addMember = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { user_id, role = 'member' } = req.body;

  if (!user_id) return res.status(400).json({ error: 'user_id is required' });
  if (!VALID_OPERATION_ROLES.has(role)) return res.status(400).json({ error: 'Invalid operation member role' });

  const user = await query('SELECT id FROM users WHERE id = $1', [user_id]);
  if (!user.rows.length) return res.status(404).json({ error: 'User not found' });

  await query(
    `INSERT INTO operation_members (operation_id, user_id, role) VALUES ($1,$2,$3)
     ON CONFLICT (operation_id, user_id) DO UPDATE SET role = $3`,
    [id, user_id, role]
  );
  res.json({ success: true });
});

/**
 * DELETE /api/operations/:id/members/:userId
 */
const removeMember = asyncHandler(async (req, res) => {
  const { id, userId } = req.params;
  await query('DELETE FROM operation_members WHERE operation_id=$1 AND user_id=$2', [id, userId]);
  res.json({ success: true });
});

module.exports = { list, create, getOne, update, remove, addMember, removeMember };
