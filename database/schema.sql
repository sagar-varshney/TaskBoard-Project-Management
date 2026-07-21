CREATE DATABASE IF NOT EXISTS jira_clone;
USE jira_clone;

CREATE TABLE IF NOT EXISTS companies (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(150) NOT NULL,
  slug VARCHAR(80) NOT NULL UNIQUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Stores login accounts. deleted_at enables soft delete: the row stays, but the user is treated as inactive.
CREATE TABLE IF NOT EXISTS users (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  company_id BIGINT UNSIGNED NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  token_version INT UNSIGNED NOT NULL DEFAULT 0,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  role ENUM('member', 'developer', 'admin') NOT NULL DEFAULT 'member',
  deleted_at TIMESTAMP NULL DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_users_company_id (company_id),
  INDEX idx_users_deleted_at (deleted_at)
);

-- Project workspaces. project_key is used to build readable ticket keys like PAY-15.
CREATE TABLE IF NOT EXISTS projects (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  company_id BIGINT UNSIGNED NULL,
  project_key VARCHAR(20) NOT NULL,
  name VARCHAR(150) NOT NULL,
  description TEXT NULL,
  owner_id BIGINT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_projects_company_id (company_id),
  UNIQUE KEY uq_projects_company_key (company_id, project_key),
  INDEX idx_projects_owner_id (owner_id),
  CONSTRAINT fk_projects_owner
    FOREIGN KEY (owner_id) REFERENCES users(id)
    ON DELETE RESTRICT
);

-- Sprint planning table. Each sprint belongs to a project.
CREATE TABLE IF NOT EXISTS sprints (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  company_id BIGINT UNSIGNED NULL,
  project_id BIGINT UNSIGNED NOT NULL,
  name VARCHAR(120) NOT NULL,
  goal TEXT NULL,
  start_date DATE NULL,
  end_date DATE NULL,
  status ENUM('planned', 'active', 'completed') NOT NULL DEFAULT 'planned',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_sprints_project_name (project_id, name),
  INDEX idx_sprints_company_id (company_id),
  INDEX idx_sprints_project_id (project_id),
  CONSTRAINT fk_sprints_project
    FOREIGN KEY (project_id) REFERENCES projects(id)
    ON DELETE CASCADE
);

-- Scrum teams belong to projects and can contain multiple users through scrum_team_members.
CREATE TABLE IF NOT EXISTS scrum_teams (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  company_id BIGINT UNSIGNED NULL,
  project_id BIGINT UNSIGNED NOT NULL,
  name VARCHAR(120) NOT NULL,
  description TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_scrum_teams_project_name (project_id, name),
  INDEX idx_scrum_teams_company_id (company_id),
  INDEX idx_scrum_teams_project_id (project_id),
  CONSTRAINT fk_scrum_teams_project
    FOREIGN KEY (project_id) REFERENCES projects(id)
    ON DELETE CASCADE
);

-- Join table for many-to-many relationship: one team has many users, one user can be in many teams.
CREATE TABLE IF NOT EXISTS scrum_team_members (
  team_id BIGINT UNSIGNED NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (team_id, user_id),
  CONSTRAINT fk_scrum_team_members_team
    FOREIGN KEY (team_id) REFERENCES scrum_teams(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_scrum_team_members_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE
);

-- Main ticket table. Named issues internally because JIRA commonly calls tickets "issues".
CREATE TABLE IF NOT EXISTS issues (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  company_id BIGINT UNSIGNED NULL,
  project_id BIGINT UNSIGNED NOT NULL,
  reporter_id BIGINT UNSIGNED NOT NULL,
  assignee_id BIGINT UNSIGNED NULL,
  owner_id BIGINT UNSIGNED NULL,
  sprint_id BIGINT UNSIGNED NULL,
  scrum_team_id BIGINT UNSIGNED NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT NULL,
  issue_type ENUM('bug', 'task', 'story') NOT NULL DEFAULT 'task',
  status ENUM('todo', 'in_progress', 'done') NOT NULL DEFAULT 'todo',
  priority ENUM('low', 'medium', 'high', 'critical') NOT NULL DEFAULT 'medium',
  resolution ENUM('unresolved', 'fixed', 'wont_fix', 'duplicate') NOT NULL DEFAULT 'unresolved',
  sprint VARCHAR(120) NULL,
  scrum_team VARCHAR(120) NULL,
  impact TEXT NULL,
  fix_plan TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_issues_project_id (project_id),
  INDEX idx_issues_company_id (company_id),
  INDEX idx_issues_reporter_id (reporter_id),
  INDEX idx_issues_assignee_id (assignee_id),
  INDEX idx_issues_owner_id (owner_id),
  INDEX idx_issues_sprint_id (sprint_id),
  INDEX idx_issues_scrum_team_id (scrum_team_id),
  INDEX idx_issues_status (status),
  CONSTRAINT fk_issues_project
    FOREIGN KEY (project_id) REFERENCES projects(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_issues_reporter
    FOREIGN KEY (reporter_id) REFERENCES users(id)
    ON DELETE RESTRICT,
  CONSTRAINT fk_issues_assignee
    FOREIGN KEY (assignee_id) REFERENCES users(id)
    ON DELETE SET NULL
  ,
  CONSTRAINT fk_issues_owner
    FOREIGN KEY (owner_id) REFERENCES users(id)
    ON DELETE SET NULL
  ,
  CONSTRAINT fk_issues_sprint
    FOREIGN KEY (sprint_id) REFERENCES sprints(id)
    ON DELETE SET NULL,
  CONSTRAINT fk_issues_scrum_team
    FOREIGN KEY (scrum_team_id) REFERENCES scrum_teams(id)
    ON DELETE SET NULL
);

-- Ticket comments. deleted_at is comment-level soft delete.
CREATE TABLE IF NOT EXISTS issue_comments (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  company_id BIGINT UNSIGNED NULL,
  issue_id BIGINT UNSIGNED NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  comment_text TEXT NOT NULL,
  is_internal BOOLEAN NOT NULL DEFAULT FALSE,
  deleted_at TIMESTAMP NULL DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_issue_comments_issue_id (issue_id),
  INDEX idx_issue_comments_company_id (company_id),
  INDEX idx_issue_comments_user_id (user_id),
  INDEX idx_issue_comments_deleted_at (deleted_at),
  CONSTRAINT fk_issue_comments_issue
    FOREIGN KEY (issue_id) REFERENCES issues(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_issue_comments_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE RESTRICT
);

-- Files attached to tickets. storage_path points to the local uploads folder; deleted_at enables soft delete.
CREATE TABLE IF NOT EXISTS issue_attachments (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  company_id BIGINT UNSIGNED NULL,
  issue_id BIGINT UNSIGNED NOT NULL,
  uploaded_by BIGINT UNSIGNED NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  mime_type VARCHAR(120) NOT NULL,
  file_size BIGINT UNSIGNED NOT NULL,
  category ENUM('bug_evidence', 'design_reference', 'log_file', 'requirement_document', 'customer_screenshot', 'other') NOT NULL DEFAULT 'other',
  tags VARCHAR(500) NULL,
  version_group_id BIGINT UNSIGNED NULL,
  version_number INT UNSIGNED NOT NULL DEFAULT 1,
  storage_provider ENUM('local', 'r2') NOT NULL DEFAULT 'local',
  object_key VARCHAR(500) NULL,
  storage_path VARCHAR(500) NULL,
  ai_summary TEXT NULL,
  extracted_text MEDIUMTEXT NULL,
  deleted_at TIMESTAMP NULL DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_issue_attachments_issue_id (issue_id),
  INDEX idx_issue_attachments_company_id (company_id),
  INDEX idx_issue_attachments_uploaded_by (uploaded_by),
  INDEX idx_issue_attachments_deleted_at (deleted_at),
  INDEX idx_issue_attachments_category (category),
  INDEX idx_issue_attachments_version_group_id (version_group_id),
  UNIQUE KEY uq_issue_attachments_object_key (object_key),
  CONSTRAINT fk_issue_attachments_issue
    FOREIGN KEY (issue_id) REFERENCES issues(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_issue_attachments_uploaded_by
    FOREIGN KEY (uploaded_by) REFERENCES users(id)
    ON DELETE RESTRICT,
  CONSTRAINT fk_issue_attachments_version_group
    FOREIGN KEY (version_group_id) REFERENCES issue_attachments(id)
    ON DELETE RESTRICT
);

-- Comments tied to a specific attachment, separate from general ticket comments.
CREATE TABLE IF NOT EXISTS issue_attachment_comments (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  company_id BIGINT UNSIGNED NULL,
  issue_id BIGINT UNSIGNED NOT NULL,
  attachment_id BIGINT UNSIGNED NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  comment_text TEXT NOT NULL,
  deleted_at TIMESTAMP NULL DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_issue_attachment_comments_issue_id (issue_id),
  INDEX idx_issue_attachment_comments_company_id (company_id),
  INDEX idx_issue_attachment_comments_attachment_id (attachment_id),
  INDEX idx_issue_attachment_comments_user_id (user_id),
  INDEX idx_issue_attachment_comments_deleted_at (deleted_at),
  CONSTRAINT fk_issue_attachment_comments_issue
    FOREIGN KEY (issue_id) REFERENCES issues(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_issue_attachment_comments_attachment
    FOREIGN KEY (attachment_id) REFERENCES issue_attachments(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_issue_attachment_comments_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE RESTRICT
);

-- Stores every AI analysis run instead of only keeping the latest summary on the attachment row.
CREATE TABLE IF NOT EXISTS issue_attachment_analyses (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  company_id BIGINT UNSIGNED NULL,
  issue_id BIGINT UNSIGNED NOT NULL,
  attachment_id BIGINT UNSIGNED NOT NULL,
  analyzed_by BIGINT UNSIGNED NOT NULL,
  prompt TEXT NULL,
  summary TEXT NULL,
  extracted_text MEDIUMTEXT NULL,
  suggested_action TEXT NULL,
  risk_level VARCHAR(40) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_issue_attachment_analyses_issue_id (issue_id),
  INDEX idx_issue_attachment_analyses_company_id (company_id),
  INDEX idx_issue_attachment_analyses_attachment_id (attachment_id),
  INDEX idx_issue_attachment_analyses_analyzed_by (analyzed_by),
  CONSTRAINT fk_issue_attachment_analyses_issue
    FOREIGN KEY (issue_id) REFERENCES issues(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_issue_attachment_analyses_attachment
    FOREIGN KEY (attachment_id) REFERENCES issue_attachments(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_issue_attachment_analyses_user
    FOREIGN KEY (analyzed_by) REFERENCES users(id)
    ON DELETE RESTRICT
);

-- Ticket audit table. Stores who changed what, from which value, to which value, and when.
CREATE TABLE IF NOT EXISTS issue_activity (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  company_id BIGINT UNSIGNED NULL,
  issue_id BIGINT UNSIGNED NOT NULL,
  actor_id BIGINT UNSIGNED NOT NULL,
  action VARCHAR(80) NOT NULL,
  field_name VARCHAR(80) NULL,
  old_value TEXT NULL,
  new_value TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_issue_activity_issue_id (issue_id),
  INDEX idx_issue_activity_company_id (company_id),
  INDEX idx_issue_activity_actor_id (actor_id),
  CONSTRAINT fk_issue_activity_issue
    FOREIGN KEY (issue_id) REFERENCES issues(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_issue_activity_actor
    FOREIGN KEY (actor_id) REFERENCES users(id)
    ON DELETE RESTRICT
);
