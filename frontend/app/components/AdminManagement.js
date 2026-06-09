"use client";

import { useEffect, useMemo, useState } from "react";

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:5001/api";

export default function AdminManagement({ mode }) {
  // One component handles two admin pages: /admin/sprints and /admin/teams.
  const [currentUser, setCurrentUser] = useState(null);
  const [projects, setProjects] = useState([]);
  const [users, setUsers] = useState([]);
  const [items, setItems] = useState([]);
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [sprintForm, setSprintForm] = useState({
    projectId: "",
    name: "",
    goal: "",
    status: "planned"
  });
  const [teamForm, setTeamForm] = useState({
    projectId: "",
    name: "",
    description: "",
    memberIds: []
  });
  const token = typeof window !== "undefined" ? localStorage.getItem("jiraCloneToken") : "";
  const isSprintMode = mode === "sprints";

  const authHeaders = useMemo(
    () => ({
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    }),
    [token]
  );

  useEffect(() => {
    loadManagement();
  }, [mode]);

  async function apiRequest(path, options = {}) {
    const response = await fetch(`${apiBaseUrl}${path}`, {
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

  async function loadManagement() {
    setIsLoading(true);
    setMessage("");

    try {
      const profileData = await apiRequest("/auth/me");
      setCurrentUser(profileData.user);

      // Frontend guard for UX; backend routes still enforce admin-only writes.
      if (profileData.user.role !== "admin") {
        setMessage("This workspace management page is available to admins only.");
        return;
      }

      const [projectData, userData, resourceData] = await Promise.all([
        apiRequest("/projects"),
        apiRequest("/users"),
        apiRequest(isSprintMode ? "/sprints" : "/teams")
      ]);
      const firstProjectId = projectData.projects[0] ? String(projectData.projects[0].id) : "";

      setProjects(projectData.projects);
      setUsers(userData.users);
      setItems(isSprintMode ? resourceData.sprints : resourceData.teams);
      setSprintForm((current) => ({ ...current, projectId: current.projectId || firstProjectId }));
      setTeamForm((current) => ({ ...current, projectId: current.projectId || firstProjectId }));
    } catch (error) {
      setMessage(error.message);
    } finally {
      setIsLoading(false);
    }
  }

  async function createSprint(event) {
    event.preventDefault();
    setMessage("");

    try {
      await apiRequest("/sprints", {
        method: "POST",
        body: JSON.stringify(sprintForm)
      });
      setSprintForm({ projectId: sprintForm.projectId, name: "", goal: "", status: "planned" });
      await loadManagement();
      setMessage("Sprint created successfully.");
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function createTeam(event) {
    event.preventDefault();
    setMessage("");

    try {
      await apiRequest("/teams", {
        method: "POST",
        body: JSON.stringify(teamForm)
      });
      setTeamForm({ projectId: teamForm.projectId, name: "", description: "", memberIds: [] });
      await loadManagement();
      setMessage("Scrum team created successfully.");
    } catch (error) {
      setMessage(error.message);
    }
  }

  return (
    <main className="dashboard-shell role-admin">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <span className="sidebar-logo">T</span>
          <strong>TaskBoard</strong>
        </div>
        <nav aria-label="Workspace management navigation">
          <a className="nav-link" href="/">Board</a>
          <a className="nav-link" href="/my-tickets">My tickets</a>
          {currentUser?.role === "admin" ? (
            <>
              <a className={`nav-link ${isSprintMode ? "active" : ""}`} href="/admin/sprints">Sprints</a>
              <a className={`nav-link ${!isSprintMode ? "active" : ""}`} href="/admin/teams">Scrum teams</a>
            </>
          ) : null}
        </nav>
        {currentUser ? (
          <div className="sidebar-user">
            <span>{currentUser.first_name} {currentUser.last_name}</span>
            <small>{currentUser.role}</small>
          </div>
        ) : null}
      </aside>

      <section className="dashboard-content">
        <header className="dashboard-header">
          <div>
            <p className="dashboard-eyebrow">Admin workspace</p>
            <h1>{isSprintMode ? "Sprint management" : "Scrum team management"}</h1>
          </div>
          <a className="secondary-action compact-link" href="/">Back to board</a>
        </header>

        {message ? <p className="dashboard-message">{message}</p> : null}

        {!isLoading && currentUser?.role === "admin" ? (
          <section className="management-layout">
            {isSprintMode ? (
              <form className="dashboard-form" onSubmit={createSprint}>
                <h2>Create sprint</h2>
                <label>
                  Project
                  <select
                    required
                    value={sprintForm.projectId}
                    onChange={(event) => setSprintForm({ ...sprintForm, projectId: event.target.value })}
                  >
                    <option value="">Select a project</option>
                    {projects.map((project) => (
                      <option key={project.id} value={project.id}>{project.project_key} - {project.name}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Sprint name
                  <input
                    required
                    placeholder="Sprint 3"
                    value={sprintForm.name}
                    onChange={(event) => setSprintForm({ ...sprintForm, name: event.target.value })}
                  />
                </label>
                <label>
                  Goal
                  <textarea
                    value={sprintForm.goal}
                    onChange={(event) => setSprintForm({ ...sprintForm, goal: event.target.value })}
                  />
                </label>
                <label>
                  Status
                  <select
                    value={sprintForm.status}
                    onChange={(event) => setSprintForm({ ...sprintForm, status: event.target.value })}
                  >
                    <option value="planned">Planned</option>
                    <option value="active">Active</option>
                    <option value="completed">Completed</option>
                  </select>
                </label>
                <button className="primary-action" type="submit">Create sprint</button>
              </form>
            ) : (
              <form className="dashboard-form" onSubmit={createTeam}>
                <h2>Create scrum team</h2>
                <label>
                  Project
                  <select
                    required
                    value={teamForm.projectId}
                    onChange={(event) => setTeamForm({ ...teamForm, projectId: event.target.value })}
                  >
                    <option value="">Select a project</option>
                    {projects.map((project) => (
                      <option key={project.id} value={project.id}>{project.project_key} - {project.name}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Team name
                  <input
                    required
                    placeholder="Platform Team"
                    value={teamForm.name}
                    onChange={(event) => setTeamForm({ ...teamForm, name: event.target.value })}
                  />
                </label>
                <label>
                  Description
                  <textarea
                    value={teamForm.description}
                    onChange={(event) => setTeamForm({ ...teamForm, description: event.target.value })}
                  />
                </label>
                <label>
                  Members
                  <select
                    multiple
                    value={teamForm.memberIds}
                    onChange={(event) =>
                      // selectedOptions is converted into an array of user IDs for the backend.
                      setTeamForm({
                        ...teamForm,
                        memberIds: Array.from(event.target.selectedOptions, (option) => option.value)
                      })
                    }
                  >
                    {users.map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.first_name} {user.last_name} - {user.role}
                      </option>
                    ))}
                  </select>
                </label>
                <button className="primary-action" type="submit">Create team</button>
              </form>
            )}

            <section className="management-list">
              <div>
                <p className="dashboard-eyebrow">Current workspace records</p>
                <h2>{isSprintMode ? "Sprints" : "Scrum teams"}</h2>
              </div>
              {items.map((item) => (
                <article className="management-item" key={item.id}>
                  <strong>{item.name}</strong>
                  <span>{projects.find((project) => project.id === item.project_id)?.name || "Project"}</span>
                  <p>{isSprintMode ? item.goal || "No goal" : item.description || "No description"}</p>
                  <small>{isSprintMode ? item.status : `${item.member_count} members`}</small>
                </article>
              ))}
              {items.length === 0 ? <p className="empty-column">No records yet</p> : null}
            </section>
          </section>
        ) : null}
      </section>
    </main>
  );
}
