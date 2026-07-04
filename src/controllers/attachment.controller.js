const path = require("path");
const { pool } = require("../config/db");
const AppError = require("../utils/app-error");
const { generateAttachmentInsight } = require("../services/gemini.service");
const logger = require("../utils/logger");
const {
  createPresignedPutUrl,
  readAttachmentObject,
  uploadAttachmentObject
} = require("../services/storage.service");

const maxAttachmentBytes = 8 * 1024 * 1024;
const allowedMimeTypes = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/jpeg",
  "image/png"
]);
const allowedCategories = new Set([
  "bug_evidence",
  "design_reference",
  "log_file",
  "requirement_document",
  "customer_screenshot",
  "other"
]);
const allowedExtensionsByMimeType = {
  "application/pdf": [".pdf"],
  "application/msword": [".doc"],
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
  "image/jpeg": [".jpg", ".jpeg"],
  "image/png": [".png"]
};

const attachmentSelect = `
  SELECT
    a.id, a.issue_id, a.uploaded_by, a.file_name, a.mime_type, a.file_size,
    a.category, a.tags, a.version_group_id, a.version_number,
    a.ai_summary, a.extracted_text, a.created_at, a.updated_at,
    u.email AS uploaded_by_email,
    u.first_name AS uploaded_by_first_name,
    u.last_name AS uploaded_by_last_name
  FROM issue_attachments a
  JOIN users u ON u.id = a.uploaded_by
`;

const ticketContextSelect = `
  SELECT
    i.id, i.title, i.description, i.impact, i.fix_plan,
    CONCAT(p.project_key, '-', i.id) AS ticket_key
  FROM issues i
  JOIN projects p ON p.id = i.project_id
`;

function cleanFileName(fileName) {
  return path.basename(fileName || "").replace(/[^a-zA-Z0-9._-]/g, "_");
}

function normalizeCategory(category) {
  const value = category || "other";

  if (!allowedCategories.has(value)) {
    throw new AppError("Attachment category is invalid", 400);
  }

  return value;
}

function normalizeTags(tags) {
  const value = String(tags || "")
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean)
    .slice(0, 8)
    .join(", ");

  return value || null;
}

function hasExpectedFileSignature(mimeType, buffer) {
  const hex = buffer.subarray(0, 8).toString("hex");
  const text = buffer.subarray(0, 4).toString("utf8");

  if (mimeType === "image/png") {
    return hex === "89504e470d0a1a0a";
  }

  if (mimeType === "image/jpeg") {
    return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  }

  if (mimeType === "application/pdf") {
    return text === "%PDF";
  }

  if (mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
    return text === "PK\u0003\u0004";
  }

  if (mimeType === "application/msword") {
    return hex === "d0cf11e0a1b11ae1";
  }

  return false;
}

function validateAttachmentFile({ safeFileName, mimeType, fileBuffer }) {
  if (!allowedMimeTypes.has(mimeType)) {
    throw new AppError("Attachment must be a PDF, DOC, DOCX, JPEG, or PNG file", 400);
  }

  const extension = path.extname(safeFileName).toLowerCase();
  const allowedExtensions = allowedExtensionsByMimeType[mimeType] || [];

  if (!allowedExtensions.includes(extension)) {
    throw new AppError("Attachment file extension does not match its file type", 400);
  }

  if (fileBuffer.length === 0 || fileBuffer.length > maxAttachmentBytes) {
    throw new AppError("Attachment must be between 1 byte and 8MB", 400);
  }

  if (!hasExpectedFileSignature(mimeType, fileBuffer)) {
    throw new AppError("Attachment content does not match its declared file type", 400);
  }
}

function validateAttachmentMetadata({ safeFileName, mimeType, fileSize }) {
  if (!allowedMimeTypes.has(mimeType)) {
    throw new AppError("Attachment must be a PDF, DOC, DOCX, JPEG, or PNG file", 400);
  }

  const extension = path.extname(safeFileName).toLowerCase();
  const allowedExtensions = allowedExtensionsByMimeType[mimeType] || [];

  if (!allowedExtensions.includes(extension)) {
    throw new AppError("Attachment file extension does not match its file type", 400);
  }

  if (!Number.isFinite(Number(fileSize)) || Number(fileSize) <= 0 || Number(fileSize) > maxAttachmentBytes) {
    throw new AppError("Attachment must be between 1 byte and 8MB", 400);
  }
}

