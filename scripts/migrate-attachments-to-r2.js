require("dotenv").config();

const fs = require("fs/promises");
const { pool } = require("../src/config/db");
const {
  storageProvider,
  uploadAttachmentObject
} = require("../src/services/storage.service");

async function migrateAttachments() {
  if (storageProvider() !== "r2") {
    throw new Error("Set STORAGE_PROVIDER=r2 before migrating local attachments");
  }

  const [attachments] = await pool.execute(
    `SELECT id, issue_id, file_name, mime_type, storage_path
     FROM issue_attachments
     WHERE storage_provider = 'local'
       AND storage_path IS NOT NULL
       AND deleted_at IS NULL
     ORDER BY id`
  );

  for (const attachment of attachments) {
    const buffer = await fs.readFile(attachment.storage_path);
    const storedObject = await uploadAttachmentObject({
      issueId: attachment.issue_id,
      fileName: attachment.file_name,
      mimeType: attachment.mime_type,
      buffer
    });

    await pool.execute(
      `UPDATE issue_attachments
       SET storage_provider = 'r2', object_key = ?, storage_path = NULL
       WHERE id = ? AND storage_provider = 'local'`,
      [storedObject.objectKey, attachment.id]
    );

    console.log(`Migrated attachment ${attachment.id}: ${attachment.file_name}`);
  }

  console.log(`Migration complete: ${attachments.length} attachment(s) moved to R2`);
}

migrateAttachments()
  .catch((error) => {
    console.error("Attachment migration failed:", error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
