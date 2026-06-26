USE jira_clone;

CREATE TABLE IF NOT EXISTS issue_attachments (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  issue_id BIGINT UNSIGNED NOT NULL,
  uploaded_by BIGINT UNSIGNED NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  mime_type VARCHAR(120) NOT NULL,
  file_size BIGINT UNSIGNED NOT NULL,
  storage_provider ENUM('local', 'r2') NOT NULL DEFAULT 'local',
  object_key VARCHAR(500) NULL,
  storage_path VARCHAR(500) NULL,
  ai_summary TEXT NULL,
  extracted_text MEDIUMTEXT NULL,
  deleted_at TIMESTAMP NULL DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_issue_attachments_issue_id (issue_id),
  INDEX idx_issue_attachments_uploaded_by (uploaded_by),
  INDEX idx_issue_attachments_deleted_at (deleted_at),
  UNIQUE KEY uq_issue_attachments_object_key (object_key),
  CONSTRAINT fk_issue_attachments_issue
    FOREIGN KEY (issue_id) REFERENCES issues(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_issue_attachments_uploaded_by
    FOREIGN KEY (uploaded_by) REFERENCES users(id)
    ON DELETE RESTRICT
);
