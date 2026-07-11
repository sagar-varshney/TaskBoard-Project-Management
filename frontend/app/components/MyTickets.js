"use client";

import { useEffect, useState } from "react";
import { apiUrl } from "../config/api";
import ThemeToggle from "./ThemeToggle";

function displayName(user) {
  const name = `${user.first_name || ""} ${user.last_name || ""}`.trim();
  return name || user.email || "Unnamed user";
}

function ticketTitle(ticket) {
  return ticket.title?.trim() || "Untitled ticket";
}

function badgeClass(prefix, value) {
  return `badge ${prefix}-${String(value || "unset").replaceAll("_", "-")}`;
}

export default function MyTickets() {
  // Personal queue page shows tickets connected to the current user.
  const [tickets, setTickets] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadMyTickets();
  }, []);

  async function apiRequest(path) {
    const token = localStorage.getItem("jiraCloneToken");

    if (!token) {
      throw new Error("Your login session is missing. Return to the dashboard and log in again.");
    }

    const response = await fetch(apiUrl(path), {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      }
    });
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || "Request failed");
    }

    return data;
  }

  async function loadMyTickets() {
    setIsLoading(true);
    setMessage("");

    try {
      const [profileData, ticketData] = await Promise.all([
        // Load profile and personal tickets together.
        apiRequest("/auth/me"),
        apiRequest("/tickets/my")
      ]);

      setCurrentUser(profileData.user);
      setTickets(ticketData.tickets);
    } catch (error) {
      setMessage(error.message);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="ticket-detail-shell">
      <header className="ticket-detail-header">
        <div>
          <p className="dashboard-eyebrow">Personal queue</p>
          <h1>My tickets</h1>
          {currentUser ? <p>{displayName(currentUser)} - {currentUser.role}</p> : null}
        </div>
        <div className="header-actions">
          <ThemeToggle />
          <a className="secondary-action compact-link" href="/">Back to dashboard</a>
        </div>
      </header>

      {message ? <p className="dashboard-message">{message}</p> : null}

      <section className="my-ticket-list">
        {tickets.map((ticket) => (
          <article className="ticket-card my-ticket-card" key={ticket.id}>
            <div className="ticket-card-header">
              <a href={`/tickets/${ticket.id}`}>{ticket.ticket_key}</a>
              <span className={badgeClass("priority", ticket.priority)}>{ticket.priority}</span>
            </div>
            <h2>{ticketTitle(ticket)}</h2>
            <p>{ticket.description || "No description"}</p>
            <div className="ticket-meta-row">
              <span className={badgeClass("status", ticket.status)}>{ticket.status}</span>
              <span className={badgeClass("type", ticket.issue_type)}>{ticket.issue_type}</span>
            </div>
            <dl className="ticket-field-list compact-fields">
              <div><dt>Status</dt><dd>{ticket.status}</dd></div>
              <div><dt>Resolution</dt><dd>{ticket.resolution}</dd></div>
              <div><dt>Sprint</dt><dd>{ticket.sprint_name || ticket.sprint || "Not set"}</dd></div>
              <div><dt>Team</dt><dd>{ticket.scrum_team_name || ticket.scrum_team || "Not set"}</dd></div>
            </dl>
          </article>
        ))}

        {!isLoading && !message && tickets.length === 0 ? (
          <p className="empty-column">No tickets are assigned to you, owned by you, or reported by you.</p>
        ) : null}
      </section>
    </main>
  );
}
