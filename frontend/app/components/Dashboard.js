"use client";

import { useEffect, useMemo, useState } from "react";
import { apiUrl } from "../config/api";
import AgentChat from "./AgentChat";
import ThemeToggle from "./ThemeToggle";

const columns = [
  { key: "todo", label: "To do" },
  { key: "in_progress", label: "In progress" },
  { key: "done", label: "Done" }
];

function displayName(user) {
  const name = `${user.first_name || ""} ${user.last_name || ""}`.trim();
  return name || user.email || "Unnamed user";
}

function ticketTitle(ticket) {
  return ticket.title?.trim() || "Untitled ticket";
}

function initialsFor(user) {
  const name = displayName(user);
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function badgeClass(prefix, value) {
  return `badge ${prefix}-${String(value || "unset").replaceAll("_", "-")}`;
}

function emptyTicketForm(projectId = "") {
  // Used when creating a fresh ticket or resetting the form after submit.
  return {
    projectId,
    assigneeId: "",
    ownerId: "",
    sprintId: "",
    scrumTeamId: "",
    title: "",
    description: "",
    issueType: "task",
    priority: "medium",
    impact: "",
    fixPlan: ""
  };
}

export default function Dashboard({ token, user, onLogout }) {
  // Dashboard state mirrors the major backend resources shown on this page.
  const [projects, setProjects] = useState([]);
  const [users, setUsers] = useState([]);
  const [sprints, setSprints] = useState([]);
  const [teams, setTeams] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [aiInsight, setAiInsight] = useState(null);
  const [projectForm, setProjectForm] = useState({
    key: "",
    name: "",
    description: ""
  });
  const [ticketForm, setTicketForm] = useState(emptyTicketForm());

  const authHeaders = useMemo(
    () => ({
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    }),
    [token]
  );

  useEffect(() => {
    loadDashboard();
  }, [token]);

  async function apiRequest(path, options = {}) {
    // Small wrapper so every dashboard API call automatically includes the JWT.
    const response = await fetch(apiUrl(path), {
      ...options,
      headers: {
        ...authHeaders,
        ...options.headers
      }
    });
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || "Request failed");
    }

    return data;
  }

  async function loadDashboard(projectId = selectedProjectId, options = {}) {
    setIsLoading(true);
    if (!options.keepMessage) {
      setMessage("");
    }

    try {
      const ticketQuery = projectId ? `?projectId=${projectId}` : "";
      // Load independent resources in parallel to keep the dashboard fast.
      const [projectData, ticketData, userData, sprintData, teamData] = await Promise.all([
        apiRequest("/projects"),
        apiRequest(`/tickets${ticketQuery}`),
        apiRequest("/users"),
        apiRequest("/sprints"),
        apiRequest("/teams")
      ]);

      setProjects(projectData.projects);
      setTickets(ticketData.tickets);
      setUsers(userData.users);
      setSprints(sprintData.sprints);
      setTeams(teamData.teams);

      if (!projectId && projectData.projects.length > 0) {
        const firstProjectId = String(projectData.projects[0].id);
        setTicketForm((current) => ({ ...current, projectId: firstProjectId }));
      }
    } catch (error) {
      setMessage(error.message);
    } finally {
      setIsLoading(false);
    }
  }

  async function createProject(event) {
    event.preventDefault();
    setMessage("");

    if (!projectForm.key.trim() || !projectForm.name.trim()) {
      setMessage("Project key and project name cannot be blank.");
      return;
    }

    try {
      const data = await apiRequest("/projects", {
        method: "POST",
        body: JSON.stringify({
          ...projectForm,
          key: projectForm.key.trim(),
          name: projectForm.name.trim()
        })
      });
      const projectId = String(data.project.id);

      setProjectForm({ key: "", name: "", description: "" });
      setSelectedProjectId(projectId);
      setTicketForm(emptyTicketForm(projectId));
      await loadDashboard(projectId, { keepMessage: true });
      setMessage("Project created successfully.");
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function createTicket(event) {
    event.preventDefault();
    setMessage("");

    if (!ticketForm.projectId) {
      setMessage("Select a project before creating a ticket.");
      return;
    }

    if (!ticketForm.title.trim()) {
      setMessage("Ticket title cannot be blank.");
      return;
    }

    try {
      await apiRequest("/tickets", {
        method: "POST",
        body: JSON.stringify({
          ...ticketForm,
          title: ticketForm.title.trim()
        })
      });
      setTicketForm(emptyTicketForm(selectedProjectId));
      await loadDashboard(selectedProjectId, { keepMessage: true });
      setMessage("Ticket created successfully.");
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function updateTicketStatus(ticketId, status) {
    try {
      // Uses the same PATCH endpoint as the ticket detail page, but sends only status.
      await apiRequest(`/tickets/${ticketId}`, {
        method: "PATCH",
        body: JSON.stringify({ status })
      });
      await loadDashboard(selectedProjectId, { keepMessage: true });
      setMessage("Ticket status updated.");
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function generateTicketSummary(ticketId) {
    setMessage("");
    setAiInsight(null);

    try {
      const data = await apiRequest(`/tickets/${ticketId}/ai-summary`, {
        method: "POST"
      });

      setAiInsight({
        ticketKey: data.ticket_key,
        ...data.insight
      });
      setMessage("AI ticket insight generated.");
    } catch (error) {
      setMessage(error.message);
    }
  }

  function changeProject(event) {
    const projectId = event.target.value;
    setSelectedProjectId(projectId);
    setTicketForm(emptyTicketForm(projectId));
    loadDashboard(projectId);
  }

  const ticketsByStatus = columns.reduce((result, column) => {
    // Creates the Kanban columns: todo, in_progress, done.
    result[column.key] = tickets.filter((ticket) => ticket.status === column.key);
    return result;
  }, {});
  const selectedProjectSprints = sprints.filter((sprint) => String(sprint.project_id) === String(ticketForm.projectId));
  const selectedProjectTeams = teams.filter((team) => String(team.project_id) === String(ticketForm.projectId));
  const isAdmin = user.role === "admin";
  const activeProject = projects.find((project) => String(project.id) === String(selectedProjectId));
  const roleSummary = {
    admin: "Manage workspace planning, delegation, tickets, and AI insights.",
    developer: "Work your queue, update progress, and collaborate on tickets.",
    member: "Report issues, follow tickets, comment, and update delegated work."
  }[user.role];

  return (
    <main className={`dashboard-shell role-${user.role}`}>
      <aside className="sidebar">
        <div className="sidebar-brand">
          <span className="sidebar-logo">TB</span>
          <div>
            <strong>TaskBoard</strong>
            <small>Delivery workspace</small>
          </div>
        </div>
        <nav aria-label="Dashboard navigation">
          <a className="nav-link active" href="#board">Board</a>
          <a className="nav-link" href="/my-tickets">My tickets</a>
          <a className="nav-link" href="#create-ticket">Create ticket</a>
          {isAdmin ? <a className="nav-link" href="#create-project">Projects</a> : null}
          {/* Sprint/team management lives in separate admin-only pages to keep the dashboard cleaner. */}
          {isAdmin ? <a className="nav-link" href="/admin/sprints">Sprints</a> : null}
          {isAdmin ? <a className="nav-link" href="/admin/teams">Scrum teams</a> : null}
        </nav>
        <div className="sidebar-user">
          <span className="avatar">{initialsFor(user)}</span>
          <div>
            <span>{displayName(user)}</span>
            <small>{user.role}</small>
          </div>
        </div>
      </aside>

      <section className="dashboard-content">
        <header className="dashboard-header">
          <div>
            <p className="dashboard-eyebrow">Workspace overview</p>
            <h1>{activeProject ? activeProject.name : "All project tickets"}</h1>
            <p className="header-summary">
              {activeProject
                ? `${activeProject.project_key} board with ${tickets.length} visible tickets.`
                : "A live view of planning, delivery, and completed work across the workspace."}
            </p>
          </div>
          <div className="header-actions">
            <a className="secondary-action compact-link" href="#create-ticket">New ticket</a>
            <ThemeToggle />
            <button className="logout-button" type="button" onClick={onLogout}>
              Log out
            </button>
          </div>
        </header>

        <section className="dashboard-controls">
          <label>
            Project
            <select value={selectedProjectId} onChange={changeProject}>
              <option value="">All projects</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.project_key} - {project.name}
                </option>
              ))}
            </select>
          </label>
          <div className="role-note">
            <span className={badgeClass("user-role", user.role)}>{user.role}</span>
            <span>{roleSummary}</span>
          </div>
        </section>

        {message ? <p className="dashboard-message">{message}</p> : null}

        {aiInsight ? (
          <section className="ai-insight" aria-label="AI ticket insight">
            <div>
              <p className="dashboard-eyebrow">Gemini ticket assistant</p>
              <h2>{aiInsight.ticketKey}</h2>
            </div>
            <p><strong>Summary:</strong> {aiInsight.summary}</p>
            <p><strong>Suggested priority:</strong> {aiInsight.suggestedPriority}</p>
            <p><strong>Next action:</strong> {aiInsight.nextAction}</p>
          </section>
        ) : null}

        <section className="metric-grid" aria-label="Ticket metrics">
          <div><span>Total tickets</span><strong>{tickets.length}</strong><small>Visible in current scope</small></div>
          <div><span>To do</span><strong>{ticketsByStatus.todo.length}</strong><small>Ready for pickup</small></div>
          <div><span>In progress</span><strong>{ticketsByStatus.in_progress.length}</strong><small>Actively moving</small></div>
          <div><span>Done</span><strong>{ticketsByStatus.done.length}</strong><small>Closed work</small></div>
        </section>

        <section className="ticket-board" id="board" aria-label="Ticket board">
          {columns.map((column) => (
            <div className="ticket-column" key={column.key}>
              <div className="column-header">
                <h2>{column.label}</h2>
                <span>{ticketsByStatus[column.key].length}</span>
              </div>
              <div className="ticket-list">
                {ticketsByStatus[column.key].map((ticket) => (
                  <article className="ticket-card" key={ticket.id}>
                    <div className="ticket-card-header">
                      <a href={`/tickets/${ticket.id}`} target="_blank" rel="noreferrer">
                        {ticket.ticket_key}
                      </a>
                      <span className={badgeClass("priority", ticket.priority)}>{ticket.priority}</span>
                    </div>
                    <h3>{ticketTitle(ticket)}</h3>
                    <p>{ticket.description || "No description"}</p>
                    <div className="ticket-meta-row">
                      <span className={badgeClass("type", ticket.issue_type)}>{ticket.issue_type}</span>
                      {ticket.assignee_email ? <span>{ticket.assignee_email}</span> : <span>Unassigned</span>}
                    </div>
                    <footer>
                      <span>{ticket.sprint_name || ticket.sprint || "No sprint"}</span>
                      {isAdmin ||
                      user.role === "developer" ||
                      ticket.assignee_id === user.id ||
                      ticket.owner_id === user.id ? (
                        // Frontend visibility follows the same idea as backend permissions.
                        <div className="ticket-actions">
                          <select
                            aria-label={`Update ${ticket.ticket_key} status`}
                            value={ticket.status}
                            onChange={(event) => updateTicketStatus(ticket.id, event.target.value)}
                          >
                            {columns.map((status) => (
                              <option key={status.key} value={status.key}>{status.label}</option>
                            ))}
                          </select>
                          {isAdmin ? (
                            <button type="button" onClick={() => generateTicketSummary(ticket.id)}>
                              AI insight
                            </button>
                          ) : null}
                        </div>
                      ) : null}
                    </footer>
                  </article>
                ))}
                {!isLoading && ticketsByStatus[column.key].length === 0 ? (
                  <p className="empty-column">No tickets</p>
                ) : null}
              </div>
            </div>
          ))}
        </section>

        <section className="dashboard-forms">
          <form className="dashboard-form" id="create-ticket" onSubmit={createTicket}>
            <div>
              <p className="dashboard-eyebrow">Create work</p>
              <h2>Create ticket</h2>
            </div>
            <label>
              Project
              <select
                required
                value={ticketForm.projectId}
                onChange={(event) => setTicketForm({ ...ticketForm, projectId: event.target.value })}
              >
                <option value="">Select a project</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>{project.project_key} - {project.name}</option>
                ))}
              </select>
            </label>
            <label>
              Title
              <input
                required
                value={ticketForm.title}
                onChange={(event) => setTicketForm({ ...ticketForm, title: event.target.value })}
              />
            </label>
            <label>
              Description
              <textarea
                value={ticketForm.description}
                onChange={(event) => setTicketForm({ ...ticketForm, description: event.target.value })}
              />
            </label>
            <div className="form-row">
              <label>
                Type
                <select
                  value={ticketForm.issueType}
                  onChange={(event) => setTicketForm({ ...ticketForm, issueType: event.target.value })}
                >
                  <option value="task">Task</option>
                  <option value="bug">Bug</option>
                  <option value="story">Story</option>
                </select>
              </label>
              <label>
                Priority
                <select
                  value={ticketForm.priority}
                  onChange={(event) => setTicketForm({ ...ticketForm, priority: event.target.value })}
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </select>
              </label>
            </div>
            {isAdmin ? (
              // Only admins can set delegation and planning metadata at ticket creation.
              <>
                <div className="form-row">
                  <label>
                    Assignee
                    <select
                      value={ticketForm.assigneeId}
                      onChange={(event) => setTicketForm({ ...ticketForm, assigneeId: event.target.value })}
                    >
                      <option value="">Unassigned</option>
                      {users.map((listedUser) => (
                        <option key={listedUser.id} value={listedUser.id}>
                          {displayName(listedUser)} - {listedUser.role}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Owner
                    <select
                      value={ticketForm.ownerId}
                      onChange={(event) => setTicketForm({ ...ticketForm, ownerId: event.target.value })}
                    >
                      <option value="">Current user</option>
                      {users.map((listedUser) => (
                        <option key={listedUser.id} value={listedUser.id}>
                          {displayName(listedUser)} - {listedUser.role}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <div className="form-row">
                  <label>
                    Sprint
                    <select
                      value={ticketForm.sprintId}
                      onChange={(event) => setTicketForm({ ...ticketForm, sprintId: event.target.value })}
                    >
                      <option value="">No sprint</option>
                      {selectedProjectSprints.map((sprint) => (
                        <option key={sprint.id} value={sprint.id}>{sprint.name}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Scrum team
                    <select
                      value={ticketForm.scrumTeamId}
                      onChange={(event) => setTicketForm({ ...ticketForm, scrumTeamId: event.target.value })}
                    >
                      <option value="">No team</option>
                      {selectedProjectTeams.map((team) => (
                        <option key={team.id} value={team.id}>{team.name}</option>
                      ))}
                    </select>
                  </label>
                </div>
              </>
            ) : null}
            <label>
              Impact
              <textarea
                placeholder="Who or what is affected by this issue?"
                value={ticketForm.impact}
                onChange={(event) => setTicketForm({ ...ticketForm, impact: event.target.value })}
              />
            </label>
            <label>
              Fix plan
              <textarea
                placeholder="What is being done to fix this ticket?"
                value={ticketForm.fixPlan}
                onChange={(event) => setTicketForm({ ...ticketForm, fixPlan: event.target.value })}
              />
            </label>
            <button className="primary-action" type="submit">Create ticket</button>
          </form>

          {isAdmin ? (
            <form className="dashboard-form" id="create-project" onSubmit={createProject}>
            <div>
              <p className="dashboard-eyebrow">Workspace setup</p>
              <h2>Create project</h2>
            </div>
            <label>
              Project key
              <input
                required
                placeholder="APP"
                value={projectForm.key}
                onChange={(event) => setProjectForm({ ...projectForm, key: event.target.value })}
              />
            </label>
            <label>
              Project name
              <input
                required
                placeholder="Application workspace"
                value={projectForm.name}
                onChange={(event) => setProjectForm({ ...projectForm, name: event.target.value })}
              />
            </label>
            <label>
              Description
              <textarea
                value={projectForm.description}
                onChange={(event) => setProjectForm({ ...projectForm, description: event.target.value })}
              />
            </label>
            <button className="secondary-action" type="submit">Create project</button>
            </form>
          ) : null}
        </section>
      </section>
      <AgentChat token={token} role={user.role} onChanged={() => loadDashboard(selectedProjectId)} />
    </main>
  );
}
