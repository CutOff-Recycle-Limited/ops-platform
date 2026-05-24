const { query } = require('../db');
const { asyncHandler } = require('../middleware/error');
const crypto = require('crypto');

const VALID_USER_ROLES = new Set(['admin', 'manager', 'member']);
const PLATFORM_ROLE_OPTIONS = {
  crm: new Set(['admin', 'staff', 'sales', 'agronomist', 'operations']),
  competitor_intel: new Set(['admin', 'researcher', 'viewer']),
};
const VALID_PLATFORMS = Object.keys(PLATFORM_ROLE_OPTIONS);

const USER_SELECT = 'id, name, email, role, avatar_color, disabled_at, created_at';

const emptyPlatformRoles = () => Object.fromEntries(VALID_PLATFORMS.map(platform => [platform, null]));

const validatePlatform = (platform) => VALID_PLATFORMS.includes(platform);

const validatePlatformRole = (platform, role) => (
  validatePlatform(platform) && PLATFORM_ROLE_OPTIONS[platform].has(role)
);

const attachPlatformRoles = async (users) => {
  if (!users.length) return users;

  const roleResult = await query(
    `SELECT user_id, platform, role
     FROM user_platform_roles
     WHERE user_id = ANY($1::uuid[])
       AND platform = ANY($2::text[])`,
    [users.map(user => user.id), VALID_PLATFORMS]
  );

  const byUser = new Map(users.map(user => [String(user.id), emptyPlatformRoles()]));
  for (const row of roleResult.rows) {
    const roles = byUser.get(String(row.user_id));
    if (roles) roles[row.platform] = row.role;
  }

  return users.map(user => ({
    ...user,
    platform_roles: byUser.get(String(user.id)) || emptyPlatformRoles(),
  }));
};

const getUserWithPlatformRoles = async (id) => {
  const result = await query(`SELECT ${USER_SELECT} FROM users WHERE id=$1`, [id]);
  if (!result.rows.length) return null;
  const [user] = await attachPlatformRoles(result.rows);
  return user;
};

const getPlatformRoleSummary = async (userId) => {
  const result = await query(
    `SELECT platform, role
     FROM user_platform_roles
     WHERE user_id=$1
       AND platform = ANY($2::text[])
     ORDER BY platform`,
    [userId, VALID_PLATFORMS]
  );

  return result.rows.reduce((roles, row) => {
    roles[row.platform] = row.role;
    return roles;
  }, emptyPlatformRoles());
};

/**
 * GET /api/users - list all users (admin only)
 */
const list = asyncHandler(async (req, res) => {
  const result = await query(
    `SELECT ${USER_SELECT} FROM users ORDER BY name`,
    []
  );
  const users = await attachPlatformRoles(result.rows);
  res.json({ users });
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
  const [user] = await attachPlatformRoles(result.rows);
  res.json({ user });
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
  const [user] = await attachPlatformRoles(result.rows);
  res.json({ success: true, user });
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
  const [user] = await attachPlatformRoles(result.rows);
  res.json({ user });
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
  const [user] = await attachPlatformRoles(result.rows);
  res.json({ user });
});

/**
 * GET /api/users/:id/platform-roles - read cross-platform roles (admin only)
 */
const getPlatformRoles = asyncHandler(async (req, res) => {
  const user = await getUserWithPlatformRoles(req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });

  res.json({
    user_id: user.id,
    platform_roles: user.platform_roles,
  });
});

/**
 * PUT /api/users/:id/platform-roles - upsert one cross-platform role (admin only)
 */
const upsertPlatformRole = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { platform, role } = req.body;

  if (!validatePlatform(platform)) {
    return res.status(400).json({ error: 'Invalid platform' });
  }
  if (!validatePlatformRole(platform, role)) {
    return res.status(400).json({ error: 'Invalid role for platform' });
  }

  const userExists = await query('SELECT id FROM users WHERE id=$1', [id]);
  if (!userExists.rows.length) return res.status(404).json({ error: 'User not found' });

  await query(
    `INSERT INTO user_platform_roles (user_id, platform, role)
     VALUES ($1,$2,$3)
     ON CONFLICT (user_id, platform)
     DO UPDATE SET role=EXCLUDED.role, updated_at=NOW()`,
    [id, platform, role]
  );

  const user = await getUserWithPlatformRoles(id);
  res.json({
    user,
    platform_roles: await getPlatformRoleSummary(id),
  });
});

/**
 * DELETE /api/users/:id/platform-roles/:platform - remove one cross-platform role (admin only)
 */
const removePlatformRole = asyncHandler(async (req, res) => {
  const { id, platform } = req.params;

  if (!validatePlatform(platform)) {
    return res.status(400).json({ error: 'Invalid platform' });
  }

  const userExists = await query('SELECT id FROM users WHERE id=$1', [id]);
  if (!userExists.rows.length) return res.status(404).json({ error: 'User not found' });

  await query(
    `DELETE FROM user_platform_roles
     WHERE user_id=$1 AND platform=$2`,
    [id, platform]
  );

  const user = await getUserWithPlatformRoles(id);
  res.json({
    user,
    platform_roles: await getPlatformRoleSummary(id),
  });
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

module.exports = {
  list,
  updateRole,
  remove,
  disable,
  enable,
  getPlatformRoles,
  upsertPlatformRole,
  removePlatformRole,
  createInvite,
  listInvites,
  validateInvite,
};