async function findTicket(id) {
  const [rows] = await pool.execute(`${ticketContextSelect} WHERE i.id = ?`, [id]);
  return rows[0];
}

async function findAttachment(issueId, attachmentId) {
  const [rows] = await pool.execute(
    `${attachmentSelect}
     WHERE a.issue_id = ? AND a.id = ? AND a.deleted_at IS NULL`,
    [issueId, attachmentId]
  );

  return rows[0];
}

async function findAttachmentStorage(issueId, attachmentId) {
  const [rows] = await pool.execute(
    `SELECT storage_provider, object_key, storage_path
     FROM issue_attachments
     WHERE issue_id = ? AND id = ? AND deleted_at IS NULL`,
    [issueId, attachmentId]
  );

  return rows[0];
}

async function listIssueAttachments(req, res, next) {
  try {
    const ticket = await findTicket(req.params.id);

    if (!ticket) {
      throw new AppError("Ticket not found", 404);
    }

    const [attachments] = await pool.execute(
      `${attachmentSelect}
       WHERE a.issue_id = ? AND a.deleted_at IS NULL
       ORDER BY a.created_at DESC`,
      [req.params.id]
    );

    res.json({ attachments });
  } catch (error) {
    next(error);
  }
}

async function createIssueAttachment(req, res, next) {
  try {
    const uploadedFile = req.file;
    const {
      category,
      tags,
      replacesAttachmentId
    } = req.body;
    const ticket = await findTicket(req.params.id);

    if (!ticket) {
      throw new AppError("Ticket not found", 404);
    }

    if (!uploadedFile) {
      throw new AppError("Attachment file is required", 400);
    }

    const mimeType = uploadedFile.mimetype;
    const safeFileName = cleanFileName(uploadedFile.originalname);

    if (!safeFileName) {
      throw new AppError("fileName is required", 400);
    }

    const fileBuffer = uploadedFile.buffer;
    validateAttachmentFile({ safeFileName, mimeType, fileBuffer });
    const normalizedCategory = normalizeCategory(category);
    const normalizedTags = normalizeTags(tags);
    let versionGroupId = null;
    let versionNumber = 1;

    if (replacesAttachmentId) {
      const previousAttachment = await findAttachment(req.params.id, replacesAttachmentId);

      if (!previousAttachment) {
        throw new AppError("Previous attachment version not found", 404);
      }

      versionGroupId = previousAttachment.version_group_id || previousAttachment.id;
      const [versionRows] = await pool.execute(
        `SELECT COALESCE(MAX(version_number), 0) + 1 AS next_version_number
         FROM issue_attachments
         WHERE issue_id = ? AND version_group_id = ?`,
        [req.params.id, versionGroupId]
      );
      versionNumber = versionRows[0].next_version_number;
    }

    const storedObject = await uploadAttachmentObject({
      issueId: req.params.id,
      fileName: safeFileName,
      mimeType,
      buffer: fileBuffer
    });

    const [result] = await pool.execute(
      `INSERT INTO issue_attachments
         (issue_id, uploaded_by, file_name, mime_type, file_size, category, tags, version_group_id, version_number, storage_provider, object_key, storage_path)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        req.params.id,
        req.user.id,
        safeFileName,
        mimeType,
        fileBuffer.length,
        normalizedCategory,
        normalizedTags,
        versionGroupId,
        versionNumber,
        storedObject.storageProvider,
        storedObject.objectKey,
        storedObject.storagePath
      ]
    );
    const attachmentId = result.insertId;

    if (!versionGroupId) {
      await pool.execute(
        "UPDATE issue_attachments SET version_group_id = ? WHERE id = ?",
        [attachmentId, attachmentId]
      );
    }

    await pool.execute(
      `INSERT INTO issue_activity (issue_id, actor_id, action, field_name, new_value)
       VALUES (?, ?, 'added_attachment', 'attachment', ?)`,
      [req.params.id, req.user.id, safeFileName]
    );
    logger.audit("attachment_uploaded", req, {
      issueId: Number(req.params.id),
      attachmentId,
      fileName: safeFileName,
      mimeType,
      fileSize: fileBuffer.length,
      storageProvider: storedObject.storageProvider,
      uploadMode: "backend"
    });

    const attachment = await findAttachment(req.params.id, attachmentId);

    res.status(201).json({
      message: "Attachment uploaded",
      attachment
    });
  } catch (error) {
    next(error);
  }
}

async function createPresignedAttachmentUpload(req, res, next) {
  try {
    const {
      fileName,
      mimeType,
      fileSize,
      category,
      tags
    } = req.body;
    const ticket = await findTicket(req.params.id);

    if (!ticket) {
      throw new AppError("Ticket not found", 404);
    }

    const safeFileName = cleanFileName(fileName);

    if (!safeFileName) {
      throw new AppError("fileName is required", 400);
    }

    validateAttachmentMetadata({ safeFileName, mimeType, fileSize });
    normalizeCategory(category);
    normalizeTags(tags);

    const presignedUpload = await createPresignedPutUrl({
      issueId: req.params.id,
      fileName: safeFileName,
      mimeType
    });
    logger.audit("attachment_upload_presigned", req, {
      issueId: Number(req.params.id),
      fileName: safeFileName,
      mimeType,
      fileSize: Number(fileSize),
      objectKey: presignedUpload.objectKey
    });

    res.json({
      ...presignedUpload,
      fileName: safeFileName,
      mimeType,
      fileSize: Number(fileSize)
    });
  } catch (error) {
    next(error);
  }
}

async function completePresignedAttachmentUpload(req, res, next) {
  try {
    const {
      fileName,
      mimeType,
      fileSize,
      objectKey,
      category,
      tags,
      replacesAttachmentId
    } = req.body;
    const ticket = await findTicket(req.params.id);

    if (!ticket) {
      throw new AppError("Ticket not found", 404);
    }

    const safeFileName = cleanFileName(fileName);

    if (!safeFileName) {
      throw new AppError("fileName is required", 400);
    }

    if (!objectKey || !String(objectKey).startsWith(`tickets/${req.params.id}/`)) {
      throw new AppError("Invalid attachment object key", 400);
    }

    validateAttachmentMetadata({ safeFileName, mimeType, fileSize });
    const normalizedCategory = normalizeCategory(category);
    const normalizedTags = normalizeTags(tags);
    let versionGroupId = null;
    let versionNumber = 1;

    if (replacesAttachmentId) {
      const previousAttachment = await findAttachment(req.params.id, replacesAttachmentId);

      if (!previousAttachment) {
        throw new AppError("Previous attachment version not found", 404);
      }

      versionGroupId = previousAttachment.version_group_id || previousAttachment.id;
      const [versionRows] = await pool.execute(
        `SELECT COALESCE(MAX(version_number), 0) + 1 AS next_version_number
         FROM issue_attachments
         WHERE issue_id = ? AND version_group_id = ?`,
        [req.params.id, versionGroupId]
      );
      versionNumber = versionRows[0].next_version_number;
    }

    const [result] = await pool.execute(
      `INSERT INTO issue_attachments
         (issue_id, uploaded_by, file_name, mime_type, file_size, category, tags, version_group_id, version_number, storage_provider, object_key, storage_path)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'r2', ?, NULL)`,
      [
        req.params.id,
        req.user.id,
        safeFileName,
        mimeType,
        Number(fileSize),
        normalizedCategory,
        normalizedTags,
        versionGroupId,
        versionNumber,
        objectKey
      ]
    );
    const attachmentId = result.insertId;

    if (!versionGroupId) {
      await pool.execute(
        "UPDATE issue_attachments SET version_group_id = ? WHERE id = ?",
        [attachmentId, attachmentId]
      );
    }

    await pool.execute(
      `INSERT INTO issue_activity (issue_id, actor_id, action, field_name, new_value)
       VALUES (?, ?, 'added_attachment', 'attachment', ?)`,
      [req.params.id, req.user.id, safeFileName]
    );
    logger.audit("attachment_uploaded", req, {
      issueId: Number(req.params.id),
      attachmentId,
      fileName: safeFileName,
      mimeType,
      fileSize: Number(fileSize),
      storageProvider: "r2",
      uploadMode: "direct"
    });

    const attachment = await findAttachment(req.params.id, attachmentId);

    res.status(201).json({
      message: "Attachment uploaded",
      attachment
    });
  } catch (error) {
    next(error);
  }
}

async function downloadIssueAttachment(req, res, next) {
  try {
    const attachment = await findAttachment(req.params.id, req.params.attachmentId);

    if (!attachment) {
      throw new AppError("Attachment not found", 404);
    }

    const attachmentStorage = await findAttachmentStorage(req.params.id, req.params.attachmentId);
    const fileBuffer = await readAttachmentObject(attachmentStorage);

    res.attachment(attachment.file_name);
    res.type(attachment.mime_type);
    res.send(fileBuffer);
  } catch (error) {
    next(error);
  }
}

async function analyzeIssueAttachment(req, res, next) {
  try {
    const ticket = await findTicket(req.params.id);
    const attachment = await findAttachment(req.params.id, req.params.attachmentId);

    if (!ticket) {
      throw new AppError("Ticket not found", 404);
    }

    if (!attachment) {
      throw new AppError("Attachment not found", 404);
    }

    const attachmentStorage = await findAttachmentStorage(req.params.id, req.params.attachmentId);
    const fileBuffer = await readAttachmentObject(attachmentStorage);
    const insight = await generateAttachmentInsight({
      ticket,
      attachment,
      base64Data: fileBuffer.toString("base64"),
      prompt: req.body.prompt
    });

    await pool.execute(
      `UPDATE issue_attachments
       SET ai_summary = ?, extracted_text = ?
       WHERE id = ?`,
      [
        insight.summary || null,
        insight.extractedText || null,
        req.params.attachmentId
      ]
    );
    await pool.execute(
      `INSERT INTO issue_attachment_analyses
         (issue_id, attachment_id, analyzed_by, prompt, summary, extracted_text, suggested_action, risk_level)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        req.params.id,
        req.params.attachmentId,
        req.user.id,
        req.body.prompt || null,
        insight.summary || null,
        insight.extractedText || null,
        insight.suggestedAction || null,
        insight.riskLevel || null
      ]
    );

    await pool.execute(
      `INSERT INTO issue_activity (issue_id, actor_id, action, field_name, new_value)
       VALUES (?, ?, 'analyzed_attachment', 'attachment', ?)`,
      [req.params.id, req.user.id, attachment.file_name]
    );
    logger.audit("attachment_analyzed", req, {
      issueId: Number(req.params.id),
      attachmentId: Number(req.params.attachmentId),
      fileName: attachment.file_name,
      riskLevel: insight.riskLevel || null
    });

    res.json({
      attachmentId: attachment.id,
      ticketId: ticket.id,
      insight
    });
  } catch (error) {
    next(error);
  }
}

