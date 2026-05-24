const { query } = require('../db');
const { asyncHandler } = require('../middleware/error');
const { getOperationPermission, isAdminOrManager } = require('../middleware/auth');

const VALID_PRIORITIES = new Set(['critical', 'high', 'medium', 'low']);
const VALID_SIMPLE_STATUSES = new Set(['todo', 'in_progress', 'done']);
const VALID_TYPES = new Set(['task', 'epic', 'subtask']);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const taskSelect = (currentUserParam = 'NULL') => `
  SELECT t.*,
    COALESCE(t.created_by_id, t.reporter_id) as created_by_id,
    s.category as status,
    s.name as status_name, s.color as status_color, s.position as status_position,
    u.name as assignee_name, u.avatar_color as assignee_color,
    r.name as reporter_name, r.avatar_color as reporter_color,
	    cb.name as created_by_name,
	    o.name as operation_name, o.key as operation_key, o.color as operation_color,
	    CASE
	      WHEN crm_customer.id IS NOT NULL THEN jsonb_build_object(
	        'type', 'customer',
	        'id', crm_customer.id,
	        'source', 'crm',
	        'label', crm_customer.name,
	        'summary', NULLIF(concat_ws(' · ',
	          CASE WHEN crm_customer.lead_score IS NOT NULL THEN crm_customer.lead_score || ' lead' END,
	          crm_customer.region
	        ), ''),
	        'customer_id', crm_customer.id,
	        'customer_name', crm_customer.name,
	        'customer_phone', crm_customer.phone,
	        'lead_score', crm_customer.lead_score,
	        'region', crm_customer.region
	      )
	      WHEN crm_interaction.id IS NOT NULL THEN jsonb_build_object(
	        'type', 'interaction',
	        'id', crm_interaction.id,
	        'source', 'crm',
	        'label', initcap(replace(crm_interaction.channel, '_', ' ')) || ' with ' || COALESCE(crm_interaction_customer.name, 'customer'),
	        'summary', NULLIF(concat_ws(' · ',
	          crm_interaction.outcome,
	          CASE WHEN crm_insight.urgency IS NOT NULL THEN crm_insight.urgency || ' urgency' END,
	          CASE WHEN crm_insight.sentiment IS NOT NULL THEN crm_insight.sentiment || ' sentiment' END
	        ), ''),
	        'customer_id', crm_interaction.customer_id,
	        'customer_name', crm_interaction_customer.name,
	        'customer_phone', crm_interaction_customer.phone,
	        'channel', crm_interaction.channel,
	        'direction', crm_interaction.direction,
	        'outcome', crm_interaction.outcome,
	        'urgency', crm_insight.urgency,
	        'sentiment', crm_insight.sentiment,
	        'category', crm_insight.category
	      )
	      ELSE NULL
	    END as linked_entity,
	    (SELECT COALESCE(SUM(te.minutes), 0)::int FROM task_time_entries te WHERE te.task_id = t.id) as total_logged_minutes,
	    (SELECT COALESCE(SUM(te.minutes), 0)::int FROM task_time_entries te WHERE te.task_id = t.id AND te.user_id = ${currentUserParam}::uuid) as current_user_logged_minutes,
	    (SELECT COUNT(*) FROM comments c WHERE c.task_id = t.id) as comment_count,
    (SELECT COUNT(*) FROM tasks sub WHERE sub.parent_id = t.id) as subtask_count
  FROM tasks t
  JOIN operations o ON t.operation_id = o.id
  LEFT JOIN users u ON t.assignee_id = u.id
	  LEFT JOIN users r ON t.reporter_id = r.id
	  LEFT JOIN users cb ON COALESCE(t.created_by_id, t.reporter_id) = cb.id
	  LEFT JOIN statuses s ON t.status_id = s.id
	  LEFT JOIN customers crm_customer
	    ON t.linked_entity_type = 'customer'
	   AND crm_customer.id::text = t.linked_entity_id
	  LEFT JOIN interactions crm_interaction
	    ON t.linked_entity_type = 'interaction'
	   AND crm_interaction.id::text = t.linked_entity_id
	  LEFT JOIN customers crm_interaction_customer
	    ON crm_interaction_customer.id = crm_interaction.customer_id
	  LEFT JOIN ai_insights crm_insight
	    ON crm_insight.interaction_id = crm_interaction.id
	`;

const TASK_ORDER = `
  CASE WHEN s.category = 'done' THEN 1 ELSE 0 END,
  t.due_date ASC NULLS LAST,
  CASE t.priority
    WHEN 'critical' THEN 0
    WHEN 'high' THEN 1
    WHEN 'medium' THEN 2
    WHEN 'low' THEN 3
    ELSE 4
  END,
  t.created_at DESC
`;

