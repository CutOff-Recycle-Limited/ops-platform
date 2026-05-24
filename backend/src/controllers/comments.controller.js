const { query } = require('../db');
const { asyncHandler } = require('../middleware/error');
const { getOperationPermission, isAdmin } = require('../middleware/auth');

const sameId = (left, right) => {
  if (!left || !right) return false;
  return String(left) === String(right);
};

const ensureTaskCommentAccess = async (taskId, user) => {
  const taskResult = await query('SELECT operation_id FROM tasks WHERE id=$1', [taskId]);
  if (!taskResult.rows.length) {
    const err = new Error('Task not found');
    err.status = 404;
    throw err;
  }

  const permission = await getOperationPermission(user, taskResult.rows[0].operation_id);
  if (!permission.hasAccess) {
    const err = new Error('Access denied to this task');
    err.status = 403;
    throw err;
  }

  return { task: taskResult.rows[0], permission };
};

const getCommentContext = async (commentId, user) => {
  const result = await query(
    `SELECT c.*, t.operation_id
     FROM comments c
     JOIN tasks t ON t.id = c.task_id
     WHERE c.id=$1`,
    [commentId]
  );
  if (!result.rows.length) {
    const err = new Error('Comment not found');
    err.status = 404;
    throw err;
  }

  const comment = result.rows[0];
  const permission = await getOperationPermission(user, comment.operation_id);
  if (!permission.hasAccess) {
    const err = new Error('Access denied to this comment');
    err.status = 403;
    throw err;
  }

  return { comment, permission };
};

const canModerateComment = (user, permission) => (
  isAdmin(user) ||
  (user.role === 'manager' && permission.hasAccess) ||
  permission.canManage
);

/**
 * POST /api/tasks/:taskId/comments
 */
const create = asyncHandler(async (req, res) => {
  const { taskId } = req.params;
  const { content } = req.body;

  if (!content?.trim()) return res.status(400).json({ error: 'Comment content is required' });

  const { task } = await ensureTaskCommentAccess(taskId, req.user);

  const comment = await query(
    `INSERT INTO comments (task_id, user_id, content) VALUES ($1,$2,$3) RETURNING *`,
    [taskId, req.user.id, content.trim()]
  );

  // Log activity
  await query(
    `INSERT INTO activity_logs (task_id, operation_id, user_id, actor_id, action, new_value, metadata)
     VALUES ($1,$2,$3,$3,'comment',$4,$5)`,
    [
      taskId,
      task.operation_id,
      req.user.id,
      JSON.stringify({ content: content.trim() }),
      JSON.stringify({ source: 'comments' }),
    ]
  );

  const full = await query(
    `SELECT c.*, u.name as user_name, u.avatar_color FROM comments c JOIN users u ON c.user_id = u.id WHERE c.id=$1`,
    [comment.rows[0].id]
  );

  res.status(201).json({ comment: full.rows[0] });
});

/**
 * PUT /api/comments/:id
 */
const update = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { content } = req.body;
  if (!content?.trim()) return res.status(400).json({ error: 'Comment content is required' });

  const { comment } = await getCommentContext(id, req.user);
  if (!sameId(comment.user_id, req.user.id) && !isAdmin(req.user)) {
    return res.status(403).json({ error: 'Cannot edit others\' comments' });
  }

  const result = await query(
    `UPDATE comments SET content=$1, edited=true, updated_at=NOW() WHERE id=$2 RETURNING *`,
    [content.trim(), id]
  );
  res.json({ comment: result.rows[0] });
});

/**
 * DELETE /api/comments/:id
 */
const remove = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { comment, permission } = await getCommentContext(id, req.user);
  if (!sameId(comment.user_id, req.user.id) && !canModerateComment(req.user, permission)) {
    return res.status(403).json({ error: 'Cannot delete others\' comments' });
  }

  await query('DELETE FROM comments WHERE id=$1', [id]);
  res.json({ success: true });
});

module.exports = { create, update, remove };
