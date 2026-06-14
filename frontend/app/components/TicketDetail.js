"use client";

import { useEffect, useState } from "react";

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:5001/api";
const statusOptions = [
  { value: "todo", label: "To do" },
  { value: "in_progress", label: "In progress" },
  { value: "done", label: "Done" }
];
const priorityOptions = ["low", "medium", "high", "critical"];
const typeOptions = ["bug", "task", "story"];
const resolutionOptions = ["unresolved", "fixed", "wont_fix", "duplicate"];

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
  const [activity, setActivity] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [editForm, setEditForm] = useState(emptyEditForm());
  const [commentText, setCommentText] = useState("");
  const [isInternalComment, setIsInternalComment] = useState(false);
  const [editingCommentId, setEditingCommentId] = useState(null);
  const [editingCommentText, setEditingCommentText] = useState("");
  const [editingCommentInternal, setEditingCommentInternal] = useState(false);
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadTicket();
  }, [ticketId]);

  async function apiRequest(path, options = {}) {
    // Same API helper pattern as Dashboard: attach token, parse JSON, throw readable errors.
    const token = localStorage.getItem("jiraCloneToken");

    if (!token) {
      throw new Error("Your login session is missing. Return to the dashboard and log in again.");
    }

    const response = await fetch(`${apiBaseUrl}${path}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
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

  async function loadTicket() {
    setIsLoading(true);
    setMessage("");

    try {
      const [profileData, ticketData, commentData, activityData, userData, sprintData, teamData] = await Promise.all([
        // These resources are independent, so they can load at the same time.
        apiRequest("/auth/me"),
        apiRequest(`/tickets/${ticketId}`),
        apiRequest(`/tickets/${ticketId}/comments`),
        apiRequest(`/tickets/${ticketId}/activity`),
        apiRequest("/users"),
        apiRequest("/sprints"),
        apiRequest("/teams")
      ]);

      setCurrentUser(profileData.user);
      setTicket(ticketData.ticket);
      setComments(commentData.comments);
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
      const data = await apiRequest(`/tickets/${ticketId}/comments`, {
        method: "POST",
        body: JSON.stringify({ commentText, isInternal: isInternalComment })
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
      const data = await apiRequest(`/tickets/${ticketId}/comments/${commentId}`, {
        method: "PATCH",
        body: JSON.stringify({
          commentText: editingCommentText,
          isInternal: editingCommentInternal
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
  const isDelegatedUser =
    // Developers can update work; members can update work only when assigned/owner.
    currentUser?.role === "developer" ||
    ticket?.assignee_id === currentUser?.id ||
    ticket?.owner_id === currentUser?.id;
  const canUpdateWork = isAdmin || isDelegatedUser;
  const projectSprints = sprints.filter((sprint) => sprint.project_id === ticket?.project_id);
  const projectTeams = teams.filter((team) => team.project_id === ticket?.project_id);

  if (isLoading) {
    return <main className="ticket-detail-shell"><p>Loading ticket...</p></main>;
  }

  if (!ticket) {
    return (
      <main className="ticket-detail-shell">
        <p className="dashboard-message">{message || "Ticket not found"}</p>
      </main>
    );
  }

  return (
    <main className="ticket-detail-shell">
      <header className="ticket-detail-header">
        <div>
          <p className="dashboard-eyebrow">{ticket.project_key}</p>
          <h1>{ticket.ticket_key}: {ticket.title}</h1>
        </div>
        <a className="secondary-action compact-link" href="/" target="_self">Back to dashboard</a>
      </header>

      {message ? <p className="dashboard-message">{message}</p> : null}

      <section className="ticket-detail-grid">
        <section className="ticket-main-panel">
          <h2>Description</h2>
          <p>{ticket.description || "No description provided."}</p>

          <h2>Impact</h2>
          <p>{ticket.impact || "No impact recorded."}</p>

          <h2>Fix plan</h2>
          <p>{ticket.fix_plan || "No fix plan recorded yet."}</p>

          <section className="comments-panel">
            <h2>Comments</h2>
            <form className="comment-form" onSubmit={addComment}>
              <textarea
                required
                placeholder="Add a ticket comment"
                value={commentText}
                onChange={(event) => setCommentText(event.target.value)}
              />
              <button className="primary-action" type="submit">Add comment</button>
              <label className="inline-check">
                <input
                  type="checkbox"
                  checked={isInternalComment}
                  onChange={(event) => setIsInternalComment(event.target.checked)}
                />
                Internal note
              </label>
            </form>

            <div className="comment-list">
              {comments.map((comment) => (
                <article className="comment-item" key={comment.id}>
                  <div className="comment-meta">
                    <strong>{comment.author_first_name} {comment.author_last_name}</strong>
                    <small>{formatDate(comment.created_at)}</small>
                    {comment.is_internal ? <span>Internal</span> : null}
                  </div>
                  {editingCommentId === comment.id ? (
                    <div className="comment-edit">
                      <textarea
                        value={editingCommentText}
                        onChange={(event) => setEditingCommentText(event.target.value)}
                      />
                      <label className="inline-check">
                        <input
                          type="checkbox"
                          checked={editingCommentInternal}
                          onChange={(event) => setEditingCommentInternal(event.target.checked)}
                        />
                        Internal note
                      </label>
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
          <h2>Ticket fields</h2>
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
                      {user.first_name} {user.last_name} - {user.role}
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
                      {user.first_name} {user.last_name} - {user.role}
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
