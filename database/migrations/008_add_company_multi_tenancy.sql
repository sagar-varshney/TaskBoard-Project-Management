CREATE TABLE IF NOT EXISTS companies (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(150) NOT NULL,
  slug VARCHAR(80) NOT NULL UNIQUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

INSERT IGNORE INTO companies (id, name, slug)
VALUES (1, 'Default Workspace', 'default-workspace');

ALTER TABLE users ADD COLUMN company_id BIGINT UNSIGNED NULL;
ALTER TABLE projects ADD COLUMN company_id BIGINT UNSIGNED NULL;
ALTER TABLE sprints ADD COLUMN company_id BIGINT UNSIGNED NULL;
ALTER TABLE scrum_teams ADD COLUMN company_id BIGINT UNSIGNED NULL;
ALTER TABLE issues ADD COLUMN company_id BIGINT UNSIGNED NULL;
ALTER TABLE issue_comments ADD COLUMN company_id BIGINT UNSIGNED NULL;
ALTER TABLE issue_attachments ADD COLUMN company_id BIGINT UNSIGNED NULL;
ALTER TABLE issue_attachment_comments ADD COLUMN company_id BIGINT UNSIGNED NULL;
ALTER TABLE issue_attachment_analyses ADD COLUMN company_id BIGINT UNSIGNED NULL;
ALTER TABLE issue_activity ADD COLUMN company_id BIGINT UNSIGNED NULL;

UPDATE users SET company_id = 1 WHERE company_id IS NULL;
UPDATE projects SET company_id = 1 WHERE company_id IS NULL;
UPDATE sprints SET company_id = 1 WHERE company_id IS NULL;
UPDATE scrum_teams SET company_id = 1 WHERE company_id IS NULL;
UPDATE issues SET company_id = 1 WHERE company_id IS NULL;
UPDATE issue_comments SET company_id = 1 WHERE company_id IS NULL;
UPDATE issue_attachments SET company_id = 1 WHERE company_id IS NULL;
UPDATE issue_attachment_comments SET company_id = 1 WHERE company_id IS NULL;
UPDATE issue_attachment_analyses SET company_id = 1 WHERE company_id IS NULL;
UPDATE issue_activity SET company_id = 1 WHERE company_id IS NULL;

CREATE INDEX idx_users_company_id ON users (company_id);
CREATE INDEX idx_projects_company_id ON projects (company_id);
CREATE INDEX idx_sprints_company_id ON sprints (company_id);
CREATE INDEX idx_scrum_teams_company_id ON scrum_teams (company_id);
CREATE INDEX idx_issues_company_id ON issues (company_id);
CREATE INDEX idx_issue_comments_company_id ON issue_comments (company_id);
CREATE INDEX idx_issue_attachments_company_id ON issue_attachments (company_id);
CREATE INDEX idx_issue_attachment_comments_company_id ON issue_attachment_comments (company_id);
CREATE INDEX idx_issue_attachment_analyses_company_id ON issue_attachment_analyses (company_id);
CREATE INDEX idx_issue_activity_company_id ON issue_activity (company_id);

ALTER TABLE projects DROP INDEX project_key;
CREATE UNIQUE INDEX uq_projects_company_key ON projects (company_id, project_key);
