const { query, getClient } = require('../db');
const { asyncHandler } = require('../middleware/error');

/**
 * GET /api/operations/:operationId/tasks
 * Returns all tasks grouped by status (for Kanban)
 */
const list = asyncHandler(async (req, res) => {
  const { operationId } = req.params;
  const { assignee_id, priority, type } = req.query;

  let whereClause = 'WHERE t.operation_id = $1';
  const params = [operationId];
  let i = 2;

  if (assignee_id) { whereClause += ` AND t.assignee_id = $${i++}`; params.push(assignee_id); }
  if (priority) { whereClause += ` AND t.priority = $${i++}`; params.push(priority); }
  if (type) { whereClause += ` AND t.type = $${i++}`; params.push(type); }

  const tasks = await query(
    `SELECT t.*,
      u.name as assignee_name, u.avatar_color as assignee_color,
      r.name as reporter_name,
      s.name as status_name, s.color as status_color, s.position as status_position,
      (SELECT COUNT(*) FROM comments c WHERE c.task_id = t.id) as comment_count,
      (SELECT COUNT(*) FROM tasks sub WHERE sub.parent_id = t.id) as subtask_count
     FROM tasks t
     LEFT JOIN users u ON t.assignee_id = u.id
     LEFT JOIN users r ON t.reporter_id = r.id
     LEFT JOIN statuses s ON t.status_id = s.id
     ${whereClause}
     ORDER BY s.position, t.position, t.created_at`,
    params
  );

  res.json({ tasks: tasks.rows });
});

/**
 * GET /api/tasks/:id
 */
const getOne = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const task = await query(
    `SELECT t.*,
      u.name as assignee_name, u.avatar_color as assignee_color,
      r.name as reporter_name, r.avatar_color as reporter_color,
      s.name as status_name, s.color as status_color,
      o.name as operation_name, o.key as operation_key
     FROM tasks t
     LEFT JOIN users u ON t.assignee_id = u.id
     LEFT JOIN users r ON t.reporter_id = r.id
     LEFT JOIN statuses s ON t.status_id = s.id
     LEFT JOIN operations o ON t.operation_id = o.id
     WHERE t.id = $1`,
    [id]
  );
  if (!task.rows.length) return res.status(404).json({ error: 'Task not found' });

  // Get subtasks
  const subtasks = await query(
    `SELECT t.*, u.name as assignee_name, s.name as status_name, s.color as status_color
     FROM tasks t
     LEFT JOIN users u ON t.assignee_id = u.id
     LEFT JOIN statuses s ON t.status_id = s.id
     WHERE t.parent_id = $1 ORDER BY t.created_at`,
    [id]
  );

  // Get comments
  const comments = await query(
    `SELECT c.*, u.name as user_name, u.avatar_color
     FROM comments c JOIN users u ON c.user_id = u.id
     WHERE c.task_id = $1 ORDER BY c.created_at`,
    [id]
  );

  // Get activity
  const activity = await query(
    `SELECT a.*, u.name as user_name, u.avatar_color
     FROM activity_logs a JOIN users u ON a.user_id = u.id
     WHERE a.task_id = $1 ORDER BY a.created_at DESC LIMIT 50`,
    [id]
  );

  res.json({
    task: task.rows[0],
    subtasks: subtasks.rows,
    comments: comments.rows,
    activity: activity.rows,
  });
});

/**
 * POST /api/operations/:operationId/tasks
 */
