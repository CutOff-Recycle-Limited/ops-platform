const { query } = require('../db');
const { asyncHandler } = require('../middleware/error');

/**
 * POST /api/tasks/:taskId/comments
 */
const create = asyncHandler(async (req, res) => {
  const { taskId } = req.params;
  const { content } = req.body;

  if (!content?.trim()) return res.status(400).json({ error: 'Comment content is required' });

  // Verify task exists
  const taskResult = await query('SELECT operation_id FROM tasks WHERE id=$1', [taskId]);
  if (!taskResult.rows.length) return res.status(404).json({ error: 'Task not found' });

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
      taskResult.rows[0].operation_id,
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

  const existing = await query('SELECT * FROM comments WHERE id=$1', [id]);
  if (!existing.rows.length) return res.status(404).json({ error: 'Comment not found' });
  if (existing.rows[0].user_id !== req.user.id && req.user.role !== 'admin') {
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
  const existing = await query('SELECT * FROM comments WHERE id=$1', [id]);
  if (!existing.rows.length) return res.status(404).json({ error: 'Comment not found' });
  if (existing.rows[0].user_id !== req.user.id && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Cannot delete others\' comments' });
  }

  await query('DELETE FROM comments WHERE id=$1', [id]);
  res.json({ success: true });
});

module.exports = { create, update, remove };