async function deleteIssueAttachment(req, res, next) {
  try {
    const attachment = await findAttachment(req.params.id, req.params.attachmentId);

    if (!attachment) {
      throw new AppError("Attachment not found", 404);
    }

    if (!["admin", "developer"].includes(req.user.role) && attachment.uploaded_by !== req.user.id) {
      throw new AppError("Only admins, developers, or the original uploader can delete this attachment", 403);
    }

    await pool.execute(
      "UPDATE issue_attachments SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?",
      [req.params.attachmentId]
    );
    await pool.execute(
      `INSERT INTO issue_activity (issue_id, actor_id, action, field_name, old_value)
       VALUES (?, ?, 'deleted_attachment', 'attachment', ?)`,
      [req.params.id, req.user.id, attachment.file_name]
    );
    logger.audit("attachment_deleted", req, {
      issueId: Number(req.params.id),
      attachmentId: Number(req.params.attachmentId),
      fileName: attachment.file_name
    });

    res.json({ message: "Attachment deleted" });
  } catch (error) {
    next(error);
  }
}

async function listAttachmentComments(req, res, next) {
  try {
    const attachment = await findAttachment(req.params.id, req.params.attachmentId);

    if (!attachment) {
      throw new AppError("Attachment not found", 404);
    }

    const [comments] = await pool.execute(
      `SELECT
         c.id, c.issue_id, c.attachment_id, c.user_id, c.comment_text, c.created_at, c.updated_at,
         u.email AS author_email,
         u.first_name AS author_first_name,
         u.last_name AS author_last_name
       FROM issue_attachment_comments c
       JOIN users u ON u.id = c.user_id
       WHERE c.issue_id = ? AND c.attachment_id = ? AND c.deleted_at IS NULL
       ORDER BY c.created_at ASC`,
      [req.params.id, req.params.attachmentId]
    );

    res.json({ comments });
  } catch (error) {
    next(error);
  }
}

