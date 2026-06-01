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
  const isRegister = mode === "register";

  function updateField(event) {
    const { name, value } = event.target;
    setFormValues((currentValues) => ({
      ...currentValues,
      [name]: value
    }));
  }

  function handleSubmit(event) {
    event.preventDefault();

    const payload = {
      email: formValues.email,
      password: formValues.password
    };

    if (isRegister) {
      payload.firstName = formValues.firstName;
      payload.lastName = formValues.lastName;
    }

    onSubmit(payload);
  }

  return (
    <form className="auth-form" onSubmit={handleSubmit}>
      <label>
        Email
        <input
          name="email"
          type="email"
          placeholder="you@example.com"
          value={formValues.email}
          onChange={updateField}
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

      <button className="primary-action" type="submit" disabled={isLoading}>
        {isLoading ? "Please wait..." : isRegister ? "Create account" : "Log in"}
      </button>
    </form>
  );
}
