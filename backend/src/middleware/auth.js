const jwt = require('jsonwebtoken');
const { query } = require('../db');

const JWT_SECRET = process.env.JWT_SECRET || 'ops-platform-secret-key-change-in-production';

const isAdmin = (user) => user?.role === 'admin';
const isAdminOrManager = (user) => user?.role === 'admin' || user?.role === 'manager';

const getOperationPermission = async (user, operationId) => {
  const empty = {
    exists: false,
    hasAccess: false,
    canManage: false,
    isOwner: false,
    memberRole: null,
  };

  if (!user || !operationId) return empty;

  const result = await query(
    `SELECT o.id, o.owner_id, om.role as member_role
     FROM operations o
     LEFT JOIN operation_members om ON om.operation_id = o.id AND om.user_id = $2
     WHERE o.id = $1`,
    [operationId, user.id]
  );

  if (!result.rows.length) return empty;

  const operation = result.rows[0];
  const ownerId = operation.owner_id?.toString?.() || operation.owner_id;
  const userId = user.id?.toString?.() || user.id;
  const isOwner = ownerId === userId;
  const isMember = Boolean(operation.member_role);
  const canManage = isAdmin(user) || isOwner || operation.member_role === 'manager';

  return {
    exists: true,
    hasAccess: canManage || isMember,
    canManage,
    isOwner,
    memberRole: operation.member_role || null,
  };
};

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
  if (!isAdmin(req.user)) {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};

const requireAdminOrManager = (req, res, next) => {
  if (!isAdminOrManager(req.user)) {
    return res.status(403).json({ error: 'Admin or manager access required' });
  }
  next();
};

/**
 * Check user has access to an operation (is member or admin)
 */
const requireOperationAccess = async (req, res, next) => {
  try {
    const operationId = req.params.operationId || req.params.id || req.body.operation_id;
    if (!operationId) return next();

    const permission = await getOperationPermission(req.user, operationId);
    if (!permission.hasAccess) {
      return res.status(403).json({ error: 'Access denied to this operation' });
    }

    req.operationPermission = permission;
    next();
  } catch (err) {
    next(err);
  }
};

const requireOperationManagerOrAdmin = async (req, res, next) => {
  try {
    const operationId = req.params.operationId || req.params.id || req.body.operation_id;
    if (!operationId) return res.status(400).json({ error: 'operation_id is required' });

    const permission = await getOperationPermission(req.user, operationId);
    if (!permission.exists) return res.status(404).json({ error: 'Operation not found' });
    if (!permission.canManage) {
      return res.status(403).json({ error: 'Operation manager or admin access required' });
    }

    req.operationPermission = permission;
    next();
  } catch (err) {
    next(err);
  }
};

const requireOperationOwnerOrAdmin = async (req, res, next) => {
  try {
    const operationId = req.params.operationId || req.params.id || req.body.operation_id;
    if (!operationId) return res.status(400).json({ error: 'operation_id is required' });

    const permission = await getOperationPermission(req.user, operationId);
    if (!permission.exists) return res.status(404).json({ error: 'Operation not found' });
    if (!isAdmin(req.user) && !permission.isOwner) {
      return res.status(403).json({ error: 'Operation owner or admin access required' });
    }

    req.operationPermission = permission;
    next();
  } catch (err) {
    next(err);
  }
};

const generateToken = (userId) => {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: '7d' });
};

module.exports = {
  authenticate,
  requireAdmin,
  requireAdminOrManager,
  requireOperationAccess,
  requireOperationManagerOrAdmin,
  requireOperationOwnerOrAdmin,
  getOperationPermission,
  isAdmin,
  isAdminOrManager,
  generateToken,
  JWT_SECRET,
};
