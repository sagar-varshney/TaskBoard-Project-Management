"use client";

import { useState } from "react";

const initialValues = {
  email: "",
  password: "",
  firstName: "",
  lastName: ""
};

export default function AuthForm({ mode, isLoading, onSubmit }) {
  const [formValues, setFormValues] = useState(initialValues);
  const [formError, setFormError] = useState("");
  const isRegister = mode === "register";

  function updateField(event) {
    // Controlled inputs: React state is the source of truth for all form values.
    const { name, value } = event.target;
    setFormValues((currentValues) => ({
      ...currentValues,
      [name]: value
    }));
  }

  function handleSubmit(event) {
    event.preventDefault();
    setFormError("");

    if (!formValues.email.trim()) {
      setFormError("Email is required.");
      return;
    }

    if (!formValues.password) {
      setFormError("Password is required.");
      return;
    }

    if (isRegister && (!formValues.firstName.trim() || !formValues.lastName.trim())) {
      setFormError("First name and last name cannot be blank.");
      return;
    }

    // Login sends only email/password. Register adds firstName/lastName.
    const payload = {
      email: formValues.email.trim(),
      password: formValues.password
    };

    if (isRegister) {
      payload.firstName = formValues.firstName.trim();
      payload.lastName = formValues.lastName.trim();
    }

    onSubmit(payload);
  }

  return (
    <form className="auth-form" autoComplete="off" onSubmit={handleSubmit}>
      <label>
        Email
        <input
          name="email"
          type="email"
          placeholder="you@example.com"
          value={formValues.email}
          onChange={updateField}
          autoComplete="off"
          required
        />
      </label>

      <label>
        Password
        <input
          name="password"
          type="password"
          placeholder="Minimum 8 characters"
          value={formValues.password}
          onChange={updateField}
          autoComplete="off"
          minLength={8}
          required
        />
      </label>

      {isRegister ? (
        <div className="name-grid">
          <label>
            First name
            <input
              name="firstName"
              type="text"
              placeholder="samplename"
              value={formValues.firstName}
              onChange={updateField}
              required
            />
          </label>

          <label>
            Last name
            <input
              name="lastName"
              type="text"
              placeholder="testname"
              value={formValues.lastName}
              onChange={updateField}
              required
            />
          </label>
        </div>
      ) : null}

      {formError ? <p className="dashboard-message error-message">{formError}</p> : null}

      <button className="primary-action" type="submit" disabled={isLoading}>
        {isLoading ? "Please wait..." : isRegister ? "Create account" : "Log in"}
      </button>
    </form>
  );
}
