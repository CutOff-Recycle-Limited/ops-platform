const bcrypt = require('bcryptjs');
const { query, getClient } = require('../db');
const { generateToken } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/error');

const register = asyncHandler(async (req, res) => {
  const { name, email, password, invite_token } = req.body;
  const inviteToken = typeof invite_token === 'string' ? invite_token.trim() : '';

  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Name, email, and password are required' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }
  if (!inviteToken) {
    return res.status(400).json({ error: 'Invite token is required' });
  }

  const colors = ['#50ad32', '#1f4074', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];
  const avatarColor = colors[Math.floor(Math.random() * colors.length)];
  const hash = await bcrypt.hash(password, 10);

  const client = await getClient();
  try {
    await client.query('BEGIN');

    const tokenResult = await client.query(
      `SELECT * FROM invite_tokens
       WHERE token=$1 AND used=false AND expires_at > NOW()
       FOR UPDATE`,
      [inviteToken]
    );
    if (!tokenResult.rows.length) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Invalid or expired invite link' });
    }

    const existing = await client.query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
    if (existing.rows.length) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'Email already registered' });
    }

    const tokenRow = tokenResult.rows[0];
    const result = await client.query(
      `INSERT INTO users (name, email, password_hash, role, avatar_color)
       VALUES ($1,$2,$3,$4,$5) RETURNING id, name, email, role, avatar_color`,
      [name.trim(), email.toLowerCase(), hash, tokenRow.role, avatarColor]
    );

    const user = result.rows[0];

    await client.query(
      `UPDATE invite_tokens SET used=true, used_by=$1 WHERE id=$2`,
      [user.id, tokenRow.id]
    );

    await client.query('COMMIT');

    const token = generateToken(user.id);
    res.status(201).json({ user, token });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
});

const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  const result = await query(
    'SELECT id, name, email, password_hash, role, avatar_color FROM users WHERE email = $1',
    [email.toLowerCase()]
  );
  if (!result.rows.length) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const user = result.rows[0];
  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

  const token = generateToken(user.id);
  const { password_hash, ...userWithoutPassword } = user;
  res.json({ user: userWithoutPassword, token });
});

const me = asyncHandler(async (req, res) => {
  res.json({ user: req.user });
});

const listUsers = asyncHandler(async (req, res) => {
  const result = await query(
    'SELECT id, name, email, role, avatar_color FROM users ORDER BY name',
    []
  );
  res.json({ users: result.rows });
});

module.exports = { register, login, me, listUsers };