const TIME_ENTRY_SELECT = `
  SELECT te.*,
    u.name as user_name,
    u.avatar_color as user_avatar_color
  FROM task_time_entries te
  JOIN users u ON te.user_id = u.id
`;

const httpError = (status, message) => {
  const err = new Error(message);
  err.status = status;
  return err;
};

const sameId = (left, right) => {
  if (!left || !right) return false;
  return String(left) === String(right);
};

const addOperationAccessFilter = (where, params, user) => {
  if (user.role === 'admin') return;
  params.push(user.id);
  const userParam = `$${params.length}`;
  where.push(`(
    o.owner_id = ${userParam}
    OR EXISTS (
      SELECT 1 FROM operation_members om
      WHERE om.operation_id = o.id AND om.user_id = ${userParam}
    )
  )`);
};

const addTaskSummaryUserParam = (params, user) => {
  params.push(user.id);
  return `$${params.length}`;
};

const normalizeOptionalText = (value, field, maxLength) => {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  if (typeof value !== 'string') throw httpError(400, `${field} must be text`);

  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.length > maxLength) throw httpError(400, `${field} must be ${maxLength} characters or fewer`);
  if (trimmed.includes('\u0000')) throw httpError(400, `${field} contains invalid characters`);

  return trimmed;
};

const normalizeRequiredTitle = (value) => {
  if (typeof value !== 'string' || !value.trim()) throw httpError(400, 'Title is required');
  const title = value.trim();
  if (title.length > 255) throw httpError(400, 'Title must be 255 characters or fewer');
  return title;
};

const normalizeOptionalUuid = (value, field) => {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  if (typeof value !== 'string' || !UUID_RE.test(value)) throw httpError(400, `${field} must be a valid UUID`);
  return value;
};

const normalizeDate = (value, field = 'due_date') => {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw httpError(400, `${field} must be a YYYY-MM-DD date`);
  }

  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    throw httpError(400, `${field} must be a valid date`);
  }
  return value;
};

const normalizeLimit = (value, fallback = null) => {
  if (value === undefined || value === null || value === '') return fallback;

  const limit = Number(value);
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    throw httpError(400, 'limit must be an integer between 1 and 100');
  }
  return limit;
};

const normalizePriorityList = (value) => {
  if (value === undefined || value === null || value === '') return [];

  const priorities = String(value).split(',').map(item => item.trim()).filter(Boolean);
  if (!priorities.length) return [];

  priorities.forEach(priority => normalizePriority(priority));
  return [...new Set(priorities)];
};

const normalizeStatusCategory = (value) => {
  if (value === undefined || value === null || value === '') return null;
  if (value === 'open') return 'open';
  if (!VALID_SIMPLE_STATUSES.has(value)) {
    throw httpError(400, 'status_category must be one of open, todo, in_progress, or done');
  }
  return value;
};

const normalizeRecentDays = (value) => {
  if (value === undefined || value === null || value === '' || value === 'false') return null;
  if (value === 'true' || value === '1') return 14;

  const days = Number(value);
  if (!Number.isInteger(days) || days < 1 || days > 90) {
    throw httpError(400, 'completed_recently must be true or a number of days between 1 and 90');
  }
  return days;
};

const normalizeLoggedAt = (value) => {
  if (value === undefined) return undefined;
  if (value === null || value === '') throw httpError(400, 'logged_at must be a valid date or timestamp');

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw httpError(400, 'logged_at must be a valid date or timestamp');

  return date.toISOString();
};

const normalizeMinutes = (value) => {
  const minutes = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
  if (!Number.isInteger(minutes) || minutes <= 0) {
    throw httpError(400, 'minutes must be a positive integer');
  }
  return minutes;
};

const normalizePriority = (value, fallback = 'medium') => {
  const priority = value === undefined || value === null || value === '' ? fallback : value;
  if (typeof priority !== 'string' || !VALID_PRIORITIES.has(priority)) {
    throw httpError(400, 'Priority must be one of critical, high, medium, or low');
  }
  return priority;
};

const normalizeType = (value, fallback = 'task') => {
  const type = value === undefined || value === null || value === '' ? fallback : value;
  if (typeof type !== 'string' || !VALID_TYPES.has(type)) {
    throw httpError(400, 'Type must be one of task, epic, or subtask');
  }
  return type;
};

const ensureUserExists = async (id, field) => {
  if (!id) return;
  const result = await query('SELECT id FROM users WHERE id = $1', [id]);
  if (!result.rows.length) throw httpError(400, `${field} was not found`);
};

