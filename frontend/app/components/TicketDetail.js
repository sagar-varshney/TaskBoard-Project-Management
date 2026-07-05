"use client";

import { useEffect, useRef, useState } from "react";
import ThemeToggle from "./ThemeToggle";

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:5001/api";
const statusOptions = [
  { value: "todo", label: "To do" },
  { value: "in_progress", label: "In progress" },
  { value: "done", label: "Done" }
];
const priorityOptions = ["low", "medium", "high", "critical"];
const typeOptions = ["bug", "task", "story"];
const resolutionOptions = ["unresolved", "fixed", "wont_fix", "duplicate"];
const attachmentAccept = ".pdf,.doc,.docx,.jpg,.jpeg,.png";
const previewFileTypes = new Set(["application/pdf", "image/jpeg", "image/png"]);
const attachmentCategoryOptions = [
  { value: "bug_evidence", label: "Bug evidence" },
  { value: "design_reference", label: "Design reference" },
  { value: "log_file", label: "Log file" },
  { value: "requirement_document", label: "Requirement document" },
  { value: "customer_screenshot", label: "Customer screenshot" },
  { value: "other", label: "Other" }
];

function displayNameParts(firstName, lastName, fallback = "Unnamed user") {
  return `${firstName || ""} ${lastName || ""}`.trim() || fallback;
}

function ticketTitle(ticket) {
  return ticket.title?.trim() || "Untitled ticket";
}

function badgeClass(prefix, value) {
  return `badge ${prefix}-${String(value || "unset").replaceAll("_", "-")}`;
}

function formatDate(value) {
  // Converts database timestamps into readable local date/time strings.
  if (!value) {
    return "Not set";
  }

  return new Date(value).toLocaleString();
}

function emptyEditForm() {
  // One form object powers both admin metadata edits and work-progress edits.
  return {
    title: "",
    issueType: "task",
    status: "todo",
    priority: "medium",
    resolution: "unresolved",
    assigneeId: "",
    ownerId: "",
    sprintId: "",
    scrumTeamId: "",
    sprint: "",
    scrumTeam: "",
    impact: "",
    fixPlan: "",
    description: ""
  };
}

