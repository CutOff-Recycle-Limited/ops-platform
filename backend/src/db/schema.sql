-- ============================================================
-- OPS PLATFORM - PostgreSQL Schema
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- USERS
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(20) NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'manager', 'member')),
  avatar_color VARCHAR(7) DEFAULT '#6366f1',
  disabled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- OPERATIONS (Projects)
CREATE TABLE IF NOT EXISTS operations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  description TEXT,
  key VARCHAR(10) UNIQUE NOT NULL,  -- e.g., "OPS", "MKT"
  owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  color VARCHAR(7) DEFAULT '#6366f1',
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'archived', 'completed')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_operations_owner ON operations(owner_id);
CREATE INDEX IF NOT EXISTS idx_operations_key ON operations(key);

-- OPERATION MEMBERS
CREATE TABLE IF NOT EXISTS operation_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operation_id UUID NOT NULL REFERENCES operations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL DEFAULT 'member' CHECK (role IN ('manager', 'member')),
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(operation_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_op_members_operation ON operation_members(operation_id);
CREATE INDEX IF NOT EXISTS idx_op_members_user ON operation_members(user_id);

-- WORKFLOWS
CREATE TABLE IF NOT EXISTS workflows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operation_id UUID NOT NULL REFERENCES operations(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL DEFAULT 'Default Workflow',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_workflows_operation ON workflows(operation_id);

-- WORKFLOW STATUSES
CREATE TABLE IF NOT EXISTS statuses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
  name VARCHAR(50) NOT NULL,
  color VARCHAR(7) DEFAULT '#6b7280',
  position INTEGER NOT NULL DEFAULT 0,
  category VARCHAR(20) DEFAULT 'in_progress' CHECK (category IN ('todo', 'in_progress', 'done')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_statuses_workflow ON statuses(workflow_id);

-- WORKFLOW TRANSITIONS (which status can move to which)
CREATE TABLE IF NOT EXISTS transitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
  from_status_id UUID REFERENCES statuses(id) ON DELETE CASCADE,  -- NULL = any status
  to_status_id UUID NOT NULL REFERENCES statuses(id) ON DELETE CASCADE,
  name VARCHAR(100),
  UNIQUE(workflow_id, from_status_id, to_status_id)
);

CREATE INDEX IF NOT EXISTS idx_transitions_workflow ON transitions(workflow_id);
CREATE INDEX IF NOT EXISTS idx_transitions_from ON transitions(from_status_id);

-- TASKS
CREATE TABLE IF NOT EXISTS tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operation_id UUID NOT NULL REFERENCES operations(id) ON DELETE CASCADE,
  workflow_id UUID NOT NULL REFERENCES workflows(id),
  status_id UUID NOT NULL REFERENCES statuses(id),
  parent_id UUID REFERENCES tasks(id) ON DELETE SET NULL,  -- for subtasks
  title VARCHAR(255) NOT NULL,
  description TEXT,
  type VARCHAR(20) DEFAULT 'task' CHECK (type IN ('task', 'epic', 'subtask')),
  priority VARCHAR(20) DEFAULT 'medium' CHECK (priority IN ('critical', 'high', 'medium', 'low')),
  assignee_id UUID REFERENCES users(id) ON DELETE SET NULL,
  reporter_id UUID NOT NULL REFERENCES users(id),
  created_by_id UUID REFERENCES users(id) ON DELETE SET NULL,
  due_date DATE,
  linked_entity_type VARCHAR(50),
  linked_entity_id VARCHAR(120),
  task_number INTEGER,  -- sequential per operation
  position FLOAT DEFAULT 0,  -- for ordering within columns
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tasks_operation ON tasks(operation_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status_id);
CREATE INDEX IF NOT EXISTS idx_tasks_assignee ON tasks(assignee_id);
CREATE INDEX IF NOT EXISTS idx_tasks_parent ON tasks(parent_id);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date);

-- COMMENTS
CREATE TABLE IF NOT EXISTS comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  edited BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_comments_task ON comments(task_id);

-- TASK TIME ENTRIES
CREATE TABLE IF NOT EXISTS task_time_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  minutes INTEGER NOT NULL CHECK (minutes > 0),
  note TEXT,
  logged_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_task_time_entries_task ON task_time_entries(task_id);
CREATE INDEX IF NOT EXISTS idx_task_time_entries_user ON task_time_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_task_time_entries_logged_at ON task_time_entries(logged_at DESC);

-- ACTIVITY LOGS
CREATE TABLE IF NOT EXISTS activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  operation_id UUID NOT NULL REFERENCES operations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action VARCHAR(50) NOT NULL,  -- 'status_change', 'comment', 'edit', 'create', 'assign', 'time_add', 'time_edit', 'time_delete'
  old_value JSONB,
  new_value JSONB,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_activity_task ON activity_logs(task_id);
CREATE INDEX IF NOT EXISTS idx_activity_operation ON activity_logs(operation_id);
CREATE INDEX IF NOT EXISTS idx_activity_created ON activity_logs(created_at DESC);

-- PASSWORD RESET TOKENS
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token VARCHAR(64) UNIQUE NOT NULL,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  used BOOLEAN DEFAULT false,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '1 hour',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_prt_token ON password_reset_tokens(token);
CREATE INDEX IF NOT EXISTS idx_prt_user ON password_reset_tokens(user_id);

-- CROSS-PLATFORM ROLES
-- users.role remains the current Ops role. This table is an additive
-- permission bridge for CRM and competitor intelligence access.
CREATE TABLE IF NOT EXISTS user_platform_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  platform VARCHAR(50) NOT NULL CHECK (
    platform IN ('ops', 'crm', 'competitor_intel')
  ),
  role VARCHAR(50) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, platform)
);

CREATE INDEX IF NOT EXISTS idx_user_platform_roles_user
  ON user_platform_roles(user_id);

CREATE INDEX IF NOT EXISTS idx_user_platform_roles_platform
  ON user_platform_roles(platform);
