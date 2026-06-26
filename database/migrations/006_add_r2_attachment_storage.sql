USE jira_clone;

ALTER TABLE issue_attachments
  ADD COLUMN storage_provider ENUM('local', 'r2') NOT NULL DEFAULT 'local' AFTER file_size,
  ADD COLUMN object_key VARCHAR(500) NULL AFTER storage_provider,
  MODIFY COLUMN storage_path VARCHAR(500) NULL,
  ADD UNIQUE KEY uq_issue_attachments_object_key (object_key);
