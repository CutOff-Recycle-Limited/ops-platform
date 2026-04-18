const bcrypt = require('bcryptjs');
const { query } = require('../db');
const { generateToken } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/error');

/**
 * POST /api/auth/register
 */
const register = asyncHandler(async (req, res) => {
  const { name, email, password, role = 'member' } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Name, email, and password are required' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }

  const existing = await query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
  if (existing.rows.length) {
    return res.status(409).json({ error: 'Email already registered' });
  }

  const colors = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];
  const avatarColor = colors[Math.floor(Math.random() * colors.length)];

  const hash = await bcrypt.hash(password, 10);
  const result = await query(
    `INSERT INTO users (name, email, password_hash, role, avatar_color) VALUES ($1,$2,$3,$4,$5) RETURNING id, name, email, role, avatar_color`,
    [name.trim(), email.toLowerCase(), hash, role, avatarColor]
  );

  const user = result.rows[0];
  const token = generateToken(user.id);

  res.status(201).json({ user, token });
});

/**
 * POST /api/auth/login
 */
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
  if (!valid) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const token = generateToken(user.id);
  const { password_hash, ...userWithoutPassword } = user;

  res.json({ user: userWithoutPassword, token });
});

/**
 * GET /api/auth/me
 */
const me = asyncHandler(async (req, res) => {
  res.json({ user: req.user });
});

/**
 * GET /api/auth/users - list all users (for assignment dropdowns)
 */
const listUsers = asyncHandler(async (req, res) => {
  const result = await query(
    'SELECT id, name, email, role, avatar_color FROM users ORDER BY name',
    []
  );
  res.json({ users: result.rows });
});

module.exports = { register, login, me, listUsers };
