-- Add codebase_path and github_repo to projects for access detection
-- codebase_path: local filesystem path (e.g., ~/projects/personal-assistant)
-- github_repo: GitHub owner/repo (e.g., justindeisler/personal-assistant)

ALTER TABLE projects ADD COLUMN codebase_path TEXT;
ALTER TABLE projects ADD COLUMN github_repo TEXT;

-- Add suggestion_id to prds for linking PRDs back to suggestions
ALTER TABLE prds ADD COLUMN suggestion_id TEXT REFERENCES suggestions(id);

-- Populate known project paths
UPDATE projects SET codebase_path = '~/projects/personal-assistant' WHERE id = '32b4b44b-a6f9-46c1-bc56-0ec819d766a1';
UPDATE projects SET codebase_path = '~/projects/wellfy' WHERE id = '974c45ac-82f0-4e66-9403-94071d9da454';
UPDATE projects SET codebase_path = '~/projects/backend-diabetesnotes' WHERE id = 'aba3c4c3-cdaa-466c-a7f3-210f70dbb852';
UPDATE projects SET codebase_path = '~/projects/dot1' WHERE id = '022d19f7-e15d-4c65-ba85-528033ab5d44';
UPDATE projects SET codebase_path = '~/projects/supplement-webshop' WHERE id = '6fa57ff7-547a-48b7-bff9-cf27c333fc82';
UPDATE projects SET codebase_path = '~/projects/wellfy' WHERE id = 'wellfy-lms';