const getOperationStatus = async (operationId, status, user, allowFallback = false) => {
  if (!UUID_RE.test(operationId || '')) throw httpError(400, 'operation_id must be a valid UUID');
  if (!VALID_SIMPLE_STATUSES.has(status)) throw httpError(400, 'Status must be one of todo, in_progress, or done');

  const where = ['o.id = $1'];
  const params = [operationId, status];
  addOperationAccessFilter(where, params, user);

  const categoryClause = allowFallback ? '' : 'AND s.category = $2';
  const orderBy = allowFallback
    ? 'CASE WHEN s.category = $2 THEN 0 ELSE 1 END, s.position'
    : 's.position';

  const result = await query(
    `SELECT o.id as operation_id, w.id as workflow_id, s.id as status_id, s.category as status
     FROM operations o
     JOIN workflows w ON w.operation_id = o.id
     JOIN statuses s ON s.workflow_id = w.id ${categoryClause}
     WHERE ${where.join(' AND ')}
     ORDER BY ${orderBy}
     LIMIT 1`,
    params
  );

  if (!result.rows.length) {
    throw httpError(400, 'Operation workflow is not available for this task');
  }

  return result.rows[0];
};

const getAccessibleTask = async (taskId, user) => {
  if (!UUID_RE.test(taskId || '')) throw httpError(400, 'Task id must be a valid UUID');

  const where = ['t.id = $1'];
  const params = [taskId];
  addOperationAccessFilter(where, params, user);
  const currentUserParam = addTaskSummaryUserParam(params, user);

  const result = await query(
    `${taskSelect(currentUserParam)}
     WHERE ${where.join(' AND ')}
     LIMIT 1`,
    params
  );

  if (!result.rows.length) throw httpError(404, 'Task not found');
  return result.rows[0];
};

const getFullTask = async (taskId, user) => {
  const task = await getAccessibleTask(taskId, user);
  const comments = await query(
    `SELECT c.*, u.name as user_name, u.avatar_color
     FROM comments c JOIN users u ON c.user_id = u.id
     WHERE c.task_id = $1 ORDER BY c.created_at`,
    [taskId]
  );
  const subtasks = await query(
    `SELECT t.*, u.name as assignee_name, s.name as status_name, s.color as status_color, s.category as status
     FROM tasks t
     LEFT JOIN users u ON t.assignee_id = u.id
     LEFT JOIN statuses s ON t.status_id = s.id
     WHERE t.parent_id = $1 ORDER BY t.created_at`,
    [taskId]
  );
  const activity = await query(
    `SELECT a.*, COALESCE(u.name, actor.name) as user_name, COALESCE(u.avatar_color, actor.avatar_color) as avatar_color
     FROM activity_logs a
     LEFT JOIN users u ON a.user_id = u.id
     LEFT JOIN users actor ON a.actor_id = actor.id
     WHERE a.task_id = $1 ORDER BY a.created_at DESC LIMIT 50`,
    [taskId]
  );

  return {
    task,
    subtasks: subtasks.rows,
    comments: comments.rows,
    activity: activity.rows,
  };
};

const insertActivity = async ({ taskId, operationId, userId, action, oldValue = null, newValue = null, metadata = null }) => {
  await query(
    `INSERT INTO activity_logs
      (task_id, operation_id, user_id, actor_id, action, old_value, new_value, metadata)
     VALUES ($1,$2,$3,$3,$4,$5,$6,$7)`,
    [
      taskId,
      operationId,
      userId,
      action,
      oldValue ? JSON.stringify(oldValue) : null,
      newValue ? JSON.stringify(newValue) : null,
      metadata ? JSON.stringify(metadata) : null,
    ]
  );
};

const getTimeEntry = async (taskId, entryId) => {
  if (!UUID_RE.test(entryId || '')) throw httpError(400, 'Time entry id must be a valid UUID');

  const result = await query(
    `${TIME_ENTRY_SELECT}
     WHERE te.task_id = $1 AND te.id = $2
     LIMIT 1`,
    [taskId, entryId]
  );

  if (!result.rows.length) throw httpError(404, 'Time entry not found');
  return result.rows[0];
};

const requireTimeEntryOwnerOrManager = async (entry, task, user) => {
  if (sameId(entry.user_id, user.id) || isAdminOrManager(user)) return;

  const permission = await getOperationPermission(user, task.operation_id);
  if (permission.canManage) return;

  throw httpError(403, 'Cannot edit time logged by another user');
};

const requireTaskDeletePermission = async (task, user) => {
  if (
    isAdminOrManager(user) ||
    sameId(task.reporter_id, user.id) ||
    sameId(task.created_by_id, user.id)
  ) {
    return;
  }

  const permission = await getOperationPermission(user, task.operation_id);
  if (permission.canManage) return;

  throw httpError(403, 'Cannot delete this task');
};

