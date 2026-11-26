-- Mini Office AI — Neon PostgreSQL Schema
-- Supports multi-tenant organizations, future staff/delegators, SMS conversations,
-- multi-layer security scans, 4-LLM jury evaluations, boss approval queue, and audit logs.

CREATE TABLE IF NOT EXISTS organizations (
  id TEXT PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  industry TEXT NOT NULL,
  tagline TEXT NOT NULL,
  phone_number TEXT NOT NULL,
  accent_color TEXT NOT NULL,
  brand_guidelines TEXT NOT NULL,
  pricing_catalog TEXT NOT NULL,
  calendar_slots TEXT NOT NULL,
  forbidden_topics TEXT NOT NULL,
  approval_mode TEXT NOT NULL DEFAULT 'baa',
  min_jury_score INTEGER NOT NULL DEFAULT 80,
  sensitive_keywords JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  organization_id TEXT REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  role TEXT NOT NULL DEFAULT 'boss',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS chat_messages (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  org_slug TEXT NOT NULL,
  ticket_id TEXT,
  sender TEXT NOT NULL,
  text TEXT NOT NULL,
  attachments JSONB NOT NULL DEFAULT '[]'::jsonb,
  badge TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS approval_tickets (
  id TEXT PRIMARY KEY,
  ticket_code TEXT UNIQUE NOT NULL,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  org_slug TEXT NOT NULL,
  org_name TEXT NOT NULL,
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  channel TEXT NOT NULL DEFAULT 'sms_sim',
  incoming_text TEXT NOT NULL,
  attachments JSONB NOT NULL DEFAULT '[]'::jsonb,
  security_scans JSONB NOT NULL DEFAULT '[]'::jsonb,
  security_verdict TEXT NOT NULL DEFAULT 'safe',
  extracted_facts TEXT NOT NULL DEFAULT '',
  draft_reply TEXT NOT NULL DEFAULT '',
  final_reply TEXT,
  jury_verdicts JSONB NOT NULL DEFAULT '[]'::jsonb,
  avg_brand_score INTEGER NOT NULL DEFAULT 0,
  avg_context_score INTEGER NOT NULL DEFAULT 0,
  avg_overall_score INTEGER NOT NULL DEFAULT 0,
  escalation_reasons JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'processing',
  boss_note TEXT,
  attempts INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  organization_id TEXT,
  ticket_code TEXT,
  actor TEXT NOT NULL,
  action TEXT NOT NULL,
  detail TEXT NOT NULL,
  level TEXT NOT NULL DEFAULT 'info',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_messages_org_created ON chat_messages (org_slug, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tickets_status_created ON approval_tickets (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs (created_at DESC);
