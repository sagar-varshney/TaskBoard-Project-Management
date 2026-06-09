"use client";

import { useEffect, useMemo, useState } from "react";

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:5001/api";

export default function MyTickets() {
  // Personal queue page shows tickets connected to the current user.
  const [tickets, setTickets] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const token = typeof window !== "undefined" ? localStorage.getItem("jiraCloneToken") : "";

  const authHeaders = useMemo(
    () => ({
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    }),
    [token]
  );

  useEffect(() => {
    loadMyTickets();
  }, []);

  async function apiRequest(path) {
    const response = await fetch(`${apiBaseUrl}${path}`, {
      headers: authHeaders
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
          {currentUser ? <p>{currentUser.first_name} {currentUser.last_name} - {currentUser.role}</p> : null}
        </div>
        <a className="secondary-action compact-link" href="/">Back to dashboard</a>
      </header>

      {message ? <p className="dashboard-message">{message}</p> : null}

      <section className="my-ticket-list">
        {tickets.map((ticket) => (
          <article className="ticket-card my-ticket-card" key={ticket.id}>
            <div className="ticket-card-header">
              <a href={`/tickets/${ticket.id}`}>{ticket.ticket_key}</a>
              <small>{ticket.priority}</small>
            </div>
            <h2>{ticket.title}</h2>
            <p>{ticket.description || "No description"}</p>
            <dl className="ticket-field-list compact-fields">
              <div><dt>Status</dt><dd>{ticket.status}</dd></div>
              <div><dt>Resolution</dt><dd>{ticket.resolution}</dd></div>
              <div><dt>Sprint</dt><dd>{ticket.sprint_name || ticket.sprint || "Not set"}</dd></div>
              <div><dt>Team</dt><dd>{ticket.scrum_team_name || ticket.scrum_team || "Not set"}</dd></div>
            </dl>
          </article>
        ))}

        {!isLoading && tickets.length === 0 ? (
          <p className="empty-column">No tickets are assigned to you, owned by you, or reported by you.</p>
        ) : null}
      </section>
    </main>
  );
}