const createTaskForOperation = async (operationId, body, user) => {
  const title = normalizeRequiredTitle(body.title);
  const description = normalizeOptionalText(body.description, 'description', 5000);
  const priority = normalizePriority(body.priority);
  const assigneeId = normalizeOptionalUuid(body.assignee_id, 'assignee_id');
  const dueDate = normalizeDate(body.due_date);
  const type = normalizeType(body.type);
  const parentId = normalizeOptionalUuid(body.parent_id, 'parent_id');
  const linkedEntityType = normalizeOptionalText(body.linked_entity_type, 'linked_entity_type', 50);
  const linkedEntityId = normalizeOptionalText(body.linked_entity_id, 'linked_entity_id', 120);

  await ensureUserExists(assigneeId, 'Assignee');

  const { workflow_id, status_id } = await getOperationStatus(operationId, 'todo', user, true);

  const numResult = await query(
    'SELECT COALESCE(MAX(task_number), 0) + 1 as next_num FROM tasks WHERE operation_id = $1',
    [operationId]
  );
  const taskNumber = numResult.rows[0].next_num;

  const task = await query(
    `INSERT INTO tasks
      (operation_id, workflow_id, status_id, title, description, priority, assignee_id,
       reporter_id, created_by_id, due_date, linked_entity_type, linked_entity_id, type, parent_id, task_number)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$8,$9,$10,$11,$12,$13,$14)
     RETURNING id`,
    [
      operationId,
      workflow_id,
      status_id,
      title,
      description || null,
      priority,
      assigneeId || null,
      user.id,
      dueDate || null,
      linkedEntityType || null,
      linkedEntityId || null,
      type,
      parentId || null,
      taskNumber,
    ]
  );

  const taskId = task.rows[0].id;
  await insertActivity({
    taskId,
    operationId,
    userId: user.id,
    action: 'create',
    newValue: { title, priority, assignee_id: assigneeId || null, due_date: dueDate || null },
    metadata: { source: 'tasks' },
  });

  return getAccessibleTask(taskId, user);
};

/**
 * GET /api/tasks
 * Returns tasks across operations the user can access.
 */
const listAll = asyncHandler(async (req, res) => {
  const {
    assignee_id,
    priority,
    status,
    status_category,
    due_before,
    due_after,
    completed_recently,
    linked_entity_type,
    linked_entity_id,
    limit,
  } = req.query;
  const where = ['1 = 1'];
  const params = [];
  const limitValue = normalizeLimit(limit);
  const recentDays = normalizeRecentDays(completed_recently);

  addOperationAccessFilter(where, params, req.user);

  if (assignee_id) {
    if (!UUID_RE.test(assignee_id)) throw httpError(400, 'assignee_id must be a valid UUID');
    params.push(assignee_id);
    where.push(`t.assignee_id = $${params.length}`);
  }
  if (priority) {
    const priorities = normalizePriorityList(priority);
    if (priorities.length === 1) {
      params.push(priorities[0]);
      where.push(`t.priority = $${params.length}`);
    } else if (priorities.length > 1) {
      params.push(priorities);
      where.push(`t.priority = ANY($${params.length}::text[])`);
    }
  }
  if (status) {
    if (!VALID_SIMPLE_STATUSES.has(status)) throw httpError(400, 'Status must be one of todo, in_progress, or done');
    params.push(status);
    where.push(`s.category = $${params.length}`);
  }
  if (status_category) {
    const category = normalizeStatusCategory(status_category);
    if (category === 'open') {
      where.push(`s.category <> 'done'`);
    } else if (category) {
      params.push(category);
      where.push(`s.category = $${params.length}`);
    }
  }
  if (due_before !== undefined) {
    const dueBefore = normalizeDate(due_before, 'due_before');
    if (dueBefore) {
      params.push(dueBefore);
      where.push(`t.due_date < $${params.length}::date`);
    }
  }
  if (due_after !== undefined) {
    const dueAfter = normalizeDate(due_after, 'due_after');
    if (dueAfter) {
      params.push(dueAfter);
      where.push(`t.due_date >= $${params.length}::date`);
    }
  }
  if (recentDays) {
    where.push(`s.category = 'done'`);
    params.push(recentDays);
    where.push(`t.updated_at >= CURRENT_DATE - ($${params.length}::int * INTERVAL '1 day')`);
  }
  if (linked_entity_type !== undefined) {
    const linkedEntityType = normalizeOptionalText(linked_entity_type, 'linked_entity_type', 50);
    if (linkedEntityType) {
      params.push(linkedEntityType);
      where.push(`t.linked_entity_type = $${params.length}`);
    }
  }
  if (linked_entity_id !== undefined) {
    const linkedEntityId = normalizeOptionalText(linked_entity_id, 'linked_entity_id', 120);
    if (linkedEntityId) {
      params.push(linkedEntityId);
      where.push(`t.linked_entity_id = $${params.length}`);
    }
  }

  const currentUserParam = addTaskSummaryUserParam(params, req.user);
  const orderBy = recentDays ? 't.updated_at DESC, t.created_at DESC' : TASK_ORDER;
  const limitClause = limitValue ? `LIMIT $${params.length + 1}` : '';
  if (limitValue) params.push(limitValue);

  const tasks = await query(
    `${taskSelect(currentUserParam)}
     WHERE ${where.join(' AND ')}
     ORDER BY ${orderBy}
     ${limitClause}`,
    params
  );

  res.json({ tasks: tasks.rows });
});

