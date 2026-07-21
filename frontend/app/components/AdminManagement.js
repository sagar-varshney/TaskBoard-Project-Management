"use client";

import { useEffect, useMemo, useState } from "react";
import { apiUrl } from "../config/api";
import ThemeToggle from "./ThemeToggle";

function displayName(user) {
  const name = `${user.first_name || ""} ${user.last_name || ""}`.trim();
  return name || user.email || "Unnamed user";
}

function initialsFor(user) {
  return displayName(user)
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

const emptyEmployee = {
  email: "",
  password: "",
  firstName: "",
  lastName: "",
  role: "member"
};

const emptyCompanyForm = {
  companyName: "",
  slug: "",
  adminEmail: "",
  adminPassword: "",
  adminFirstName: "",
  adminLastName: ""
};

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
  const [employeeRows, setEmployeeRows] = useState([{ ...emptyEmployee }]);
  const [companyForm, setCompanyForm] = useState({ ...emptyCompanyForm });
  const token = typeof window !== "undefined" ? localStorage.getItem("jiraCloneToken") : "";
  const isSprintMode = mode === "sprints";
  const isUsersMode = mode === "users";

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
        isUsersMode ? Promise.resolve({ sprints: [], teams: [] }) : apiRequest(isSprintMode ? "/sprints" : "/teams")
      ]);
      const firstProjectId = projectData.projects[0] ? String(projectData.projects[0].id) : "";

      setProjects(projectData.projects);
      setUsers(userData.users);
      setItems(isUsersMode ? [] : isSprintMode ? resourceData.sprints : resourceData.teams);
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

  function updateEmployeeRow(index, field, value) {
    setEmployeeRows((currentRows) =>
      currentRows.map((row, rowIndex) => (rowIndex === index ? { ...row, [field]: value } : row))
    );
  }

  function addEmployeeRow() {
    setEmployeeRows((currentRows) => [...currentRows, { ...emptyEmployee }]);
  }

  function removeEmployeeRow(index) {
    setEmployeeRows((currentRows) =>
      currentRows.length === 1 ? currentRows : currentRows.filter((row, rowIndex) => rowIndex !== index)
    );
  }

  async function createEmployees(event) {
    event.preventDefault();
    setMessage("");

    try {
      const employees = employeeRows.map((row) => ({
        email: row.email.trim(),
        password: row.password,
        firstName: row.firstName.trim(),
        lastName: row.lastName.trim(),
        role: row.role
      }));
      const data = await apiRequest("/users/bulk", {
        method: "POST",
        body: JSON.stringify({ employees })
      });

      setEmployeeRows([{ ...emptyEmployee }]);
      await loadManagement();
      setMessage(`Added ${data.createdUsers.length} employee(s). Skipped ${data.skippedUsers.length}.`);
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function changeUserRole(userId, role) {
    setMessage("");

    try {
      await apiRequest(`/users/${userId}/role`, {
        method: "PATCH",
        body: JSON.stringify({ role })
      });
      await loadManagement();
      setMessage("User role updated.");
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function createCompany(event) {
    event.preventDefault();
    setMessage("");

    try {
      await apiRequest("/companies", {
        method: "POST",
        body: JSON.stringify({
          companyName: companyForm.companyName.trim(),
          slug: companyForm.slug.trim(),
          admin: {
            email: companyForm.adminEmail.trim(),
            password: companyForm.adminPassword,
            firstName: companyForm.adminFirstName.trim(),
            lastName: companyForm.adminLastName.trim()
          }
        })
      });
      setCompanyForm({ ...emptyCompanyForm });
      setMessage("Company workspace and company admin created.");
    } catch (error) {
      setMessage(error.message);
    }
  }

  return (
    <main className="dashboard-shell role-admin">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <span className="sidebar-logo">TB</span>
          <div>
            <strong>TaskBoard</strong>
            <small>Admin console</small>
          </div>
        </div>
        <nav aria-label="Workspace management navigation">
          <a className="nav-link" href="/">Board</a>
          <a className="nav-link" href="/my-tickets">My tickets</a>
          {currentUser?.role === "admin" ? (
            <>
              <a className={`nav-link ${isSprintMode ? "active" : ""}`} href="/admin/sprints">Sprints</a>
              <a className={`nav-link ${!isSprintMode && !isUsersMode ? "active" : ""}`} href="/admin/teams">Scrum teams</a>
              <a className={`nav-link ${isUsersMode ? "active" : ""}`} href="/admin/users">Employees</a>
            </>
          ) : null}
        </nav>
        {currentUser ? (
          <div className="sidebar-user">
            <span className="avatar">{initialsFor(currentUser)}</span>
            <div>
              <span>{displayName(currentUser)}</span>
              <small>{currentUser.role}</small>
            </div>
          </div>
        ) : null}
      </aside>

      <section className="dashboard-content">
        <header className="dashboard-header">
          <div>
            <p className="dashboard-eyebrow">Admin workspace</p>
            <h1>{isUsersMode ? "Employee management" : isSprintMode ? "Sprint management" : "Scrum team management"}</h1>
          </div>
          <div className="header-actions">
            <ThemeToggle />
            <a className="secondary-action compact-link" href="/">Back to board</a>
          </div>
        </header>

        {message ? <p className="dashboard-message">{message}</p> : null}

        {!isLoading && currentUser?.role === "admin" ? (
          <section className="management-layout">
            {isUsersMode ? (
              <div className="admin-user-forms">
                <form className="dashboard-form" onSubmit={createEmployees}>
                  <h2>Add employees</h2>
                  {employeeRows.map((employee, index) => (
                    <div className="employee-row" key={index}>
                      <label>
                        Email
                        <input
                          required
                          type="email"
                          placeholder="employee@company.com"
                          value={employee.email}
                          onChange={(event) => updateEmployeeRow(index, "email", event.target.value)}
                        />
                      </label>
                      <label>
                        First name
                        <input
                          required
                          value={employee.firstName}
                          onChange={(event) => updateEmployeeRow(index, "firstName", event.target.value)}
                        />
                      </label>
                      <label>
                        Last name
                        <input
                          required
                          value={employee.lastName}
                          onChange={(event) => updateEmployeeRow(index, "lastName", event.target.value)}
                        />
                      </label>
                      <label>
                        Role
                        <select
                          value={employee.role}
                          onChange={(event) => updateEmployeeRow(index, "role", event.target.value)}
                        >
                          <option value="member">Member</option>
                          <option value="developer">Developer</option>
                          <option value="admin">Admin</option>
                        </select>
                      </label>
                      <label>
                        Temporary password
                        <input
                          required
                          type="password"
                          minLength={8}
                          value={employee.password}
                          onChange={(event) => updateEmployeeRow(index, "password", event.target.value)}
                        />
                      </label>
                      <button className="secondary-action compact-link" type="button" onClick={() => removeEmployeeRow(index)}>
                        Remove
                      </button>
                    </div>
                  ))}
                  <button className="secondary-action compact-link" type="button" onClick={addEmployeeRow}>Add another employee</button>
                  <button className="primary-action" type="submit">Create employees</button>
                </form>

                <form className="dashboard-form" onSubmit={createCompany}>
                  <h2>Create company workspace</h2>
                  <label>
                    Company name
                    <input
                      required
                      value={companyForm.companyName}
                      onChange={(event) => setCompanyForm({ ...companyForm, companyName: event.target.value })}
                    />
                  </label>
                  <label>
                    Company slug
                    <input
                      placeholder="acme-inc"
                      value={companyForm.slug}
                      onChange={(event) => setCompanyForm({ ...companyForm, slug: event.target.value })}
                    />
                  </label>
                  <div className="employee-row">
                    <label>
                      Admin email
                      <input
                        required
                        type="email"
                        value={companyForm.adminEmail}
                        onChange={(event) => setCompanyForm({ ...companyForm, adminEmail: event.target.value })}
                      />
                    </label>
                    <label>
                      Admin first name
                      <input
                        required
                        value={companyForm.adminFirstName}
                        onChange={(event) => setCompanyForm({ ...companyForm, adminFirstName: event.target.value })}
                      />
                    </label>
                    <label>
                      Admin last name
                      <input
                        required
                        value={companyForm.adminLastName}
                        onChange={(event) => setCompanyForm({ ...companyForm, adminLastName: event.target.value })}
                      />
                    </label>
                    <label>
                      Admin temporary password
                      <input
                        required
                        type="password"
                        minLength={8}
                        value={companyForm.adminPassword}
                        onChange={(event) => setCompanyForm({ ...companyForm, adminPassword: event.target.value })}
                      />
                    </label>
                  </div>
                  <button className="primary-action" type="submit">Create company admin</button>
                </form>
              </div>
            ) : isSprintMode ? (
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
                        {displayName(user)} - {user.role}
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
                <h2>{isUsersMode ? "Employees" : isSprintMode ? "Sprints" : "Scrum teams"}</h2>
              </div>
              {isUsersMode ? users.map((user) => (
                <article className="management-item" key={user.id}>
                  <strong>{displayName(user)}</strong>
                  <span>{user.email}</span>
                  <small>{user.role}</small>
                  <select
                    value={user.role}
                    onChange={(event) => changeUserRole(user.id, event.target.value)}
                  >
                    <option value="member">Member</option>
                    <option value="developer">Developer</option>
                    <option value="admin">Admin</option>
                  </select>
                </article>
              )) : items.map((item) => (
                <article className="management-item" key={item.id}>
                  <strong>{item.name}</strong>
                  <span>{projects.find((project) => project.id === item.project_id)?.name || "Project"}</span>
                  <p>{isSprintMode ? item.goal || "No goal" : item.description || "No description"}</p>
                  <small>{isSprintMode ? item.status : `${item.member_count} members`}</small>
                </article>
              ))}
              {(isUsersMode ? users.length : items.length) === 0 ? <p className="empty-column">No records yet</p> : null}
            </section>
          </section>
        ) : null}
      </section>
    </main>
  );
}
