const { query } = require('../db');
const { asyncHandler } = require('../middleware/error');
const crypto = require('crypto');

const VALID_USER_ROLES = new Set(['admin', 'manager', 'member']);

const USER_SELECT = 'id, name, email, role, avatar_color, disabled_at, created_at';

/**
 * GET /api/users - list all users (admin only)
 */
const list = asyncHandler(async (req, res) => {
  const result = await query(
    `SELECT ${USER_SELECT} FROM users ORDER BY name`,
    []
  );
  res.json({ users: result.rows });
});

/**
 * PUT /api/users/:id/role - update user role (admin only)
 */
const updateRole = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { role } = req.body;
  if (!VALID_USER_ROLES.has(role)) {
    return res.status(400).json({ error: 'Invalid role' });
  }
  const result = await query(
    `UPDATE users SET role=$1, updated_at=NOW() WHERE id=$2 RETURNING ${USER_SELECT}`,
    [role, id]
  );
  if (!result.rows.length) return res.status(404).json({ error: 'User not found' });
  res.json({ user: result.rows[0] });
});

/**
 * DELETE /api/users/:id - legacy soft-disable action (admin only)
 */
const remove = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (id === req.user.id) return res.status(400).json({ error: 'Cannot disable yourself' });

  const result = await query(
    `UPDATE users SET disabled_at=COALESCE(disabled_at, NOW()), updated_at=NOW()
     WHERE id=$1
     RETURNING ${USER_SELECT}`,
    [id]
  );
  if (!result.rows.length) return res.status(404).json({ error: 'User not found' });
  res.json({ success: true, user: result.rows[0] });
});

/**
 * PATCH /api/users/:id/disable - disable a user (admin only)
 */
const disable = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (id === req.user.id) return res.status(400).json({ error: 'Cannot disable yourself' });

  const result = await query(
    `UPDATE users SET disabled_at=COALESCE(disabled_at, NOW()), updated_at=NOW()
     WHERE id=$1
     RETURNING ${USER_SELECT}`,
    [id]
  );
  if (!result.rows.length) return res.status(404).json({ error: 'User not found' });
  res.json({ user: result.rows[0] });
});

/**
 * PATCH /api/users/:id/enable - re-enable a user (admin only)
 */
const enable = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const result = await query(
    `UPDATE users SET disabled_at=NULL, updated_at=NOW()
     WHERE id=$1
     RETURNING ${USER_SELECT}`,
    [id]
  );
  if (!result.rows.length) return res.status(404).json({ error: 'User not found' });
  res.json({ user: result.rows[0] });
});

/**
 * POST /api/invites - generate an invite link
 */
const createInvite = asyncHandler(async (req, res) => {
  const { role = 'member' } = req.body;
  if (!VALID_USER_ROLES.has(role)) {
    return res.status(400).json({ error: 'Invalid role' });
  }

  const frontendUrl = process.env.FRONTEND_URL && process.env.FRONTEND_URL.trim();
  if (!frontendUrl) {
    return res.status(500).json({ error: 'FRONTEND_URL is required to generate invite links' });
  }
  const normalizedFrontendUrl = frontendUrl.replace(/\/+$/, '');

  // Ensure table exists
  await query(`
    CREATE TABLE IF NOT EXISTS invite_tokens (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      token VARCHAR(64) UNIQUE NOT NULL,
      created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      role VARCHAR(20) DEFAULT 'member',
      used BOOLEAN DEFAULT false,
      used_by UUID REFERENCES users(id),
      expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '7 days',
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  const token = crypto.randomBytes(32).toString('hex');
  await query(
    `INSERT INTO invite_tokens (token, created_by, role) VALUES ($1, $2, $3)`,
    [token, req.user.id, role]
  );

  const inviteUrl = `${normalizedFrontendUrl}/join?token=${encodeURIComponent(token)}`;

  res.json({ token, inviteUrl, role, expiresIn: '7 days' });
});

/**
 * GET /api/invites - list all invite links (admin only)
 */
const listInvites = asyncHandler(async (req, res) => {
  try {
    const result = await query(
      `SELECT i.*, u.name as created_by_name, ub.name as used_by_name
       FROM invite_tokens i
       JOIN users u ON i.created_by = u.id
       LEFT JOIN users ub ON i.used_by = ub.id
       ORDER BY i.created_at DESC LIMIT 20`,
      []
    );
    res.json({ invites: result.rows });
  } catch (e) {
    res.json({ invites: [] });
  }
});

/**
 * POST /api/invites/validate - validate token on join page
 */
const validateInvite = asyncHandler(async (req, res) => {
  const { token } = req.body;
  const result = await query(
    `SELECT * FROM invite_tokens WHERE token=$1 AND used=false AND expires_at > NOW()`,
    [token]
  );
  if (!result.rows.length) {
    return res.status(400).json({ error: 'Invalid or expired invite link' });
  }
  res.json({ valid: true, role: result.rows[0].role });
});

module.exports = { list, updateRole, remove, disable, enable, createInvite, listInvites, validateInvite };
