const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { Resend } = require('resend');
const { query, getClient } = require('../db');
const { generateToken, isAdmin } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/error');

let _resend = null;
function getResend() {
  if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY);
  return _resend;
}

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
       VALUES ($1,$2,$3,$4,$5) RETURNING id, name, email, role, avatar_color, disabled_at`,
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
    'SELECT id, name, email, password_hash, role, avatar_color, disabled_at FROM users WHERE email = $1',
    [email.toLowerCase()]
  );
  if (!result.rows.length) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const user = result.rows[0];
  if (user.disabled_at) return res.status(403).json({ error: 'Account is disabled' });

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
  if (isAdmin(req.user)) {
    const result = await query(
      'SELECT id, name, email, role, avatar_color, disabled_at FROM users WHERE disabled_at IS NULL ORDER BY name',
      []
    );
    return res.json({ users: result.rows });
  }

  const result = await query(
    `SELECT DISTINCT u.id, u.name, NULL::text as email, NULL::text as role, u.avatar_color, u.disabled_at
     FROM users u
     WHERE (u.id = $1 AND u.disabled_at IS NULL)
        OR EXISTS (
          SELECT 1
          FROM operations o
          LEFT JOIN operation_members current_member
            ON current_member.operation_id = o.id AND current_member.user_id = $1
          LEFT JOIN operation_members target_member
            ON target_member.operation_id = o.id AND target_member.user_id = u.id
          WHERE (o.owner_id = $1 OR current_member.user_id = $1)
            AND (o.owner_id = u.id OR target_member.user_id = u.id)
            AND u.disabled_at IS NULL
        )
     ORDER BY u.name`,
    [req.user.id]
  );
  res.json({ users: result.rows });
});

const forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email is required' });

  const userResult = await query(
    'SELECT id FROM users WHERE email = $1 AND disabled_at IS NULL',
    [email.toLowerCase()]
  );

  // Always return the same response to avoid leaking which emails are registered
  const genericResponse = { message: 'If that email is registered, a reset link has been sent.' };

  if (!userResult.rows.length) return res.json(genericResponse);

  const userId = userResult.rows[0].id;
  const token = crypto.randomBytes(32).toString('hex');

  // Invalidate any existing unused tokens for this user
  await query(
    'UPDATE password_reset_tokens SET used = true WHERE user_id = $1 AND used = false',
    [userId]
  );

  await query(
    `INSERT INTO password_reset_tokens (token, user_id)
     VALUES ($1, $2)`,
    [token, userId]
  );

  const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${token}`;

  await getResend().emails.send({
    from: process.env.FROM_EMAIL || 'noreply@cutoffrecycle.co.tz',
    to: email.toLowerCase(),
    subject: 'Reset your password — CutOff Recycle Ops',
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px; color: #1a1a1a;">
        <img src="https://ops.cutoffrecycle.co.tz/cr-logo.png" alt="CutOff Recycle" style="width: 48px; height: 48px; margin-bottom: 24px;" />
        <h2 style="font-size: 20px; font-weight: 800; margin: 0 0 8px;">Reset your password</h2>
        <p style="color: #6b7280; font-size: 14px; margin: 0 0 24px;">
          We received a request to reset your password. Click the button below to choose a new one.
          This link expires in <strong>1 hour</strong>.
        </p>
        <a href="${resetUrl}"
          style="display: inline-block; background: #50ad32; color: white; font-weight: 700;
                 padding: 12px 28px; border-radius: 8px; text-decoration: none; font-size: 14px;">
          Reset Password
        </a>
        <p style="color: #9ca3af; font-size: 12px; margin: 24px 0 0;">
          If you didn't request this, you can safely ignore this email. Your password won't change.
        </p>
      </div>
    `,
  });

  res.json(genericResponse);
});

const resetPassword = asyncHandler(async (req, res) => {
  const { token, password } = req.body;
  if (!token || !password) return res.status(400).json({ error: 'Token and password are required' });
  if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });

  const client = await getClient();
  try {
    await client.query('BEGIN');

    const tokenResult = await client.query(
      `SELECT * FROM password_reset_tokens
       WHERE token = $1 AND used = false AND expires_at > NOW()
       FOR UPDATE`,
      [token]
    );
    if (!tokenResult.rows.length) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'This reset link is invalid or has expired.' });
    }

    const tokenRow = tokenResult.rows[0];
    const hash = await bcrypt.hash(password, 10);

    await client.query(
      'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2',
      [hash, tokenRow.user_id]
    );
    await client.query(
      'UPDATE password_reset_tokens SET used = true WHERE id = $1',
      [tokenRow.id]
    );

    await client.query('COMMIT');
    res.json({ message: 'Password updated successfully.' });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
});

module.exports = { register, login, me, listUsers, forgotPassword, resetPassword };
