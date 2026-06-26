USE jira_clone;

ALTER TABLE issue_attachments
  ADD COLUMN category ENUM('bug_evidence', 'design_reference', 'log_file', 'requirement_document', 'customer_screenshot', 'other') NOT NULL DEFAULT 'other' AFTER file_size,
  ADD COLUMN tags VARCHAR(500) NULL AFTER category,
  ADD COLUMN version_group_id BIGINT UNSIGNED NULL AFTER tags,
  ADD COLUMN version_number INT UNSIGNED NOT NULL DEFAULT 1 AFTER version_group_id,
  ADD INDEX idx_issue_attachments_category (category),
  ADD INDEX idx_issue_attachments_version_group_id (version_group_id);

UPDATE issue_attachments
SET version_group_id = id
WHERE version_group_id IS NULL;

ALTER TABLE issue_attachments
  ADD CONSTRAINT fk_issue_attachments_version_group
    FOREIGN KEY (version_group_id) REFERENCES issue_attachments(id)
    ON DELETE RESTRICT;

CREATE TABLE IF NOT EXISTS issue_attachment_comments (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  issue_id BIGINT UNSIGNED NOT NULL,
  attachment_id BIGINT UNSIGNED NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  comment_text TEXT NOT NULL,
  deleted_at TIMESTAMP NULL DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_issue_attachment_comments_issue_id (issue_id),
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

CREATE TABLE IF NOT EXISTS issue_attachment_analyses (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
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
