const { query } = require('../db');
const { asyncHandler } = require('../middleware/error');

/**
 * GET /api/dashboard
 * Returns aggregated stats for the current user's accessible operations
 */
const getDashboard = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const isAdmin = req.user.role === 'admin';

  // Get accessible operation IDs
  let opIds;
  if (isAdmin) {
    const ops = await query('SELECT id FROM operations', []);
    opIds = ops.rows.map(r => r.id);
  } else {
    const ops = await query(
      `SELECT DISTINCT o.id FROM operations o
       LEFT JOIN operation_members om ON om.operation_id = o.id
       WHERE o.owner_id = $1 OR om.user_id = $1`,
      [userId]
    );
    opIds = ops.rows.map(r => r.id);
  }

  if (!opIds.length) {
    return res.json({
      tasksByStatus: [],
      overdueTasks: [],
      tasksByUser: [],
      recentActivity: [],
      summary: { total: 0, overdue: 0, done: 0, inProgress: 0 },
    });
  }

  const placeholders = opIds.map((_, i) => `$${i + 1}`).join(',');

  // Tasks by status
  const byStatus = await query(
    `SELECT s.name as status_name, s.color, s.category, COUNT(t.id) as count
     FROM statuses s
     LEFT JOIN tasks t ON t.status_id = s.id AND t.operation_id IN (${placeholders})
     WHERE s.workflow_id IN (SELECT id FROM workflows WHERE operation_id IN (${placeholders}))
     GROUP BY s.id, s.name, s.color, s.category
     ORDER BY s.category, count DESC`,
    [...opIds, ...opIds]
  );

  // Overdue tasks
  const overdue = await query(
    `SELECT t.id, t.title, t.priority, t.due_date,
       u.name as assignee_name, u.avatar_color,
       o.name as operation_name, o.key as operation_key,
       s.name as status_name
     FROM tasks t
     LEFT JOIN users u ON t.assignee_id = u.id
     LEFT JOIN operations o ON t.operation_id = o.id
     LEFT JOIN statuses s ON t.status_id = s.id
     WHERE t.operation_id IN (${placeholders})
       AND t.due_date < CURRENT_DATE
       AND s.category != 'done'
     ORDER BY t.due_date ASC LIMIT 10`,
    opIds
  );

  // Tasks per user
  const byUser = await query(
    `SELECT u.id, u.name, u.avatar_color,
       COUNT(t.id) as total,
       COUNT(CASE WHEN s.category = 'done' THEN 1 END) as done,
       COUNT(CASE WHEN s.category != 'done' THEN 1 END) as open
     FROM users u
     JOIN tasks t ON t.assignee_id = u.id
     JOIN statuses s ON t.status_id = s.id
     WHERE t.operation_id IN (${placeholders})
     GROUP BY u.id, u.name, u.avatar_color
     ORDER BY total DESC LIMIT 8`,
    opIds
  );

  // Recent activity
  const activity = await query(
    `SELECT a.*, u.name as user_name, u.avatar_color, t.title as task_title,
       o.name as operation_name, o.key as operation_key
     FROM activity_logs a
     JOIN users u ON a.user_id = u.id
     JOIN tasks t ON a.task_id = t.id
     JOIN operations o ON a.operation_id = o.id
     WHERE a.operation_id IN (${placeholders})
     ORDER BY a.created_at DESC LIMIT 20`,
    opIds
  );

  // Summary counts
  const summary = await query(
    `SELECT
       COUNT(t.id) as total,
       COUNT(CASE WHEN t.due_date < CURRENT_DATE AND s.category != 'done' THEN 1 END) as overdue,
       COUNT(CASE WHEN s.category = 'done' THEN 1 END) as done,
       COUNT(CASE WHEN s.category = 'in_progress' THEN 1 END) as in_progress
     FROM tasks t
     JOIN statuses s ON t.status_id = s.id
     WHERE t.operation_id IN (${placeholders})`,
    opIds
  );

  res.json({
    tasksByStatus: byStatus.rows,
    overdueTasks: overdue.rows,
    tasksByUser: byUser.rows,
    recentActivity: activity.rows,
    summary: summary.rows[0],
  });
});

module.exports = { getDashboard };
