USE jira_clone;

ALTER TABLE users
  ADD COLUMN role ENUM('member', 'admin') NOT NULL DEFAULT 'member' AFTER last_name,
  ADD COLUMN deleted_at TIMESTAMP NULL DEFAULT NULL AFTER role,
  ADD INDEX idx_users_deleted_at (deleted_at);

-- Promote a trusted user manually after running this migration:
-- UPDATE users SET role = 'admin' WHERE email = 'your-email@example.com';