const create = asyncHandler(async (req, res) => {
  const { operationId } = req.params;
  const { title, description, priority = 'medium', assignee_id, due_date, type = 'task', parent_id } = req.body;

  if (!title) return res.status(400).json({ error: 'Title is required' });

  // Get the workflow and first status for this operation
  const wfResult = await query(
    `SELECT w.id as workflow_id, s.id as status_id
     FROM workflows w JOIN statuses s ON s.workflow_id = w.id
     WHERE w.operation_id = $1 ORDER BY s.position LIMIT 1`,
    [operationId]
  );
  if (!wfResult.rows.length) return res.status(400).json({ error: 'No workflow found for this operation' });

  const { workflow_id, status_id } = wfResult.rows[0];

  // Get next task number
  const numResult = await query(
    'SELECT COALESCE(MAX(task_number), 0) + 1 as next_num FROM tasks WHERE operation_id = $1',
    [operationId]
  );
  const taskNumber = numResult.rows[0].next_num;

  const task = await query(
    `INSERT INTO tasks (operation_id, workflow_id, status_id, title, description, priority, assignee_id, reporter_id, due_date, type, parent_id, task_number)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
    [operationId, workflow_id, status_id, title, description, priority, assignee_id || null, req.user.id, due_date || null, type, parent_id || null, taskNumber]
  );

  // Log activity
  await query(
    `INSERT INTO activity_logs (task_id, operation_id, user_id, action, new_value) VALUES ($1,$2,$3,'create',$4)`,
    [task.rows[0].id, operationId, req.user.id, JSON.stringify({ title })]
  );

  res.status(201).json({ task: task.rows[0] });
});

/**
 * PUT /api/tasks/:id
 */
const update = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { title, description, priority, assignee_id, due_date, type } = req.body;

  const current = await query('SELECT * FROM tasks WHERE id=$1', [id]);
  if (!current.rows.length) return res.status(404).json({ error: 'Task not found' });

  const old = current.rows[0];

  const task = await query(
    `UPDATE tasks SET
      title=COALESCE($1,title),
      description=COALESCE($2,description),
      priority=COALESCE($3,priority),
      assignee_id=CASE WHEN $4::text IS NULL AND $5 = false THEN assignee_id ELSE $4::uuid END,
      due_date=COALESCE($6::date, due_date),
      type=COALESCE($7,type),
      updated_at=NOW()
     WHERE id=$8 RETURNING *`,
    [title, description, priority, assignee_id, assignee_id === undefined, due_date, type, id]
  );

  // Log changes
  const changes = {};
  if (title && title !== old.title) changes.title = { from: old.title, to: title };
  if (priority && priority !== old.priority) changes.priority = { from: old.priority, to: priority };
  if (assignee_id !== undefined && assignee_id !== old.assignee_id) changes.assignee = { from: old.assignee_id, to: assignee_id };

  if (Object.keys(changes).length) {
    await query(
      `INSERT INTO activity_logs (task_id, operation_id, user_id, action, old_value, new_value) VALUES ($1,$2,$3,'edit',$4,$5)`,
      [id, old.operation_id, req.user.id, JSON.stringify(old), JSON.stringify(changes)]
    );
  }

  res.json({ task: task.rows[0] });
});

/**
 * PATCH /api/tasks/:id/transition
 * Move task to a new status via workflow transition
 */
const transition = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status_id } = req.body;

  if (!status_id) return res.status(400).json({ error: 'status_id is required' });

  const taskResult = await query('SELECT * FROM tasks WHERE id=$1', [id]);
  if (!taskResult.rows.length) return res.status(404).json({ error: 'Task not found' });

  const task = taskResult.rows[0];

  // Check if transition is allowed
  const transitionCheck = await query(
    `SELECT id FROM transitions
     WHERE workflow_id = $1
     AND to_status_id = $2
     AND (from_status_id = $3 OR from_status_id IS NULL)`,
    [task.workflow_id, status_id, task.status_id]
  );

  if (!transitionCheck.rows.length) {
    return res.status(400).json({ error: 'Transition not allowed by workflow rules' });
  }

  const oldStatusResult = await query('SELECT name FROM statuses WHERE id=$1', [task.status_id]);
  const newStatusResult = await query('SELECT name FROM statuses WHERE id=$1', [status_id]);

  await query('UPDATE tasks SET status_id=$1, updated_at=NOW() WHERE id=$2', [status_id, id]);

  // Log activity
  await query(
    `INSERT INTO activity_logs (task_id, operation_id, user_id, action, old_value, new_value) VALUES ($1,$2,$3,'status_change',$4,$5)`,
    [
      id,
      task.operation_id,
      req.user.id,
      JSON.stringify({ status: oldStatusResult.rows[0]?.name }),
      JSON.stringify({ status: newStatusResult.rows[0]?.name }),
    ]
  );

  res.json({ success: true, status_id });
});

/**
 * DELETE /api/tasks/:id
 */
const remove = asyncHandler(async (req, res) => {
  const { id } = req.params;
  await query('DELETE FROM tasks WHERE id=$1', [id]);
  res.json({ success: true });
});

/**
 * GET /api/operations/:operationId/workflow
 * Get workflow with statuses and allowed transitions
 */
const getWorkflow = asyncHandler(async (req, res) => {
  const { operationId } = req.params;

  const wf = await query(
    `SELECT w.* FROM workflows w WHERE w.operation_id = $1 LIMIT 1`,
    [operationId]
  );
  if (!wf.rows.length) return res.status(404).json({ error: 'No workflow found' });

  const statuses = await query(
    `SELECT * FROM statuses WHERE workflow_id=$1 ORDER BY position`,
    [wf.rows[0].id]
  );
  const transitions = await query(
    `SELECT t.*, fs.name as from_name, ts.name as to_name
     FROM transitions t
     LEFT JOIN statuses fs ON t.from_status_id = fs.id
     LEFT JOIN statuses ts ON t.to_status_id = ts.id
     WHERE t.workflow_id=$1`,
    [wf.rows[0].id]
  );

  res.json({
    workflow: wf.rows[0],
    statuses: statuses.rows,
    transitions: transitions.rows,
  });
});

module.exports = { list, getOne, create, update, transition, remove, getWorkflow };