/**
 * GET /api/tasks/today
 * Simple daily view: open tasks first, ordered by due date and priority.
 */
const today = asyncHandler(async (req, res) => {
  const where = [`(s.category <> 'done' OR t.due_date = CURRENT_DATE)`];
  const params = [];

  addOperationAccessFilter(where, params, req.user);

  const currentUserParam = addTaskSummaryUserParam(params, req.user);
  const tasks = await query(
    `${taskSelect(currentUserParam)}
     WHERE ${where.join(' AND ')}
     ORDER BY ${TASK_ORDER}`,
    params
  );

  res.json({ tasks: tasks.rows });
});

/**
 * GET /api/operations/:operationId/tasks
 * Returns all tasks grouped by status (for Kanban)
 */
const list = asyncHandler(async (req, res) => {
  const { operationId } = req.params;
  const { assignee_id, priority, type, linked_entity_type, linked_entity_id } = req.query;

  let whereClause = 'WHERE t.operation_id = $1';
  const params = [operationId];
  let i = 2;

  if (assignee_id) {
    if (!UUID_RE.test(assignee_id)) throw httpError(400, 'assignee_id must be a valid UUID');
    whereClause += ` AND t.assignee_id = $${i++}`;
    params.push(assignee_id);
  }
  if (priority) {
    normalizePriority(priority);
    whereClause += ` AND t.priority = $${i++}`;
    params.push(priority);
  }
  if (type) {
    normalizeType(type);
    whereClause += ` AND t.type = $${i++}`;
    params.push(type);
  }
  if (linked_entity_type !== undefined) {
    const linkedEntityType = normalizeOptionalText(linked_entity_type, 'linked_entity_type', 50);
    if (linkedEntityType) {
      whereClause += ` AND t.linked_entity_type = $${i++}`;
      params.push(linkedEntityType);
    }
  }
  if (linked_entity_id !== undefined) {
    const linkedEntityId = normalizeOptionalText(linked_entity_id, 'linked_entity_id', 120);
    if (linkedEntityId) {
      whereClause += ` AND t.linked_entity_id = $${i++}`;
      params.push(linkedEntityId);
    }
  }

  const currentUserParam = addTaskSummaryUserParam(params, req.user);
  const tasks = await query(
    `${taskSelect(currentUserParam)}
     ${whereClause}
     ORDER BY s.position, t.position, t.created_at`,
    params
  );

  res.json({ tasks: tasks.rows });
});

/**
 * GET /api/tasks/:id
 */
const getOne = asyncHandler(async (req, res) => {
  const fullTask = await getFullTask(req.params.id, req.user);
  res.json(fullTask);
});

/**
 * POST /api/tasks
 */
const createStandalone = asyncHandler(async (req, res) => {
  const operationId = req.body.operation_id;
  if (!operationId) throw httpError(400, 'operation_id is required');

  const task = await createTaskForOperation(operationId, req.body, req.user);
  res.status(201).json({ task });
});

/**
 * POST /api/operations/:operationId/tasks
 */
const create = asyncHandler(async (req, res) => {
  const task = await createTaskForOperation(req.params.operationId, req.body, req.user);
  res.status(201).json({ task });
});

/**
 * PUT /api/tasks/:id
 */
