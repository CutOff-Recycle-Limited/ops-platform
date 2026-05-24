-- ============================================================
-- SHARED NEON/POSTGRESQL DATABASE SCHEMA
-- Safe additive schema for ops-platform, cutoff-crm, and
-- cr_competitor_analysis-main.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Ops owns users, workflows, statuses, tasks, comments, time entries,
-- activity logs, and operations. Keep task linking additive for CRM and
-- competitor records.
ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS linked_entity_type VARCHAR(50),
  ADD COLUMN IF NOT EXISTS linked_entity_id VARCHAR(120);

CREATE INDEX IF NOT EXISTS idx_tasks_linked_entity
  ON tasks(linked_entity_type, linked_entity_id);

-- users.role remains the current Ops role. user_platform_roles is the
-- forward-compatible cross-platform permission bridge.
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

-- CRM-owned tables.
CREATE TABLE IF NOT EXISTS customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  phone TEXT,
  region TEXT,
  type TEXT NOT NULL DEFAULT 'lead'
    CHECK (type IN ('farmer', 'distributor', 'lead')),
  source TEXT,
  lead_score TEXT NOT NULL DEFAULT 'cold'
    CHECK (lead_score IN ('hot', 'warm', 'cold')),
  next_action_date TIMESTAMPTZ,
  next_action_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  staff_id UUID NOT NULL REFERENCES users(id),
  channel TEXT NOT NULL DEFAULT 'call'
    CHECK (channel IN ('call', 'whatsapp', 'sms', 'in_person', 'email')),
  direction TEXT NOT NULL DEFAULT 'outgoing'
    CHECK (direction IN ('incoming', 'outgoing')),
  content TEXT NOT NULL,
  outcome TEXT CHECK (outcome IN ('interested', 'not_interested', 'follow_up', 'closed')),
  duration INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ai_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  interaction_id UUID NOT NULL UNIQUE REFERENCES interactions(id) ON DELETE CASCADE,
  sentiment TEXT NOT NULL CHECK (sentiment IN ('positive', 'neutral', 'negative')),
  urgency TEXT NOT NULL CHECK (urgency IN ('low', 'medium', 'high')),
  category TEXT NOT NULL CHECK (category IN ('sales', 'support', 'logistics', 'partnership')),
  intent TEXT,
  suggested_action TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_customers_lead_score
  ON customers(lead_score);

CREATE INDEX IF NOT EXISTS idx_customers_next_action
  ON customers(next_action_date);

CREATE INDEX IF NOT EXISTS idx_customers_phone
  ON customers(phone);

CREATE INDEX IF NOT EXISTS idx_interactions_customer_id
  ON interactions(customer_id);

CREATE INDEX IF NOT EXISTS idx_interactions_staff_id
  ON interactions(staff_id);

CREATE INDEX IF NOT EXISTS idx_interactions_created_at
  ON interactions(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_insights_urgency
  ON ai_insights(urgency);

CREATE INDEX IF NOT EXISTS idx_ai_insights_category
  ON ai_insights(category);

-- Competitor-intelligence-owned tables.
CREATE TABLE IF NOT EXISTS competitors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name TEXT NOT NULL,
  location TEXT,
  fertilizer_category TEXT DEFAULT 'Unknown',
  registration_status TEXT,
  product_type TEXT,
  ingredients TEXT,
  price NUMERIC,
  distribution_channels TEXT,
  strengths TEXT,
  weaknesses TEXT,
  threat_level TEXT DEFAULT 'Medium',
  product_quality INT DEFAULT 3,
  innovation INT DEFAULT 3,
  price_competitiveness INT DEFAULT 3,
  distribution_strength INT DEFAULT 3,
  brand_strength INT DEFAULT 3,
  compliance INT DEFAULT 3,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS field_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  competitor_id UUID REFERENCES competitors(id) ON DELETE SET NULL,
  submitted_by_id UUID REFERENCES users(id) ON DELETE SET NULL,
  location TEXT NOT NULL,
  shop_visited TEXT NOT NULL,
  price_observed NUMERIC,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_competitors_company_name
  ON competitors(company_name);

CREATE INDEX IF NOT EXISTS idx_competitors_location
  ON competitors(location);

CREATE INDEX IF NOT EXISTS idx_competitors_threat_level
  ON competitors(threat_level);

CREATE INDEX IF NOT EXISTS idx_field_entries_competitor
  ON field_entries(competitor_id);

CREATE INDEX IF NOT EXISTS idx_field_entries_submitted_by
  ON field_entries(submitted_by_id);

CREATE INDEX IF NOT EXISTS idx_field_entries_created_at
  ON field_entries(created_at DESC);
