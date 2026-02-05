-- Add threaded comments for suggestions
CREATE TABLE IF NOT EXISTS suggestion_comments (
  id TEXT PRIMARY KEY,
  suggestion_id TEXT NOT NULL,
  author TEXT NOT NULL DEFAULT 'Justin Deisler',
  comment_text TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (suggestion_id) REFERENCES suggestions(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_suggestion_comments_suggestion_id
  ON suggestion_comments(suggestion_id);