const update = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { title, description, priority, assignee_id, due_date, type, linked_entity_type, linked_entity_id } = req.body;

  const old = await getAccessibleTask(id, req.user);
  const nextTitle = title === undefined ? undefined : normalizeRequiredTitle(title);
  const nextDescription = normalizeOptionalText(description, 'description', 5000);
  const nextPriority = priority === undefined ? undefined : normalizePriority(priority);
  const nextAssigneeId = normalizeOptionalUuid(assignee_id, 'assignee_id');
  const nextDueDate = normalizeDate(due_date);
  const nextType = type === undefined ? undefined : normalizeType(type);
  const nextLinkedEntityType = normalizeOptionalText(linked_entity_type, 'linked_entity_type', 50);
  const nextLinkedEntityId = normalizeOptionalText(linked_entity_id, 'linked_entity_id', 120);

  await ensureUserExists(nextAssigneeId, 'Assignee');

  const task = await query(
    `UPDATE tasks SET
      title=COALESCE($1,title),
      description=COALESCE($2,description),
      priority=COALESCE($3,priority),
      assignee_id=CASE WHEN $5 = true THEN assignee_id ELSE $4::uuid END,
      due_date=COALESCE($6::date, due_date),
      type=COALESCE($7,type),
      linked_entity_type=CASE WHEN $10 = true THEN linked_entity_type ELSE $8 END,
      linked_entity_id=CASE WHEN $11 = true THEN linked_entity_id ELSE $9 END,
      updated_at=NOW()
     WHERE id=$12 RETURNING id`,
    [
      nextTitle,
      nextDescription,
      nextPriority,
      nextAssigneeId,
      assignee_id === undefined,
      nextDueDate,
      nextType,
      nextLinkedEntityType,
      nextLinkedEntityId,
      linked_entity_type === undefined,
      linked_entity_id === undefined,
      id,
    ]
  );

  const changes = {};
  if (nextTitle !== undefined && nextTitle !== old.title) changes.title = { from: old.title, to: nextTitle };
  if (nextPriority !== undefined && nextPriority !== old.priority) changes.priority = { from: old.priority, to: nextPriority };
  if (assignee_id !== undefined && nextAssigneeId !== old.assignee_id) changes.assignee_id = { from: old.assignee_id, to: nextAssigneeId };
  if (linked_entity_type !== undefined && nextLinkedEntityType !== old.linked_entity_type) changes.linked_entity_type = { from: old.linked_entity_type, to: nextLinkedEntityType };
  if (linked_entity_id !== undefined && nextLinkedEntityId !== old.linked_entity_id) changes.linked_entity_id = { from: old.linked_entity_id, to: nextLinkedEntityId };

  if (Object.keys(changes).length) {
    await insertActivity({
      taskId: id,
      operationId: old.operation_id,
      userId: req.user.id,
      action: 'edit',
      oldValue: null,
      newValue: changes,
      metadata: { source: 'tasks_put' },
    });
  }

  const updated = await getAccessibleTask(task.rows[0].id, req.user);
  res.json({ task: updated });
});

/**
 * PATCH /api/tasks/:id
 * Minimal execution-layer update endpoint.
 */
const patchTask = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const allowedFields = ['title', 'description', 'priority', 'assignee_id', 'due_date', 'status', 'linked_entity_type', 'linked_entity_id'];
  const providedFields = Object.keys(req.body).filter(key => allowedFields.includes(key));

  if (!providedFields.length) throw httpError(400, 'No supported task fields provided');

  const old = await getAccessibleTask(id, req.user);
  const sets = [];
  const params = [];
  const editChanges = {};
  let statusChange = null;

  const addSet = (column, value, cast = '') => {
    params.push(value);
    sets.push(`${column} = $${params.length}${cast}`);
  };

  if (req.body.title !== undefined) {
    const value = normalizeRequiredTitle(req.body.title);
    if (value !== old.title) {
      addSet('title', value);
      editChanges.title = { from: old.title, to: value };
    }
  }

  if (req.body.description !== undefined) {
    const value = normalizeOptionalText(req.body.description, 'description', 5000);
    if (value !== old.description) {
      addSet('description', value);
      editChanges.description = { from: old.description, to: value };
    }
  }

  if (req.body.priority !== undefined) {
    const value = normalizePriority(req.body.priority);
    if (value !== old.priority) {
      addSet('priority', value);
      editChanges.priority = { from: old.priority, to: value };
    }
  }

  if (req.body.assignee_id !== undefined) {
    const value = normalizeOptionalUuid(req.body.assignee_id, 'assignee_id');
    await ensureUserExists(value, 'Assignee');
    if (value !== old.assignee_id) {
      addSet('assignee_id', value, '::uuid');
      editChanges.assignee_id = { from: old.assignee_id, to: value };
    }
  }

  if (req.body.due_date !== undefined) {
    const value = normalizeDate(req.body.due_date);
    const oldDueDate = old.due_date ? old.due_date.toISOString?.().slice(0, 10) || String(old.due_date).slice(0, 10) : null;
    if (value !== oldDueDate) {
      addSet('due_date', value, '::date');
      editChanges.due_date = { from: oldDueDate, to: value };
    }
  }

  if (req.body.linked_entity_type !== undefined) {
    const value = normalizeOptionalText(req.body.linked_entity_type, 'linked_entity_type', 50);
    if (value !== old.linked_entity_type) {
      addSet('linked_entity_type', value);
      editChanges.linked_entity_type = { from: old.linked_entity_type, to: value };
    }
  }

  if (req.body.linked_entity_id !== undefined) {
    const value = normalizeOptionalText(req.body.linked_entity_id, 'linked_entity_id', 120);
    if (value !== old.linked_entity_id) {
      addSet('linked_entity_id', value);
      editChanges.linked_entity_id = { from: old.linked_entity_id, to: value };
    }
  }

  if (req.body.status !== undefined) {
    const status = req.body.status;
    if (typeof status !== 'string' || !VALID_SIMPLE_STATUSES.has(status)) {
      throw httpError(400, 'Status must be one of todo, in_progress, or done');
    }

    const nextStatus = await getOperationStatus(old.operation_id, status, req.user);
    if (nextStatus.status_id !== old.status_id) {
      addSet('status_id', nextStatus.status_id, '::uuid');
      statusChange = { from: old.status, to: status };
    }
  }

  if (sets.length) {
    params.push(id);
    await query(
      `UPDATE tasks SET ${sets.join(', ')}, updated_at=NOW() WHERE id = $${params.length}`,
      params
    );
  }

  if (statusChange) {
    await insertActivity({
      taskId: id,
      operationId: old.operation_id,
      userId: req.user.id,
      action: 'status_change',
      oldValue: { status: statusChange.from },
      newValue: { status: statusChange.to },
      metadata: { source: 'tasks_patch' },
    });
  }

  if (Object.keys(editChanges).length) {
    await insertActivity({
      taskId: id,
      operationId: old.operation_id,
      userId: req.user.id,
      action: 'edit',
      oldValue: null,
      newValue: editChanges,
      metadata: { source: 'tasks_patch' },
    });
  }

  const updated = await getAccessibleTask(id, req.user);
  res.json({ task: updated });
});

