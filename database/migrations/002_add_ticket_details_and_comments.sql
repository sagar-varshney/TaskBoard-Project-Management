USE jira_clone;

ALTER TABLE users
  MODIFY COLUMN role ENUM('member', 'developer', 'admin') NOT NULL DEFAULT 'member';

ALTER TABLE issues
  ADD COLUMN owner_id BIGINT UNSIGNED NULL AFTER assignee_id,
  ADD COLUMN resolution ENUM('unresolved', 'fixed', 'wont_fix', 'duplicate') NOT NULL DEFAULT 'unresolved' AFTER priority,
  ADD COLUMN sprint VARCHAR(120) NULL AFTER resolution,
  ADD COLUMN scrum_team VARCHAR(120) NULL AFTER sprint,
  ADD COLUMN impact TEXT NULL AFTER scrum_team,
  ADD COLUMN fix_plan TEXT NULL AFTER impact,
  ADD INDEX idx_issues_owner_id (owner_id),
  ADD CONSTRAINT fk_issues_owner
    FOREIGN KEY (owner_id) REFERENCES users(id)
    ON DELETE SET NULL;

CREATE TABLE issue_comments (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  issue_id BIGINT UNSIGNED NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  comment_text TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_issue_comments_issue_id (issue_id),
  INDEX idx_issue_comments_user_id (user_id),
  CONSTRAINT fk_issue_comments_issue
    FOREIGN KEY (issue_id) REFERENCES issues(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_issue_comments_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE RESTRICT
);

-- Promote developer users manually when needed:
-- UPDATE users SET role = 'developer' WHERE email = 'developer@example.com';