async function createAttachmentComment(req, res, next) {
  try {
    const { commentText } = req.body;
    const attachment = await findAttachment(req.params.id, req.params.attachmentId);

    if (!attachment) {
      throw new AppError("Attachment not found", 404);
    }

    if (!commentText || !commentText.trim()) {
      throw new AppError("commentText is required", 400);
    }

    const [result] = await pool.execute(
      `INSERT INTO issue_attachment_comments (issue_id, attachment_id, user_id, comment_text)
       VALUES (?, ?, ?, ?)`,
      [req.params.id, req.params.attachmentId, req.user.id, commentText.trim()]
    );
    await pool.execute(
      `INSERT INTO issue_activity (issue_id, actor_id, action, field_name, new_value)
       VALUES (?, ?, 'added_attachment_comment', 'attachment', ?)`,
      [req.params.id, req.user.id, attachment.file_name]
    );
    logger.audit("attachment_comment_added", req, {
      issueId: Number(req.params.id),
      attachmentId: Number(req.params.attachmentId),
      commentId: result.insertId
    });

    const [comments] = await pool.execute(
      `SELECT
         c.id, c.issue_id, c.attachment_id, c.user_id, c.comment_text, c.created_at, c.updated_at,
         u.email AS author_email,
         u.first_name AS author_first_name,
         u.last_name AS author_last_name
       FROM issue_attachment_comments c
       JOIN users u ON u.id = c.user_id
       WHERE c.id = ?`,
      [result.insertId]
    );

    res.status(201).json({
      message: "Attachment comment added",
      comment: comments[0]
    });
  } catch (error) {
    next(error);
  }
}

async function listAttachmentAnalyses(req, res, next) {
  try {
    const attachment = await findAttachment(req.params.id, req.params.attachmentId);

    if (!attachment) {
      throw new AppError("Attachment not found", 404);
    }

    const [analyses] = await pool.execute(
      `SELECT
         a.id, a.issue_id, a.attachment_id, a.analyzed_by, a.prompt, a.summary,
         a.extracted_text, a.suggested_action, a.risk_level, a.created_at,
         u.email AS analyzed_by_email,
         u.first_name AS analyzed_by_first_name,
         u.last_name AS analyzed_by_last_name
       FROM issue_attachment_analyses a
       JOIN users u ON u.id = a.analyzed_by
       WHERE a.issue_id = ? AND a.attachment_id = ?
       ORDER BY a.created_at DESC`,
      [req.params.id, req.params.attachmentId]
    );

    res.json({ analyses });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  listIssueAttachments,
  createIssueAttachment,
  createPresignedAttachmentUpload,
  completePresignedAttachmentUpload,
  downloadIssueAttachment,
  analyzeIssueAttachment,
  listAttachmentAnalyses,
  listAttachmentComments,
  createAttachmentComment,
  deleteIssueAttachment
};
