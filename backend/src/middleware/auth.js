const jwt = require('jsonwebtoken');
const { query } = require('../db');

const JWT_SECRET = process.env.JWT_SECRET || 'ops-platform-secret-key-change-in-production';

/**
 * Verify JWT token and attach user to request
 */
const authenticate = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const result = await query('SELECT id, name, email, role, avatar_color FROM users WHERE id = $1', [decoded.userId]);
    if (!result.rows.length) return res.status(401).json({ error: 'User not found' });
    req.user = result.rows[0];
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' });
  }
};

/**
 * Require admin role
 */
const requireAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};

/**
 * Check user has access to an operation (is member or admin)
 */
const requireOperationAccess = async (req, res, next) => {
  const operationId = req.params.operationId || req.params.id || req.body.operation_id;
  if (!operationId) return next();

  if (req.user.role === 'admin') return next();

  const result = await query(
    'SELECT id FROM operation_members WHERE operation_id = $1 AND user_id = $2',
    [operationId, req.user.id]
  );

  if (!result.rows.length) {
    // Check if they're the owner
    const ownerCheck = await query('SELECT id FROM operations WHERE id = $1 AND owner_id = $2', [operationId, req.user.id]);
    if (!ownerCheck.rows.length) {
      return res.status(403).json({ error: 'Access denied to this operation' });
    }
  }
  next();
};

const generateToken = (userId) => {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: '7d' });
};

module.exports = { authenticate, requireAdmin, requireOperationAccess, generateToken, JWT_SECRET };
