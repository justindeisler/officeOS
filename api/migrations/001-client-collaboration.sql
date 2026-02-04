-- Migration: Client Collaboration Dashboard
-- Date: 2026-02-04
-- Description: Add client authentication and project access control

-- 1. Add columns to tasks table for client collaboration
ALTER TABLE tasks ADD COLUMN created_by TEXT;
ALTER TABLE tasks ADD COLUMN quick_capture BOOLEAN DEFAULT 0;
ALTER TABLE tasks ADD COLUMN ai_processed BOOLEAN DEFAULT 0;
ALTER TABLE tasks ADD COLUMN original_capture TEXT;

-- 2. Add columns to projects table for client access control
ALTER TABLE projects ADD COLUMN client_visible BOOLEAN DEFAULT 0;
ALTER TABLE projects ADD COLUMN assigned_client_ids TEXT; -- JSON array of client emails

-- 3. Add columns to clients table for authentication
ALTER TABLE clients ADD COLUMN password_hash TEXT;
ALTER TABLE clients ADD COLUMN role TEXT DEFAULT 'client';
ALTER TABLE clients ADD COLUMN last_login_at TEXT;
ALTER TABLE clients ADD COLUMN assigned_projects TEXT; -- JSON array of project IDs

-- 4. Create wellfy-lms project (if not exists)
INSERT OR IGNORE INTO projects (id, name, description, status, client_visible, assigned_client_ids, area, created_at, updated_at)
VALUES (
  'wellfy-lms',
  'Wellfy LMS',
  'Learning Management System for Wellfy',
  'active',
  1,
  '["lars@wellfy.com"]',
  'freelance',
  datetime('now'),
  datetime('now')
);
