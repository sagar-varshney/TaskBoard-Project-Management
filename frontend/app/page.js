"use client";

import { useEffect, useState } from "react";
import AuthForm from "./components/AuthForm";
import Dashboard from "./components/Dashboard";
import ThemeToggle from "./components/ThemeToggle";
import { apiUrl } from "./config/api";

export default function HomePage() {
  // This page owns the authentication state. Once logged in, it renders the dashboard.
  const [mode, setMode] = useState("login");
  const [message, setMessage] = useState("");
  const [token, setToken] = useState("");
  const [currentUser, setCurrentUser] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // Keeps the user logged in after refresh by reusing the saved JWT.
    const savedToken = localStorage.getItem("jiraCloneToken");

    if (savedToken) {
      setToken(savedToken);
      loadProfile(savedToken);
    }
  }, []);

  async function submitAuth(formValues) {
    setIsLoading(true);
    setMessage("");
    setCurrentUser(null);

    const endpoint = mode === "login" ? "/auth/login" : "/auth/register";
    // Login/register share one form; the current mode chooses the backend endpoint.
    const response = await fetch(apiUrl(endpoint), {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(formValues)
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || "Authentication failed");
    }

    localStorage.setItem("jiraCloneToken", data.token);
    setToken(data.token);
    setCurrentUser(data.user);
    setMessage(data.message);
  }

  async function handleSubmit(formValues) {
    try {
      await submitAuth(formValues);
    } catch (error) {
      setMessage(error.message);
    } finally {
      setIsLoading(false);
    }
  }

  async function loadProfile(providedToken) {
    const savedToken =
      typeof providedToken === "string"
        ? providedToken
        : token || localStorage.getItem("jiraCloneToken");

    if (!savedToken) {
      setMessage("Login or register first to get a JWT token.");
      return;
    }

    setIsLoading(true);
    setMessage("");

    try {
      const response = await fetch(apiUrl("/auth/me"), {
        headers: {
          // This is how the frontend sends the JWT to protected backend routes.
          Authorization: `Bearer ${savedToken}`
        }
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Could not load profile");
      }

      setCurrentUser(data.user);
      setMessage("Protected profile loaded successfully.");
    } catch (error) {
      setMessage(error.message);
    } finally {
      setIsLoading(false);
    }
  }

  async function logout() {
    const savedToken = token || localStorage.getItem("jiraCloneToken");

    if (savedToken) {
      try {
        await fetch(apiUrl("/auth/logout"), {
          method: "POST",
          headers: {
            Authorization: `Bearer ${savedToken}`
          }
        });
      } catch (error) {
        console.error("Logout request failed", error);
      }
    }

    localStorage.removeItem("jiraCloneToken");
    setToken("");
    setCurrentUser(null);
    setMessage("");
  }

  if (currentUser && token) {
    return <Dashboard token={token} user={currentUser} onLogout={logout} />;
  }

  return (
    <main className="auth-page">
      <section className="brand-panel" aria-label="TaskBoard overview">
        <div className="brand-mark">TB</div>
        <div>
          <p className="eyebrow">TaskBoard</p>
          <h1>Plan, track, and ship team work with clarity.</h1>
          <p className="intro">
            A focused workspace for project tickets, sprint planning, attachment reviews,
            and AI-assisted updates across every delivery lane.
          </p>
        </div>
        <div className="brand-stats" aria-label="TaskBoard capabilities">
          <span>Kanban board</span>
          <span>Role-aware workflows</span>
          <span>AI ticket assistant</span>
        </div>
      </section>

      <section className="auth-panel" aria-label="Authentication form">
        <div className="auth-topline">
          <span>TaskBoard</span>
          <ThemeToggle />
        </div>

        <div className="auth-heading">
          <p className="dashboard-eyebrow">Secure workspace</p>
          <h2>{mode === "login" ? "Welcome back" : "Create your account"}</h2>
          <p>{mode === "login" ? "Sign in to continue to your board." : "Join the workspace and start tracking delivery work."}</p>
        </div>

        <div className="mode-switch" role="tablist" aria-label="Auth mode">
          <button
            className={mode === "login" ? "active" : ""}
            type="button"
            onClick={() => setMode("login")}
          >
            Login
          </button>
          <button
            className={mode === "register" ? "active" : ""}
            type="button"
            onClick={() => setMode("register")}
          >
            Register
          </button>
        </div>

        <AuthForm mode={mode} isLoading={isLoading} onSubmit={handleSubmit} />

        {message ? <p className="status-message">{message}</p> : null}
      </section>
    </main>
  );
}
