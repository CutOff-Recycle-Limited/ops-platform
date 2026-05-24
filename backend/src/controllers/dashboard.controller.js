const { query } = require('../db');
const { asyncHandler } = require('../middleware/error');

const getDashboard = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const isAdmin = req.user.role === 'admin';

  // Get ALL accessible operation IDs
  // Admin sees everything; others see operations they own OR are a member of
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
      summary: {
        total: '0',
        overdue: '0',
        due_soon: '0',
        high_priority: '0',
        recently_completed: '0',
        my_open: '0',
        done: '0',
        in_progress: '0',
      },
    });
  }

  const placeholders = opIds.map((_, i) => `$${i + 1}`).join(',');
  const userParam = `$${opIds.length + 1}`;

  // Summary counts — most important, fix first
  const summary = await query(
    `SELECT
       COUNT(t.id) as total,
       COUNT(CASE WHEN t.due_date < CURRENT_DATE AND s.category != 'done' THEN 1 END) as overdue,
       COUNT(CASE WHEN t.due_date >= CURRENT_DATE AND t.due_date < CURRENT_DATE + INTERVAL '8 days' AND s.category != 'done' THEN 1 END) as due_soon,
       COUNT(CASE WHEN t.priority IN ('critical', 'high') AND s.category != 'done' THEN 1 END) as high_priority,
       COUNT(CASE WHEN s.category = 'done' AND t.updated_at >= CURRENT_DATE - INTERVAL '14 days' THEN 1 END) as recently_completed,
       COUNT(CASE WHEN t.assignee_id = ${userParam} AND s.category != 'done' THEN 1 END) as my_open,
       COUNT(CASE WHEN s.category = 'done' THEN 1 END) as done,
       COUNT(CASE WHEN s.category = 'in_progress' THEN 1 END) as in_progress
     FROM tasks t
     JOIN statuses s ON t.status_id = s.id
     WHERE t.operation_id IN (${placeholders})`,
    [...opIds, userId]
  );

  // Tasks by status — only show statuses that have tasks OR belong to accessible operations
  const byStatus = await query(
    `SELECT
       s.name as status_name,
       s.color,
       s.category,
       COUNT(t.id) as count
     FROM tasks t
     JOIN statuses s ON t.status_id = s.id
     WHERE t.operation_id IN (${placeholders})
     GROUP BY s.id, s.name, s.color, s.category
     HAVING COUNT(t.id) > 0
     ORDER BY count DESC`,
    opIds
  );

  // Overdue tasks
  const overdue = await query(
    `SELECT
       t.id, t.title, t.priority, t.due_date,
       t.task_number,
       u.name as assignee_name, u.avatar_color,
       o.name as operation_name, o.key as operation_key,
       s.name as status_name, s.color as status_color
     FROM tasks t
     LEFT JOIN users u ON t.assignee_id = u.id
     LEFT JOIN operations o ON t.operation_id = o.id
     LEFT JOIN statuses s ON t.status_id = s.id
     WHERE t.operation_id IN (${placeholders})
       AND t.due_date < CURRENT_DATE
       AND s.category != 'done'
     ORDER BY t.due_date ASC
     LIMIT 10`,
    opIds
  );

  // Tasks per user
  const byUser = await query(
    `SELECT
       u.id, u.name, u.avatar_color,
       COUNT(t.id) as total,
       COUNT(CASE WHEN s.category = 'done' THEN 1 END) as done,
       COUNT(CASE WHEN s.category != 'done' THEN 1 END) as open
     FROM users u
     JOIN tasks t ON t.assignee_id = u.id
     JOIN statuses s ON t.status_id = s.id
     WHERE t.operation_id IN (${placeholders})
     GROUP BY u.id, u.name, u.avatar_color
     ORDER BY total DESC
     LIMIT 8`,
    opIds
  );

  // Recent activity
  const activity = await query(
    `SELECT
       a.id, a.action, a.old_value, a.new_value, a.created_at,
       u.name as user_name, u.avatar_color,
       t.title as task_title,
       o.name as operation_name, o.key as operation_key
     FROM activity_logs a
     JOIN users u ON a.user_id = u.id
     JOIN tasks t ON a.task_id = t.id
     JOIN operations o ON a.operation_id = o.id
     WHERE a.operation_id IN (${placeholders})
     ORDER BY a.created_at DESC
     LIMIT 20`,
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
