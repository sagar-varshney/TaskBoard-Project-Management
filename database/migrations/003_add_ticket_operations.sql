USE jira_clone;

CREATE TABLE sprints (
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

CREATE TABLE scrum_teams (
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

CREATE TABLE scrum_team_members (
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

ALTER TABLE issues
  ADD COLUMN sprint_id BIGINT UNSIGNED NULL AFTER owner_id,
  ADD COLUMN scrum_team_id BIGINT UNSIGNED NULL AFTER sprint_id,
  ADD INDEX idx_issues_sprint_id (sprint_id),
  ADD INDEX idx_issues_scrum_team_id (scrum_team_id),
  ADD CONSTRAINT fk_issues_sprint
    FOREIGN KEY (sprint_id) REFERENCES sprints(id)
    ON DELETE SET NULL,
  ADD CONSTRAINT fk_issues_scrum_team
    FOREIGN KEY (scrum_team_id) REFERENCES scrum_teams(id)
    ON DELETE SET NULL;

ALTER TABLE issue_comments
  ADD COLUMN is_internal BOOLEAN NOT NULL DEFAULT FALSE AFTER comment_text,
  ADD COLUMN deleted_at TIMESTAMP NULL DEFAULT NULL AFTER is_internal,
  ADD INDEX idx_issue_comments_deleted_at (deleted_at);

CREATE TABLE issue_activity (
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