export default function TicketDetail({ ticketId }) {
  // Ticket detail pulls together ticket fields, comments, activity, and permission state.
  const [ticket, setTicket] = useState(null);
  const [users, setUsers] = useState([]);
  const [sprints, setSprints] = useState([]);
  const [teams, setTeams] = useState([]);
  const [comments, setComments] = useState([]);
  const [attachments, setAttachments] = useState([]);
  const [activity, setActivity] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [editForm, setEditForm] = useState(emptyEditForm());
  const [attachmentFile, setAttachmentFile] = useState(null);
  const [attachmentCategory, setAttachmentCategory] = useState("bug_evidence");
  const [attachmentTags, setAttachmentTags] = useState("");
  const [replacesAttachmentId, setReplacesAttachmentId] = useState("");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [attachmentPrompt, setAttachmentPrompt] = useState("");
  const [attachmentInsights, setAttachmentInsights] = useState({});
  const [attachmentPreviewUrls, setAttachmentPreviewUrls] = useState({});
  const [attachmentComments, setAttachmentComments] = useState({});
  const [attachmentCommentDrafts, setAttachmentCommentDrafts] = useState({});
  const [attachmentAnalyses, setAttachmentAnalyses] = useState({});
  const [commentText, setCommentText] = useState("");
  const [isInternalComment, setIsInternalComment] = useState(false);
  const [editingCommentId, setEditingCommentId] = useState(null);
  const [editingCommentText, setEditingCommentText] = useState("");
  const [editingCommentInternal, setEditingCommentInternal] = useState(false);
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const attachmentPreviewUrlsRef = useRef({});

  useEffect(() => {
    loadTicket();
  }, [ticketId]);

  useEffect(() => {
    return () => {
      Object.values(attachmentPreviewUrlsRef.current).forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);

  async function apiRequest(path, options = {}) {
    // Same API helper pattern as Dashboard: attach token, parse JSON, throw readable errors.
    const token = localStorage.getItem("jiraCloneToken");
    const isFormData = options.body instanceof FormData;

    if (!token) {
      throw new Error("Your login session is missing. Return to the dashboard and log in again.");
    }

    const response = await fetch(`${apiBaseUrl}${path}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(isFormData ? {} : { "Content-Type": "application/json" }),
        ...options.headers
      }
    });
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || "Request failed");
    }

    return data;
  }

  function syncEditForm(nextTicket) {
    // Converts database snake_case fields into frontend camelCase form fields.
    setEditForm({
      title: nextTicket.title || "",
      issueType: nextTicket.issue_type || "task",
      status: nextTicket.status || "todo",
      priority: nextTicket.priority || "medium",
      resolution: nextTicket.resolution || "unresolved",
      assigneeId: nextTicket.assignee_id ? String(nextTicket.assignee_id) : "",
      ownerId: nextTicket.owner_id ? String(nextTicket.owner_id) : "",
      sprintId: nextTicket.sprint_id ? String(nextTicket.sprint_id) : "",
      scrumTeamId: nextTicket.scrum_team_id ? String(nextTicket.scrum_team_id) : "",
      sprint: nextTicket.sprint || "",
      scrumTeam: nextTicket.scrum_team || "",
      impact: nextTicket.impact || "",
      fixPlan: nextTicket.fix_plan || "",
      description: nextTicket.description || ""
    });
  }

  function canPreviewAttachment(attachment) {
    return previewFileTypes.has(attachment.mime_type);
  }

  async function loadAttachmentPreviews(nextAttachments) {
    const token = localStorage.getItem("jiraCloneToken");
    const imageAttachments = nextAttachments.filter(canPreviewAttachment);

    if (!token || imageAttachments.length === 0) {
      setAttachmentPreviewUrls((current) => {
        Object.values(current).forEach((url) => URL.revokeObjectURL(url));
        attachmentPreviewUrlsRef.current = {};
        return {};
      });
      return;
    }

    const previewEntries = await Promise.all(
      imageAttachments.map(async (attachment) => {
        const response = await fetch(`${apiBaseUrl}/tickets/${ticketId}/attachments/${attachment.id}/download`, {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });

        if (!response.ok) {
          return null;
        }

        const blob = await response.blob();
        return [attachment.id, URL.createObjectURL(blob)];
      })
    );
    const nextPreviewUrls = Object.fromEntries(previewEntries.filter(Boolean));

    setAttachmentPreviewUrls((current) => {
      Object.values(current).forEach((url) => URL.revokeObjectURL(url));
      attachmentPreviewUrlsRef.current = nextPreviewUrls;
      return nextPreviewUrls;
    });
  }

  async function loadAttachmentCollaboration(nextAttachments) {
    const entries = await Promise.all(
      nextAttachments.map(async (attachment) => {
        const [commentData, analysisData] = await Promise.all([
          apiRequest(`/tickets/${ticketId}/attachments/${attachment.id}/comments`),
          apiRequest(`/tickets/${ticketId}/attachments/${attachment.id}/analyses`)
        ]);

        return [attachment.id, commentData.comments, analysisData.analyses];
      })
    );

    setAttachmentComments(
      Object.fromEntries(entries.map(([attachmentId, comments]) => [attachmentId, comments]))
    );
    setAttachmentAnalyses(
      Object.fromEntries(entries.map(([attachmentId, comments, analyses]) => [attachmentId, analyses]))
    );
  }

  async function loadTicket() {
    setIsLoading(true);
    setMessage("");

    try {
      const [profileData, ticketData, commentData, attachmentData, activityData, userData, sprintData, teamData] = await Promise.all([
        // These resources are independent, so they can load at the same time.
        apiRequest("/auth/me"),
        apiRequest(`/tickets/${ticketId}`),
        apiRequest(`/tickets/${ticketId}/comments`),
        apiRequest(`/tickets/${ticketId}/attachments`),
        apiRequest(`/tickets/${ticketId}/activity`),
        apiRequest("/users"),
        apiRequest("/sprints"),
        apiRequest("/teams")
      ]);

      setCurrentUser(profileData.user);
      setTicket(ticketData.ticket);
      setComments(commentData.comments);
      setAttachments(attachmentData.attachments);
      await loadAttachmentPreviews(attachmentData.attachments);
      await loadAttachmentCollaboration(attachmentData.attachments);
      setActivity(activityData.activity);
      setUsers(userData.users);
      setSprints(sprintData.sprints);
      setTeams(teamData.teams);
      syncEditForm(ticketData.ticket);
    } catch (error) {
      setMessage(error.message);
    } finally {
      setIsLoading(false);
    }
  }

  async function uploadAttachment(event) {
    event.preventDefault();
    setMessage("");
    setUploadProgress(0);

    if (!attachmentFile) {
      setMessage("Choose a file before uploading.");
      return;
    }

    try {
      const data = await uploadAttachmentDirectToR2();

      setAttachments((current) => [data.attachment, ...current]);
      setAttachmentFile(null);
      setAttachmentTags("");
      setReplacesAttachmentId("");
      setUploadProgress(0);
      await loadTicket();
      setMessage("Attachment uploaded.");
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function uploadAttachmentDirectToR2() {
    try {
      setUploadProgress(2);
      const presignData = await apiRequest(`/tickets/${ticketId}/attachments/presign`, {
        method: "POST",
        body: JSON.stringify({
          fileName: attachmentFile.name,
          mimeType: attachmentFile.type,
          fileSize: attachmentFile.size,
          category: attachmentCategory,
          tags: attachmentTags,
          replacesAttachmentId: replacesAttachmentId || undefined
        })
      });

      await uploadFileToPresignedUrl(presignData.uploadUrl, attachmentFile);
      setUploadProgress(95);

      return apiRequest(`/tickets/${ticketId}/attachments/complete`, {
        method: "POST",
        body: JSON.stringify({
          fileName: presignData.fileName,
          mimeType: presignData.mimeType,
          fileSize: presignData.fileSize,
          objectKey: presignData.objectKey,
          category: attachmentCategory,
          tags: attachmentTags,
          replacesAttachmentId: replacesAttachmentId || undefined
        })
      });
    } catch (error) {
      if (error.message.includes("Direct uploads require R2") || error.message.includes("Failed to fetch")) {
        return uploadAttachmentViaBackend();
      }

      throw error;
    }
  }

  function uploadFileToPresignedUrl(uploadUrl, file) {
    return new Promise((resolve, reject) => {
      const request = new XMLHttpRequest();

      request.open("PUT", uploadUrl);
      request.setRequestHeader("Content-Type", file.type);
      request.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          setUploadProgress(Math.max(2, Math.min(94, Math.round((event.loaded / event.total) * 92))));
        }
      };
      request.onload = () => {
        if (request.status >= 200 && request.status < 300) {
          resolve();
          return;
        }

        reject(new Error("Direct R2 upload failed"));
      };
      request.onerror = () => reject(new Error("Failed to fetch"));
      request.send(file);
    });
  }

  function uploadAttachmentViaBackend() {
    const formData = new FormData();
    formData.append("attachment", attachmentFile);
    formData.append("category", attachmentCategory);
    formData.append("tags", attachmentTags);

    if (replacesAttachmentId) {
      formData.append("replacesAttachmentId", replacesAttachmentId);
    }

    return uploadAttachmentWithProgress(formData);
  }

  function uploadAttachmentWithProgress(formData) {
    return new Promise((resolve, reject) => {
      const token = localStorage.getItem("jiraCloneToken");
      const request = new XMLHttpRequest();

      request.open("POST", `${apiBaseUrl}/tickets/${ticketId}/attachments`);
      request.setRequestHeader("Authorization", `Bearer ${token}`);
      request.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          setUploadProgress(Math.round((event.loaded / event.total) * 100));
        }
      };
      request.onload = () => {
        const data = JSON.parse(request.responseText || "{}");

        if (request.status >= 200 && request.status < 300) {
          resolve(data);
          return;
        }

        reject(new Error(data.message || "Upload failed"));
      };
      request.onerror = () => reject(new Error("Upload failed"));
      request.send(formData);
    });
  }

  async function analyzeAttachment(attachmentId) {
    setMessage("");

    try {
      const data = await apiRequest(`/tickets/${ticketId}/attachments/${attachmentId}/analyze`, {
        method: "POST",
        body: JSON.stringify({ prompt: attachmentPrompt })
      });

      setAttachmentInsights((current) => ({
        ...current,
        [attachmentId]: data.insight
      }));
      await loadTicket();
      setMessage("Attachment analyzed.");
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function addAttachmentComment(event, attachmentId) {
    event.preventDefault();
    setMessage("");

    try {
      const draft = attachmentCommentDrafts[attachmentId] || "";
      const data = await apiRequest(`/tickets/${ticketId}/attachments/${attachmentId}/comments`, {
        method: "POST",
        body: JSON.stringify({ commentText: draft })
      });

      setAttachmentComments((current) => ({
        ...current,
        [attachmentId]: [...(current[attachmentId] || []), data.comment]
      }));
      setAttachmentCommentDrafts((current) => ({
        ...current,
        [attachmentId]: ""
      }));
      setMessage("Attachment comment added.");
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function downloadAttachment(attachment) {
    setMessage("");

    try {
      const token = localStorage.getItem("jiraCloneToken");
      const response = await fetch(`${apiBaseUrl}/tickets/${ticketId}/attachments/${attachment.id}/download`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || "Download failed");
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = attachment.file_name;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function deleteAttachment(attachmentId) {
    setMessage("");

    try {
      await apiRequest(`/tickets/${ticketId}/attachments/${attachmentId}`, {
        method: "DELETE"
      });
      setAttachments((current) => current.filter((attachment) => attachment.id !== attachmentId));
      await loadTicket();
      setMessage("Attachment deleted.");
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function updateTicket(payload) {
    const data = await apiRequest(`/tickets/${ticketId}`, {
      method: "PATCH",
      body: JSON.stringify(payload)
    });

    setTicket(data.ticket);
    syncEditForm(data.ticket);
  }

  async function updateAdminDetails(event) {
    event.preventDefault();
    setMessage("");

    try {
      await updateTicket({
        // Admin-only metadata: planning, delegation, impact, and description.
        title: editForm.title,
        issueType: editForm.issueType,
        priority: editForm.priority,
        assigneeId: editForm.assigneeId,
        ownerId: editForm.ownerId,
        sprintId: editForm.sprintId,
        scrumTeamId: editForm.scrumTeamId,
        sprint: editForm.sprint,
        scrumTeam: editForm.scrumTeam,
        impact: editForm.impact,
        description: editForm.description
      });
      setMessage("Ticket metadata updated.");
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function updateWorkDetails(event) {
    event.preventDefault();
    setMessage("");

    try {
      await updateTicket({
        // Work fields: available to admins, developers, and delegated members.
        status: editForm.status,
        resolution: editForm.resolution,
        fixPlan: editForm.fixPlan
      });
      setMessage("Ticket work update saved.");
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function addComment(event) {
    event.preventDefault();
    setMessage("");

    try {
      const canManageInternalComments = ["admin", "developer"].includes(currentUser?.role);
      const data = await apiRequest(`/tickets/${ticketId}/comments`, {
        method: "POST",
        body: JSON.stringify({
          commentText,
          isInternal: canManageInternalComments ? isInternalComment : false
        })
      });

      setComments((current) => [...current, data.comment]);
      setCommentText("");
      setIsInternalComment(false);
      await loadTicket();
      setMessage("Comment added.");
    } catch (error) {
      setMessage(error.message);
    }
  }

  function startEditingComment(comment) {
    setEditingCommentId(comment.id);
    setEditingCommentText(comment.comment_text);
    setEditingCommentInternal(Boolean(comment.is_internal));
  }

  function cancelEditingComment() {
    setEditingCommentId(null);
    setEditingCommentText("");
    setEditingCommentInternal(false);
  }

  async function updateComment(commentId) {
    setMessage("");

    try {
      const canManageInternalComments = ["admin", "developer"].includes(currentUser?.role);
      const data = await apiRequest(`/tickets/${ticketId}/comments/${commentId}`, {
        method: "PATCH",
        body: JSON.stringify({
          commentText: editingCommentText,
          isInternal: canManageInternalComments ? editingCommentInternal : false
        })
      });

      setComments((current) =>
        current.map((comment) => (comment.id === commentId ? data.comment : comment))
      );
      cancelEditingComment();
      await loadTicket();
      setMessage("Comment updated.");
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function deleteComment(commentId) {
    setMessage("");

    try {
      await apiRequest(`/tickets/${ticketId}/comments/${commentId}`, {
        method: "DELETE"
      });
      setComments((current) => current.filter((comment) => comment.id !== commentId));
      await loadTicket();
      setMessage("Comment deleted.");
    } catch (error) {
      setMessage(error.message);
    }
  }

  const isAdmin = currentUser?.role === "admin";
  const canManageInternalComments = ["admin", "developer"].includes(currentUser?.role);
  const isDelegatedUser =
    // Developers can update work; members can update work only when assigned/owner.
    currentUser?.role === "developer" ||
    ticket?.assignee_id === currentUser?.id ||
    ticket?.owner_id === currentUser?.id;
  const canUpdateWork = isAdmin || isDelegatedUser;
  const projectSprints = sprints.filter((sprint) => sprint.project_id === ticket?.project_id);
  const projectTeams = teams.filter((team) => team.project_id === ticket?.project_id);

  if (isLoading) {
    return (
      <main className="ticket-detail-shell">
        <section className="loading-panel">
          <div className="skeleton-line wide" />
          <div className="skeleton-line" />
          <div className="skeleton-grid">
            <span />
            <span />
            <span />
          </div>
        </section>
      </main>
    );
  }

  if (!ticket) {
    return (
      <main className="ticket-detail-shell">
        <p className="dashboard-message">{message || "Ticket not found"}</p>
        <a className="secondary-action compact-link" href="/" target="_self">Return to login</a>
      </main>
    );
  }

  return (
    <main className="ticket-detail-shell">
      <header className="ticket-detail-header">
        <div>
          <p className="dashboard-eyebrow">{ticket.project_key}</p>
          <h1>{ticket.ticket_key}: {ticketTitle(ticket)}</h1>
          <div className="ticket-hero-meta">
            <span className={badgeClass("status", ticket.status)}>{ticket.status}</span>
            <span className={badgeClass("priority", ticket.priority)}>{ticket.priority}</span>
            <span className={badgeClass("type", ticket.issue_type)}>{ticket.issue_type}</span>
          </div>
        </div>
        <div className="header-actions">
          <ThemeToggle />
          <a className="secondary-action compact-link" href="/" target="_self">Back to dashboard</a>
        </div>
      </header>

      {message ? <p className="dashboard-message">{message}</p> : null}

      <section className="ticket-detail-grid">
        <section className="ticket-main-panel">
          <section className="content-section">
            <h2>Description</h2>
            <p>{ticket.description || "No description provided."}</p>
          </section>

          <div className="content-two-up">
            <section className="content-section">
              <h2>Impact</h2>
              <p>{ticket.impact || "No impact recorded."}</p>
            </section>

            <section className="content-section">
              <h2>Fix plan</h2>
              <p>{ticket.fix_plan || "No fix plan recorded yet."}</p>
            </section>
          </div>

          <section className="attachments-panel">
            <div className="section-heading-row">
              <div>
                <p className="dashboard-eyebrow">Evidence and analysis</p>
                <h2>Attachments</h2>
              </div>
              <span>{attachments.length} files</span>
            </div>
            <form className="attachment-form" onSubmit={uploadAttachment}>
              <label>
                Upload PDF, DOC, DOCX, JPEG, or PNG
                <input
                  accept={attachmentAccept}
                  type="file"
                  onChange={(event) => setAttachmentFile(event.target.files?.[0] || null)}
                />
              </label>
              <div className="attachment-form-grid">
                <label>
                  Category
                  <select value={attachmentCategory} onChange={(event) => setAttachmentCategory(event.target.value)}>
                    {attachmentCategoryOptions.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Tags
                  <input
                    placeholder="frontend, login, customer"
                    value={attachmentTags}
                    onChange={(event) => setAttachmentTags(event.target.value)}
                  />
                </label>
              </div>
              <label>
                Upload as new version of
                <select value={replacesAttachmentId} onChange={(event) => setReplacesAttachmentId(event.target.value)}>
                  <option value="">New attachment</option>
                  {attachments.map((attachment) => (
                    <option key={attachment.id} value={attachment.id}>
                      {attachment.file_name} v{attachment.version_number || 1}
                    </option>
                  ))}
                </select>
              </label>
              {uploadProgress > 0 ? (
                <div className="upload-progress">
                  <progress max="100" value={uploadProgress} />
                  <span>{uploadProgress}%</span>
                </div>
              ) : null}
              <button className="primary-action" type="submit">Upload attachment</button>
            </form>

            <label>
              AI analysis prompt
              <textarea
                placeholder="Optional: ask what the file shows, extract errors, or recommend next steps"
                value={attachmentPrompt}
                onChange={(event) => setAttachmentPrompt(event.target.value)}
              />
            </label>

            <div className="attachment-list">
              {attachments.map((attachment) => {
                const insight = attachmentInsights[attachment.id];
                const commentsForAttachment = attachmentComments[attachment.id] || [];
                const analysesForAttachment = attachmentAnalyses[attachment.id] || [];
                const canDeleteAttachment =
                  ["admin", "developer"].includes(currentUser?.role) ||
                  attachment.uploaded_by === currentUser?.id;
                const categoryLabel =
                  attachmentCategoryOptions.find((option) => option.value === attachment.category)?.label || "Other";

                return (
                  <article className="attachment-item" key={attachment.id}>
                    <div>
                      <strong>{attachment.file_name}</strong>
                      <small>
                        {attachment.mime_type} - {Math.ceil(attachment.file_size / 1024)} KB - v{attachment.version_number || 1} - {formatDate(attachment.created_at)}
                      </small>
                      <div className="attachment-badges">
                        <span>{categoryLabel}</span>
                        <span>Visible to authenticated workspace users</span>
                        <span>Delete: admin, developer, or uploader</span>
                      </div>
                      {attachment.tags ? <p className="attachment-tags">Tags: {attachment.tags}</p> : null}
                      {attachmentPreviewUrls[attachment.id] ? (
                        <div
                          className="attachment-preview"
                          role="button"
                          tabIndex={0}
                          onClick={() => window.open(attachmentPreviewUrls[attachment.id], "_blank", "noopener,noreferrer")}
                          onKeyDown={(event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              window.open(attachmentPreviewUrls[attachment.id], "_blank", "noopener,noreferrer");
                            }
                          }}
                        >
                          {attachment.mime_type === "application/pdf" ? (
                            <iframe src={attachmentPreviewUrls[attachment.id]} title={`${attachment.file_name} preview`} />
                          ) : (
                            <img src={attachmentPreviewUrls[attachment.id]} alt={`${attachment.file_name} preview`} />
                          )}
                        </div>
                      ) : null}
                      {attachment.ai_summary ? <p>{attachment.ai_summary}</p> : null}
                      {insight ? (
                        <div className="attachment-insight">
                          <strong>AI analysis</strong>
                          <p>{insight.summary}</p>
                          <p><b>Suggested action:</b> {insight.suggestedAction}</p>
                          <p><b>Risk:</b> {insight.riskLevel}</p>
                          {insight.extractedText ? <pre>{insight.extractedText}</pre> : null}
                        </div>
                      ) : null}
                      {analysesForAttachment.length > 0 ? (
                        <div className="attachment-insight">
                          <strong>AI analysis history</strong>
                          {analysesForAttachment.slice(0, 3).map((analysis) => (
                            <p key={analysis.id}>
                              {formatDate(analysis.created_at)} - {analysis.summary || "Analysis saved"}
                            </p>
                          ))}
                        </div>
                      ) : null}
                      <div className="attachment-comments">
                        <strong>Attachment comments</strong>
                        {commentsForAttachment.map((comment) => (
                          <p key={comment.id}>
                            <b>{displayNameParts(comment.author_first_name, comment.author_last_name, comment.author_email)}:</b> {comment.comment_text}
                          </p>
                        ))}
                        <form onSubmit={(event) => addAttachmentComment(event, attachment.id)}>
                          <input
                            placeholder="Comment on this file"
                            value={attachmentCommentDrafts[attachment.id] || ""}
                            onChange={(event) =>
                              setAttachmentCommentDrafts((current) => ({
                                ...current,
                                [attachment.id]: event.target.value
                              }))
                            }
                          />
                          <button className="secondary-action" type="submit">Add</button>
                        </form>
                      </div>
                    </div>
                    <div className="button-row">
                      <button className="secondary-action" type="button" onClick={() => downloadAttachment(attachment)}>
                        Download
                      </button>
                      <button className="secondary-action" type="button" onClick={() => analyzeAttachment(attachment.id)}>
                        Analyze
                      </button>
                      {canDeleteAttachment ? (
                        <button className="secondary-action danger-action" type="button" onClick={() => deleteAttachment(attachment.id)}>
                          Delete
                        </button>
                      ) : null}
                    </div>
                  </article>
                );
              })}
              {attachments.length === 0 ? <p className="empty-column">No attachments yet</p> : null}
            </div>
          </section>

          <section className="comments-panel">
            <div className="section-heading-row">
              <div>
                <p className="dashboard-eyebrow">Collaboration</p>
                <h2>Comments</h2>
              </div>
              <span>{comments.length} notes</span>
            </div>
            <form className="comment-form" onSubmit={addComment}>
              <textarea
                required
                placeholder="Add a ticket comment"
                value={commentText}
                onChange={(event) => setCommentText(event.target.value)}
              />
              <button className="primary-action" type="submit">Add comment</button>
              {canManageInternalComments ? (
                <label className="inline-check">
                  <input
                    type="checkbox"
                    checked={isInternalComment}
                    onChange={(event) => setIsInternalComment(event.target.checked)}
                  />
                  Internal note
                </label>
              ) : null}
            </form>

            <div className="comment-list">
              {comments.map((comment) => (
                <article className="comment-item" key={comment.id}>
                  <div className="comment-meta">
                    <strong>{displayNameParts(comment.author_first_name, comment.author_last_name, comment.author_email)}</strong>
                    <small>{formatDate(comment.created_at)}</small>
                    {comment.is_internal ? <span>Internal</span> : null}
                  </div>
                  {editingCommentId === comment.id ? (
                    <div className="comment-edit">
                      <textarea
                        value={editingCommentText}
                        onChange={(event) => setEditingCommentText(event.target.value)}
                      />
                      {canManageInternalComments ? (
                        <label className="inline-check">
                          <input
                            type="checkbox"
                            checked={editingCommentInternal}
                            onChange={(event) => setEditingCommentInternal(event.target.checked)}
                          />
                          Internal note
                        </label>
                      ) : null}
                      <div className="button-row">
                        <button className="primary-action" type="button" onClick={() => updateComment(comment.id)}>
                          Save
                        </button>
                        <button className="secondary-action" type="button" onClick={cancelEditingComment}>
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <p>{comment.comment_text}</p>
                      {(isAdmin || comment.user_id === currentUser?.id) ? (
                        <div className="button-row">
                          <button className="secondary-action" type="button" onClick={() => startEditingComment(comment)}>
                            Edit
                          </button>
                          <button className="secondary-action danger-action" type="button" onClick={() => deleteComment(comment.id)}>
                            Delete
                          </button>
                        </div>
                      ) : null}
                    </>
                  )}
                </article>
              ))}
              {comments.length === 0 ? <p className="empty-column">No comments yet</p> : null}
            </div>
          </section>
        </section>

        <aside className="ticket-side-panel">
          <div>
            <p className="dashboard-eyebrow">Issue details</p>
            <h2>Ticket fields</h2>
          </div>
          <dl className="ticket-field-list">
            <div><dt>Type</dt><dd>{ticket.issue_type}</dd></div>
            <div><dt>Status</dt><dd>{ticket.status}</dd></div>
            <div><dt>Priority</dt><dd>{ticket.priority}</dd></div>
            <div><dt>Resolution</dt><dd>{ticket.resolution}</dd></div>
            <div><dt>Sprint</dt><dd>{ticket.sprint_name || ticket.sprint || "Not set"}</dd></div>
            <div><dt>Scrum team</dt><dd>{ticket.scrum_team_name || ticket.scrum_team || "Not set"}</dd></div>
            <div><dt>Assignee</dt><dd>{ticket.assignee_email || "Unassigned"}</dd></div>
            <div><dt>Owner</dt><dd>{ticket.owner_email || "No owner"}</dd></div>
            <div><dt>Reporter</dt><dd>{ticket.reporter_email}</dd></div>
            <div><dt>Created</dt><dd>{formatDate(ticket.created_at)}</dd></div>
          </dl>
        </aside>
      </section>

      {isAdmin ? (
        // Admin panel is intentionally separate from work updates.
        <section className="ticket-edit-panel">
          <div>
            <p className="dashboard-eyebrow">Admin controls</p>
            <h2>Update ticket metadata</h2>
          </div>

          <form className="ticket-edit-form" onSubmit={updateAdminDetails}>
            <label>
              Header
              <input
                value={editForm.title}
                onChange={(event) => setEditForm({ ...editForm, title: event.target.value })}
              />
            </label>
            <div className="form-row">
              <label>
                Type
                <select
                  value={editForm.issueType}
                  onChange={(event) => setEditForm({ ...editForm, issueType: event.target.value })}
                >
                  {typeOptions.map((type) => <option key={type} value={type}>{type}</option>)}
                </select>
              </label>
              <label>
                Priority
                <select
                  value={editForm.priority}
                  onChange={(event) => setEditForm({ ...editForm, priority: event.target.value })}
                >
                  {priorityOptions.map((priority) => <option key={priority} value={priority}>{priority}</option>)}
                </select>
              </label>
            </div>
            <div className="form-row">
              <label>
                Assignee
                <select
                  value={editForm.assigneeId}
                  onChange={(event) => setEditForm({ ...editForm, assigneeId: event.target.value })}
                >
                  <option value="">Unassigned</option>
                  {users.map((user) => (
                    <option key={user.id} value={user.id}>
                      {displayNameParts(user.first_name, user.last_name, user.email)} - {user.role}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Owner
                <select
                  value={editForm.ownerId}
                  onChange={(event) => setEditForm({ ...editForm, ownerId: event.target.value })}
                >
                  <option value="">No owner</option>
                  {users.map((user) => (
                    <option key={user.id} value={user.id}>
                      {displayNameParts(user.first_name, user.last_name, user.email)} - {user.role}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="form-row">
              <label>
                Sprint
                <select
                  value={editForm.sprintId}
                  onChange={(event) => setEditForm({ ...editForm, sprintId: event.target.value })}
                >
                  <option value="">No sprint</option>
                  {projectSprints.map((sprint) => (
                    <option key={sprint.id} value={sprint.id}>{sprint.name}</option>
                  ))}
                </select>
              </label>
              <label>
                Scrum team
                <select
                  value={editForm.scrumTeamId}
                  onChange={(event) => setEditForm({ ...editForm, scrumTeamId: event.target.value })}
                >
                  <option value="">No team</option>
                  {projectTeams.map((team) => (
                    <option key={team.id} value={team.id}>{team.name}</option>
                  ))}
                </select>
              </label>
            </div>
            <label>
              Impact
              <textarea
                value={editForm.impact}
                onChange={(event) => setEditForm({ ...editForm, impact: event.target.value })}
              />
            </label>
            <label>
              Description
              <textarea
                value={editForm.description}
                onChange={(event) => setEditForm({ ...editForm, description: event.target.value })}
              />
            </label>
            <button className="primary-action" type="submit">Save metadata</button>
          </form>
        </section>
      ) : null}

      {canUpdateWork ? (
        // Work update panel stays available to users responsible for fixing the ticket.
        <section className="ticket-edit-panel">
          <div>
            <p className="dashboard-eyebrow">Work update</p>
            <h2>Update status and fix progress</h2>
          </div>

          <form className="ticket-edit-form" onSubmit={updateWorkDetails}>
            {!isAdmin ? (
              <p className="role-note standalone">
                You can update status, resolution, and what is being done to fix it. Sprint and story/type fields remain locked.
              </p>
            ) : null}
            <div className="form-row">
              <label>
                Status
                <select
                  value={editForm.status}
                  onChange={(event) => setEditForm({ ...editForm, status: event.target.value })}
                >
                  {statusOptions.map((status) => (
                    <option key={status.value} value={status.value}>{status.label}</option>
                  ))}
                </select>
              </label>
              <label>
                Resolution
                <select
                  value={editForm.resolution}
                  onChange={(event) => setEditForm({ ...editForm, resolution: event.target.value })}
                >
                  {resolutionOptions.map((resolution) => (
                    <option key={resolution} value={resolution}>{resolution}</option>
                  ))}
                </select>
              </label>
            </div>
            <label>
              What is being done to fix it?
              <textarea
                value={editForm.fixPlan}
                onChange={(event) => setEditForm({ ...editForm, fixPlan: event.target.value })}
              />
            </label>
            <button className="primary-action" type="submit">Save ticket</button>
          </form>
        </section>
      ) : null}

      <section className="ticket-edit-panel">
        <div>
          <p className="dashboard-eyebrow">Activity history</p>
          <h2>Ticket timeline</h2>
        </div>
        <div className="activity-list">
          {activity.map((item) => (
            <article className="activity-item" key={item.id}>
              <strong>{item.actor_first_name} {item.actor_last_name}</strong>
              <span>
                {item.action === "updated_field"
                  ? `changed ${item.field_name} from ${item.old_value || "empty"} to ${item.new_value || "empty"}`
                  : item.action.replaceAll("_", " ")}
              </span>
              <small>{formatDate(item.created_at)}</small>
            </article>
          ))}
          {activity.length === 0 ? <p className="empty-column">No activity yet</p> : null}
        </div>
      </section>
    </main>
  );
}
