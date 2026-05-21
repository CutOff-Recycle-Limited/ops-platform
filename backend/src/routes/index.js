const express = require('express');
const router = express.Router();

const { authenticate, requireAdmin, requireOperationAccess } = require('../middleware/auth');
const authCtrl = require('../controllers/auth.controller');
const opsCtrl = require('../controllers/operations.controller');
const tasksCtrl = require('../controllers/tasks.controller');
const commentsCtrl = require('../controllers/comments.controller');
const dashCtrl = require('../controllers/dashboard.controller');
const usersCtrl = require('../controllers/users.controller');

// ─── Auth ────────────────────────────────────────────────────────
router.post('/auth/register', authCtrl.register);
router.post('/auth/login', authCtrl.login);
router.get('/auth/me', authenticate, authCtrl.me);
router.get('/auth/users', authenticate, authCtrl.listUsers);

// ─── Dashboard ───────────────────────────────────────────────────
router.get('/dashboard', authenticate, dashCtrl.getDashboard);

// ─── Operations ──────────────────────────────────────────────────
router.get('/operations', authenticate, opsCtrl.list);
router.post('/operations', authenticate, opsCtrl.create);
router.get('/operations/:id', authenticate, requireOperationAccess, opsCtrl.getOne);
router.put('/operations/:id', authenticate, requireOperationAccess, opsCtrl.update);
router.delete('/operations/:id', authenticate, requireAdmin, opsCtrl.remove);
router.post('/operations/:id/members', authenticate, requireOperationAccess, opsCtrl.addMember);
router.delete('/operations/:id/members/:userId', authenticate, requireOperationAccess, opsCtrl.removeMember);

// ─── Tasks ───────────────────────────────────────────────────────
router.get('/tasks', authenticate, tasksCtrl.listAll);
router.post('/tasks', authenticate, tasksCtrl.createStandalone);
router.get('/tasks/today', authenticate, tasksCtrl.today);
router.get('/operations/:operationId/tasks', authenticate, requireOperationAccess, tasksCtrl.list);
router.post('/operations/:operationId/tasks', authenticate, requireOperationAccess, tasksCtrl.create);
router.get('/operations/:operationId/workflow', authenticate, requireOperationAccess, tasksCtrl.getWorkflow);
router.get('/tasks/:id', authenticate, tasksCtrl.getOne);
router.put('/tasks/:id', authenticate, tasksCtrl.update);
router.patch('/tasks/:id', authenticate, tasksCtrl.patchTask);
router.patch('/tasks/:id/transition', authenticate, tasksCtrl.transition);
router.delete('/tasks/:id', authenticate, tasksCtrl.remove);

// ─── Comments ────────────────────────────────────────────────────
router.post('/tasks/:taskId/comments', authenticate, commentsCtrl.create);
router.put('/comments/:id', authenticate, commentsCtrl.update);
router.delete('/comments/:id', authenticate, commentsCtrl.remove);

// ─── Users & Invites ─────────────────────────────────────────────
router.get('/users', authenticate, usersCtrl.list);
router.put('/users/:id/role', authenticate, requireAdmin, usersCtrl.updateRole);
router.delete('/users/:id', authenticate, requireAdmin, usersCtrl.remove);
router.post('/invites', authenticate, requireAdmin, usersCtrl.createInvite);
router.get('/invites', authenticate, requireAdmin, usersCtrl.listInvites);
router.post('/invites/validate', usersCtrl.validateInvite);

module.exports = router;
