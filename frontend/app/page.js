"use client";

import { useEffect, useState } from "react";
import AuthForm from "./components/AuthForm";
import Dashboard from "./components/Dashboard";

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:5001/api";

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
    const response = await fetch(`${apiBaseUrl}${endpoint}`, {
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
      const response = await fetch(`${apiBaseUrl}/auth/me`, {
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

  function logout() {
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
        <div className="brand-mark">T</div>
        <div>
          <p className="eyebrow">TaskBoard</p>
          <h1>Account access for your project workspace</h1>
          <p className="intro">
            Register a user, log in with email and password, and verify the JWT
            protected profile route from the same screen.
          </p>
        </div>
      </section>

      <section className="auth-panel" aria-label="Authentication form">
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

        <button className="secondary-action" type="button" onClick={loadProfile}>
          Check protected route
        </button>

        {message ? <p className="status-message">{message}</p> : null}

        {currentUser ? (
          <div className="result-panel">
            <p className="result-title">Current user</p>
            <pre>{JSON.stringify(currentUser, null, 2)}</pre>
          </div>
        ) : null}
      </section>
    </main>
  );
}