/**
 * GET /api/tasks/:id/time-entries
 */
const listTimeEntries = asyncHandler(async (req, res) => {
  const task = await getAccessibleTask(req.params.id, req.user);

  const entries = await query(
    `${TIME_ENTRY_SELECT}
     WHERE te.task_id = $1
     ORDER BY te.logged_at DESC, te.created_at DESC`,
    [task.id]
  );

  res.json({
    entries: entries.rows,
    total_logged_minutes: task.total_logged_minutes,
    current_user_logged_minutes: task.current_user_logged_minutes,
  });
});

/**
 * POST /api/tasks/:id/time-entries
 */
const createTimeEntry = asyncHandler(async (req, res) => {
  const task = await getAccessibleTask(req.params.id, req.user);
  const minutes = normalizeMinutes(req.body.minutes);
  const note = normalizeOptionalText(req.body.note, 'note', 2000);
  const loggedAt = normalizeLoggedAt(req.body.logged_at) || null;

  const created = await query(
    `INSERT INTO task_time_entries (task_id, user_id, minutes, note, logged_at)
     VALUES ($1,$2,$3,$4,COALESCE($5::timestamptz, NOW()))
     RETURNING id`,
    [task.id, req.user.id, minutes, note || null, loggedAt]
  );

  const entry = await getTimeEntry(task.id, created.rows[0].id);

  await insertActivity({
    taskId: task.id,
    operationId: task.operation_id,
    userId: req.user.id,
    action: 'time_add',
    newValue: { minutes, note: note || null },
    metadata: { source: 'time_entries', entry_id: entry.id },
  });

  const updatedTask = await getAccessibleTask(task.id, req.user);
  res.status(201).json({ entry, task: updatedTask });
});

/**
 * PATCH /api/tasks/:id/time-entries/:entryId
 */
const updateTimeEntry = asyncHandler(async (req, res) => {
  const task = await getAccessibleTask(req.params.id, req.user);
  const entry = await getTimeEntry(task.id, req.params.entryId);
  await requireTimeEntryOwnerOrManager(entry, task, req.user);

  const allowedFields = ['minutes', 'note', 'logged_at'];
  const providedFields = Object.keys(req.body).filter(key => allowedFields.includes(key));
  if (!providedFields.length) throw httpError(400, 'No supported time entry fields provided');

  const minutes = req.body.minutes === undefined ? entry.minutes : normalizeMinutes(req.body.minutes);
  const note = req.body.note === undefined ? entry.note : normalizeOptionalText(req.body.note, 'note', 2000);
  const loggedAt = req.body.logged_at === undefined ? entry.logged_at : normalizeLoggedAt(req.body.logged_at);

  const updated = await query(
    `UPDATE task_time_entries
     SET minutes=$1, note=$2, logged_at=$3, updated_at=NOW()
     WHERE id=$4 AND task_id=$5
     RETURNING id`,
    [minutes, note || null, loggedAt, entry.id, task.id]
  );

  const updatedEntry = await getTimeEntry(task.id, updated.rows[0].id);

  await insertActivity({
    taskId: task.id,
    operationId: task.operation_id,
    userId: req.user.id,
    action: 'time_edit',
    oldValue: { minutes: entry.minutes, note: entry.note, logged_at: entry.logged_at },
    newValue: { minutes, note: note || null, logged_at: updatedEntry.logged_at },
    metadata: { source: 'time_entries', entry_id: entry.id },
  });

  const updatedTask = await getAccessibleTask(task.id, req.user);
  res.json({ entry: updatedEntry, task: updatedTask });
});

