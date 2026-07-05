const { config } = require("../config/env");

const bearerAuth = [{ bearerAuth: [] }];

const endpointGroups = [
  {
    tag: "Health",
    endpoints: [
      ["get", "/api/health", "Check API health", false]
    ]
  },
  {
    tag: "Authentication",
    endpoints: [
      ["post", "/api/auth/register", "Register a user", false],
      ["post", "/api/auth/login", "Log in and receive a JWT", false],
      ["post", "/api/auth/logout", "Revoke the current JWT session", true],
      ["get", "/api/auth/me", "Read the current user profile", true]
    ]
  },
  {
    tag: "Workspace",
    endpoints: [
      ["get", "/api/projects", "List projects", true],
      ["post", "/api/projects", "Create a project", true],
      ["get", "/api/sprints", "List sprints", true],
      ["post", "/api/sprints", "Create a sprint", true],
      ["get", "/api/teams", "List scrum teams", true],
      ["post", "/api/teams", "Create a scrum team", true],
      ["get", "/api/users", "List active users", true]
    ]
  },
  {
    tag: "Tickets",
    endpoints: [
      ["get", "/api/tickets", "List tickets", true],
      ["get", "/api/tickets/my", "List tickets related to current user", true],
      ["post", "/api/tickets", "Create a ticket", true],
      ["get", "/api/tickets/{id}", "Read ticket details", true],
      ["patch", "/api/tickets/{id}", "Update ticket fields", true],
      ["get", "/api/tickets/{id}/activity", "List ticket activity", true],
      ["post", "/api/tickets/{id}/ai-summary", "Generate an AI ticket summary", true]
    ]
  },
  {
    tag: "Comments",
    endpoints: [
      ["get", "/api/tickets/{id}/comments", "List ticket comments", true],
      ["post", "/api/tickets/{id}/comments", "Add a ticket comment", true],
      ["patch", "/api/tickets/{id}/comments/{commentId}", "Update a ticket comment", true],
      ["delete", "/api/tickets/{id}/comments/{commentId}", "Delete a ticket comment", true]
    ]
  },
  {
    tag: "Attachments",
    endpoints: [
      ["get", "/api/tickets/{id}/attachments", "List ticket attachments", true],
      ["post", "/api/tickets/{id}/attachments", "Upload an attachment through the API", true],
      ["post", "/api/tickets/{id}/attachments/presign", "Create a direct-upload URL", true],
      ["post", "/api/tickets/{id}/attachments/complete", "Complete a direct upload", true],
      ["get", "/api/tickets/{id}/attachments/{attachmentId}/download", "Download an attachment", true],
      ["post", "/api/tickets/{id}/attachments/{attachmentId}/analyze", "Analyze an attachment with AI", true],
      ["get", "/api/tickets/{id}/attachments/{attachmentId}/analyses", "List attachment analyses", true],
      ["get", "/api/tickets/{id}/attachments/{attachmentId}/comments", "List attachment comments", true],
      ["post", "/api/tickets/{id}/attachments/{attachmentId}/comments", "Add an attachment comment", true],
      ["delete", "/api/tickets/{id}/attachments/{attachmentId}", "Delete an attachment", true]
    ]
  },
  {
    tag: "Agent",
    endpoints: [
      ["post", "/api/agent/chat", "Ask the TaskBoard agent to inspect or update work", true]
    ]
  }
];

function response(description) {
  return {
    description,
    content: {
      "application/json": {
        schema: {
          type: "object"
        }
      }
    }
  };
}

function operation(method, path, summary, secured, tag) {
  const parameters = Array.from(path.matchAll(/\{([^}]+)\}/g)).map((match) => ({
    name: match[1],
    in: "path",
    required: true,
    schema: {
      type: "string"
    }
  }));

  return {
    [method]: {
      tags: [tag],
      summary,
      security: secured ? bearerAuth : [],
      parameters,
      responses: {
        200: response("Successful response"),
        400: response("Invalid request"),
        401: response("Authentication required"),
        403: response("Permission denied"),
        404: response("Resource not found"),
        500: response("Server error")
      }
    }
  };
}

function getOpenApiDocument() {
  const paths = {};

  endpointGroups.forEach((group) => {
    group.endpoints.forEach(([method, path, summary, secured]) => {
      paths[path] = {
        ...(paths[path] || {}),
        ...operation(method, path, summary, secured, group.tag)
      };
    });
  });

  return {
    openapi: "3.0.3",
    info: {
      title: config.app.name,
      version: config.app.version,
      description: "TaskBoard REST API for authentication, projects, tickets, comments, attachments, and agent workflows."
    },
    servers: [
      {
        url: config.app.publicUrl || `http://localhost:${config.app.port}`,
        description: config.app.environment
      }
    ],
    tags: endpointGroups.map((group) => ({
      name: group.tag
    })),
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT"
        }
      }
    },
    paths
  };
}

function getApiDocsHtml() {
  const rows = endpointGroups
    .map((group) => `
      <section>
        <h2>${group.tag}</h2>
        ${group.endpoints
          .map(([method, path, summary, secured]) => `
            <article>
              <code class="method ${method}">${method.toUpperCase()}</code>
              <code>${path}</code>
              <span>${summary}</span>
              ${secured ? "<b>JWT</b>" : "<b>Public</b>"}
            </article>
          `)
          .join("")}
      </section>
    `)
    .join("");

  return `<!doctype html>
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>${config.app.name} Docs</title>
        <style>
          body { background: #f4f6f8; color: #101828; font-family: Inter, system-ui, sans-serif; margin: 0; padding: 32px; }
          main { margin: 0 auto; max-width: 1040px; }
          header, section { background: #fff; border: 1px solid #d9e2ec; margin-bottom: 16px; padding: 20px; }
          h1, h2, p { margin-top: 0; }
          p { color: #667085; line-height: 1.5; }
          article { align-items: center; border-top: 1px solid #eef2f6; display: grid; gap: 12px; grid-template-columns: 80px minmax(220px, 1fr) 1.3fr 70px; padding: 12px 0; }
          code { background: #eef3f8; border-radius: 6px; padding: 5px 7px; }
          b { color: #344054; font-size: 12px; text-transform: uppercase; }
          .method { color: #fff; text-align: center; }
          .get { background: #147a55; }
          .post { background: #1d5fd0; }
          .patch { background: #b75e00; }
          .delete { background: #b42318; }
          a { color: #174ea6; font-weight: 700; }
          @media (max-width: 760px) { body { padding: 14px; } article { grid-template-columns: 1fr; } }
        </style>
      </head>
      <body>
        <main>
          <header>
            <h1>${config.app.name}</h1>
            <p>Version ${config.app.version}. Environment: ${config.app.environment}. Use <a href="/api/openapi.json">/api/openapi.json</a> for machine-readable OpenAPI.</p>
          </header>
          ${rows}
        </main>
      </body>
    </html>`;
}

module.exports = {
  getApiDocsHtml,
  getOpenApiDocument
};
