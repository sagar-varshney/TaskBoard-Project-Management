CREATE DATABASE IF NOT EXISTS jira_clone;
USE jira_clone;

-- Stores login accounts. deleted_at enables soft delete: the row stays, but the user is treated as inactive.
CREATE TABLE IF NOT EXISTS users (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  role ENUM('member', 'developer', 'admin') NOT NULL DEFAULT 'member',
  deleted_at TIMESTAMP NULL DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_users_deleted_at (deleted_at)
);

-- Project workspaces. project_key is used to build readable ticket keys like PAY-15.
CREATE TABLE IF NOT EXISTS projects (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  project_key VARCHAR(20) NOT NULL UNIQUE,
  name VARCHAR(150) NOT NULL,
  description TEXT NULL,
  owner_id BIGINT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_projects_owner_id (owner_id),
  CONSTRAINT fk_projects_owner
    FOREIGN KEY (owner_id) REFERENCES users(id)
    ON DELETE RESTRICT
);

-- Sprint planning table. Each sprint belongs to a project.
CREATE TABLE IF NOT EXISTS sprints (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  project_id BIGINT UNSIGNED NOT NULL,
  name VARCHAR(120) NOT NULL,
  goal TEXT NULL,
  start_date DATE NULL,
  end_date DATE NULL,
  status ENUM('planned', 'active', 'completed') NOT NULL DEFAULT 'planned',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_sprints_project_name (project_id, name),
  INDEX idx_sprints_project_id (project_id),
  CONSTRAINT fk_sprints_project
    FOREIGN KEY (project_id) REFERENCES projects(id)
    ON DELETE CASCADE
);

-- Scrum teams belong to projects and can contain multiple users through scrum_team_members.
CREATE TABLE IF NOT EXISTS scrum_teams (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  project_id BIGINT UNSIGNED NOT NULL,
  name VARCHAR(120) NOT NULL,
  description TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_scrum_teams_project_name (project_id, name),
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
  issue_id BIGINT UNSIGNED NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  comment_text TEXT NOT NULL,
  is_internal BOOLEAN NOT NULL DEFAULT FALSE,
  deleted_at TIMESTAMP NULL DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_issue_comments_issue_id (issue_id),
  INDEX idx_issue_comments_user_id (user_id),
  INDEX idx_issue_comments_deleted_at (deleted_at),
  CONSTRAINT fk_issue_comments_issue
    FOREIGN KEY (issue_id) REFERENCES issues(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_issue_comments_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE RESTRICT
);

-- Ticket audit table. Stores who changed what, from which value, to which value, and when.
CREATE TABLE IF NOT EXISTS issue_activity (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  issue_id BIGINT UNSIGNED NOT NULL,
  actor_id BIGINT UNSIGNED NOT NULL,
  action VARCHAR(80) NOT NULL,
  field_name VARCHAR(80) NULL,
  old_value TEXT NULL,
  new_value TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_issue_activity_issue_id (issue_id),
  INDEX idx_issue_activity_actor_id (actor_id),
  CONSTRAINT fk_issue_activity_issue
    FOREIGN KEY (issue_id) REFERENCES issues(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_issue_activity_actor
    FOREIGN KEY (actor_id) REFERENCES users(id)
    ON DELETE RESTRICT
);