/**
 * DELETE /api/tasks/:id/time-entries/:entryId
 */
const deleteTimeEntry = asyncHandler(async (req, res) => {
  const task = await getAccessibleTask(req.params.id, req.user);
  const entry = await getTimeEntry(task.id, req.params.entryId);
  await requireTimeEntryOwnerOrManager(entry, task, req.user);

  await query('DELETE FROM task_time_entries WHERE id=$1 AND task_id=$2', [entry.id, task.id]);

  await insertActivity({
    taskId: task.id,
    operationId: task.operation_id,
    userId: req.user.id,
    action: 'time_delete',
    oldValue: { minutes: entry.minutes, note: entry.note, logged_at: entry.logged_at },
    metadata: { source: 'time_entries', entry_id: entry.id },
  });

  const updatedTask = await getAccessibleTask(task.id, req.user);
  res.json({ success: true, task: updatedTask });
});

/**
 * PATCH /api/tasks/:id/transition
 * Move task to a new status via workflow transition
 */
const transition = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status_id } = req.body;

  if (!status_id || !UUID_RE.test(status_id)) return res.status(400).json({ error: 'status_id is required' });

  const task = await getAccessibleTask(id, req.user);

  const transitionCheck = await query(
    `SELECT id FROM transitions
     WHERE workflow_id = $1
     AND to_status_id = $2
     AND (from_status_id = $3 OR from_status_id IS NULL)`,
    [task.workflow_id, status_id, task.status_id]
  );

  if (!transitionCheck.rows.length) {
    return res.status(400).json({ error: 'Transition not allowed by workflow rules' });
  }

  const oldStatusResult = await query('SELECT name, category FROM statuses WHERE id=$1', [task.status_id]);
  const newStatusResult = await query('SELECT name, category FROM statuses WHERE id=$1', [status_id]);

  await query('UPDATE tasks SET status_id=$1, updated_at=NOW() WHERE id=$2', [status_id, id]);

  await insertActivity({
    taskId: id,
    operationId: task.operation_id,
    userId: req.user.id,
    action: 'status_change',
    oldValue: { status: oldStatusResult.rows[0]?.category || oldStatusResult.rows[0]?.name },
    newValue: { status: newStatusResult.rows[0]?.category || newStatusResult.rows[0]?.name },
    metadata: { source: 'workflow_transition' },
  });

  res.json({ success: true, status_id });
});

/**
 * DELETE /api/tasks/:id
 */
const remove = asyncHandler(async (req, res) => {
  const task = await getAccessibleTask(req.params.id, req.user);
  await requireTaskDeletePermission(task, req.user);
  await query('DELETE FROM tasks WHERE id=$1', [task.id]);
  res.json({ success: true });
});

/**
 * GET /api/operations/:operationId/workflow
 * Get workflow with statuses and allowed transitions
 */
const getWorkflow = asyncHandler(async (req, res) => {
  const { operationId } = req.params;

  const wf = await query(
    `SELECT w.* FROM workflows w WHERE w.operation_id = $1 LIMIT 1`,
    [operationId]
  );
  if (!wf.rows.length) return res.status(404).json({ error: 'No workflow found' });

  const statuses = await query(
    `SELECT * FROM statuses WHERE workflow_id=$1 ORDER BY position`,
    [wf.rows[0].id]
  );
  const transitions = await query(
    `SELECT t.*, fs.name as from_name, ts.name as to_name
     FROM transitions t
     LEFT JOIN statuses fs ON t.from_status_id = fs.id
     LEFT JOIN statuses ts ON t.to_status_id = ts.id
     WHERE t.workflow_id=$1`,
    [wf.rows[0].id]
  );

  res.json({
    workflow: wf.rows[0],
    statuses: statuses.rows,
    transitions: transitions.rows,
  });
});

module.exports = {
  listAll,
  today,
  list,
  getOne,
  createStandalone,
  create,
  update,
  patchTask,
  listTimeEntries,
  createTimeEntry,
  updateTimeEntry,
  deleteTimeEntry,
  transition,
  remove,
  getWorkflow,
};
