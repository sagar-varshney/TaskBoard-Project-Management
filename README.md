# TaskBoard Project Management

TaskBoard is a full-stack project management application inspired by Jira. It supports authenticated workspaces, role-aware project planning, ticket tracking, sprint and team management, attachment collaboration, and AI-assisted ticket workflows.

## Project Overview

TaskBoard is designed for teams that need a compact issue-tracking workflow without losing the structure of a larger project management system. Users can register, log in, create projects, manage tickets, assign work, track ticket status, add comments, upload supporting files, and inspect ticket activity.

Core capabilities include:

- JWT-based authentication with login, registration, logout, and current-user profile endpoints.
- Role-based access for `admin`, `developer`, and `member` users.
- Project, sprint, scrum team, and ticket management.
- Kanban-style ticket tracking across `todo`, `in_progress`, and `done`.
- Ticket detail pages with comments, activity history, assignments, impact notes, and fix plans.
- Attachment uploads with categories, tags, versions, attachment comments, download routes, and AI analysis history.
- AI-assisted workflows through Gemini, Groq, and a LangGraph-powered TaskBoard agent.
- Structured request, audit, and error logging for debugging and production observability.

## Live Implementation

| Service | URL |
| --- | --- |
| Frontend | [https://taskboard-frontend.vercel.app](https://taskboard-frontend.vercel.app) |
| Backend API | [https://taskboard-api.vercel.app](https://taskboard-api.vercel.app) |

The backend exposes API routes under `/api`, including `/api/health`, `/api/docs`, and `/api/openapi.json`.

## Tech Stack & Design Decisions

| Area | Technology |
| --- | --- |
| Frontend | Next.js 15, React 19, CSS modules/global CSS |
| Backend | Node.js 22, Express.js |
| Database | MySQL, `mysql2` connection pool |
| Authentication | JWT, bcrypt password hashing, token versioning |
| Authorization | Backend role middleware with `admin`, `developer`, and `member` roles |
| AI | Google Gemini, Groq, LangGraph.js |
| File Storage | Local filesystem for development, Cloudflare R2 for production object storage |
| Deployment | Vercel frontend project and Vercel Node backend project |
| Observability | Structured JSON logs, request IDs, audit logs, sanitized error logs |

Key design decisions:

- The backend remains the source of truth for authorization. Frontend UI checks improve user experience, but protected Express routes still enforce role permissions.
- Ticket data and attachment metadata live in MySQL, while binary attachment content is stored either locally or in Cloudflare R2.
- The backend validates production-critical environment variables at startup so deployment problems fail early.
- JWT payloads stay small; role and account state are loaded from the database on protected requests.
- Token versioning allows logout/session revocation without storing every issued token.
- The API includes generated OpenAPI-style documentation so the backend can be tested independently from the UI.

## System Architecture

```text
Browser
  |
  | Next.js pages and client components
  v
TaskBoard Frontend
  |
  | HTTPS requests with JWT bearer token
  v
Express Backend API
  |
  | Auth middleware, role middleware, controllers
  v
Service Layer
  |
  | MySQL queries, AI calls, object storage operations
  v
MySQL Database + Cloudflare R2 or Local Uploads
```

Main request flow:

1. A user logs in or registers through the Next.js frontend.
2. The backend hashes passwords with bcrypt and returns a signed JWT.
3. The frontend stores the JWT in browser storage and sends it as `Authorization: Bearer <token>` on protected API calls.
4. Express middleware verifies the token, checks token versioning, loads the current user, and applies role-based access rules.
5. Controllers handle project, ticket, comment, sprint, team, attachment, and AI-agent requests.
6. MySQL stores structured application data. Attachment bytes are stored locally in development or in Cloudflare R2 for deployment.

## **Directory Structure**

```text
.
├── database/
│   ├── schema.sql
│   └── migrations/
├── docs/
│   ├── debugging-api.md
│   ├── debugging-bug-report.md
│   ├── llm-api-options.md
│   ├── logging.md
│   └── website-qa-defects.md
├── frontend/
│   ├── app/
│   │   ├── admin/
│   │   ├── components/
│   │   ├── config/
│   │   ├── my-tickets/
│   │   └── tickets/
│   ├── next.config.js
│   ├── package.json
│   └── vercel.json
├── manual-test-assets/
├── scripts/
│   └── migrate-attachments-to-r2.js
├── src/
│   ├── config/
│   ├── controllers/
│   ├── docs/
│   ├── middleware/
│   ├── routes/
│   ├── services/
│   ├── utils/
│   ├── app.js
│   └── server.js
├── package.json
└── vercel.json
```

Important folders:

- `frontend/app`: Next.js App Router pages and reusable UI components.
- `src/routes`: Express route definitions grouped by feature area.
- `src/controllers`: Request handlers for auth, projects, tickets, users, attachments, teams, sprints, and the agent.
- `src/services`: Business logic for AI and storage integrations.
- `src/middleware`: Authentication, authorization, and request logging middleware.
- `database`: Initial schema and incremental SQL migrations.
- `docs`: Debugging, logging, QA, and AI-provider notes.

## Attachment Storage

TaskBoard separates attachment metadata from attachment bytes.

MySQL stores:

- Ticket relationship.
- Uploading user.
- File name, MIME type, and file size.
- Category and tags.
- Version group and version number.
- Storage provider and object key/path.
- AI summary and extracted text.
- Attachment comments and analysis history.

File bytes can be stored in two ways:

- `local`: stores files under `LOCAL_UPLOAD_ROOT`, intended for local development.
- `r2`: stores files in a Cloudflare R2 bucket, intended for production/deployed environments.

The backend supports two upload patterns:

- Standard multipart upload through `POST /api/tickets/:id/attachments`.
- Direct object-storage upload through presigned R2 URLs using `/presign` and `/complete` endpoints.

To migrate local attachments to R2:

```bash
npm run migrate:attachments:r2
```

## Database Overview

The application uses MySQL with foreign keys and indexes across the main workflow tables.

| Table | Purpose |
| --- | --- |
| `users` | Account records, password hashes, roles, token versions, soft deletion |
| `projects` | Project workspaces with readable project keys |
| `sprints` | Sprint planning records scoped to projects |
| `scrum_teams` | Team records scoped to projects |
| `scrum_team_members` | Many-to-many relationship between teams and users |
| `issues` | Main ticket table for title, status, priority, ownership, sprint, team, impact, and fix plan |
| `issue_comments` | Ticket-level comments with soft deletion |
| `issue_attachments` | Attachment metadata, storage references, versioning, and AI summary fields |
| `issue_attachment_comments` | Comments on specific attachments |
| `issue_attachment_analyses` | Saved AI analysis history for attachments |
| `issue_activity` | Ticket audit timeline for field and workflow changes |

Fresh database setup uses `database/schema.sql`. Existing databases can be upgraded by running files in `database/migrations/` in numeric order.

## **Configuration & Environment Variables**

Create backend and frontend environment files from the examples:

```bash
cp .env.example .env
cp frontend/.env.local.example frontend/.env.local
```

Backend variables:

| Variable | Purpose |
| --- | --- |
| `PORT` | Local Express port, usually `5001` |
| `NODE_ENV` | Runtime environment, for example `development` or `production` |
| `FRONTEND_URL` | Public frontend URL used by CORS/default links |
| `BACKEND_URL` | Public backend URL used in generated API docs |
| `CORS_ORIGINS` | Comma-separated list of allowed browser origins |
| `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` | MySQL connection settings |
| `DB_SSL` | Enables SSL for hosted MySQL databases |
| `DB_SSL_REJECT_UNAUTHORIZED` | Controls certificate validation for SSL database connections |
| `DB_SSL_CA` | Optional CA certificate text for managed MySQL providers |
| `JWT_SECRET` | Secret used to sign and verify JWTs |
| `JWT_EXPIRES_IN` | JWT lifetime, for example `1d` |
| `GEMINI_API_KEY`, `GEMINI_MODEL` | Gemini integration settings |
| `GROQ_API_KEY`, `GROQ_MODEL` | Groq fallback/integration settings |
| `STORAGE_PROVIDER` | `local` or `r2` |
| `LOCAL_UPLOAD_ROOT` | Local upload directory for development |
| `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET` | Cloudflare R2 configuration |
| `LOG_DIR` | Directory for JSON log files |
| `LOG_TO_CONSOLE` | Enables console logging when `true` |
| `LOG_REQUEST_BODY` | Includes sanitized request bodies in logs when `true` |

Frontend variable:

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_API_GATEWAY_URL` | Backend API base URL, for example `http://localhost:5001/api` |

Never commit real `.env`, `.env.local`, database credentials, JWT secrets, AI keys, R2 keys, or Vercel project metadata.

## **Installation & Local Development**

Prerequisites:

- Node.js 22.x
- npm
- MySQL 8-compatible database

Install backend dependencies:

```bash
npm install
```

Install frontend dependencies:

```bash
cd frontend
npm install
cd ..
```

Create environment files:

```bash
cp .env.example .env
cp frontend/.env.local.example frontend/.env.local
```

Create a fresh local database:

```bash
mysql -u root -p < database/schema.sql
```

For an existing database, run migrations in order:

```bash
mysql -u root -p jira_clone < database/migrations/001_add_roles_and_soft_delete.sql
mysql -u root -p jira_clone < database/migrations/002_add_ticket_details_and_comments.sql
mysql -u root -p jira_clone < database/migrations/003_add_ticket_operations.sql
mysql -u root -p jira_clone < database/migrations/004_add_token_version_to_users.sql
mysql -u root -p jira_clone < database/migrations/005_add_issue_attachments.sql
mysql -u root -p jira_clone < database/migrations/006_add_r2_attachment_storage.sql
mysql -u root -p jira_clone < database/migrations/007_improve_attachment_collaboration.sql
```

Run the backend:

```bash
npm run dev
```

Run the frontend in a second terminal:

```bash
cd frontend
npm run dev
```

Local URLs:

| Service | URL |
| --- | --- |
| Frontend | `http://localhost:3000` |
| Backend | `http://localhost:5001` |
| API docs | `http://localhost:5001/api/docs` |
| OpenAPI JSON | `http://localhost:5001/api/openapi.json` |

## **API Reference**

The backend serves interactive API documentation at:

```text
/api/docs
```

It also serves a machine-readable OpenAPI document at:

```text
/api/openapi.json
```

Primary route groups:

| Method | Endpoint | Description | Auth |
| --- | --- | --- | --- |
| `GET` | `/api/health` | Health check | Public |
| `POST` | `/api/auth/register` | Register a user | Public |
| `POST` | `/api/auth/login` | Log in and receive a JWT | Public |
| `POST` | `/api/auth/logout` | Revoke current session | JWT |
| `GET` | `/api/auth/me` | Read current user profile | JWT |
| `GET` | `/api/projects` | List projects | JWT |
| `POST` | `/api/projects` | Create a project | Admin |
| `GET` | `/api/sprints` | List sprints | JWT |
| `POST` | `/api/sprints` | Create a sprint | Admin |
| `GET` | `/api/teams` | List scrum teams | JWT |
| `POST` | `/api/teams` | Create a scrum team | Admin |
| `GET` | `/api/users` | List active users | JWT |
| `GET` | `/api/tickets` | List tickets | JWT |
| `GET` | `/api/tickets/my` | List tickets related to current user | JWT |
| `POST` | `/api/tickets` | Create a ticket | JWT |
| `GET` | `/api/tickets/:id` | Read ticket details | JWT |
| `PATCH` | `/api/tickets/:id` | Update ticket fields | JWT |
| `GET` | `/api/tickets/:id/activity` | List ticket activity | JWT |
| `POST` | `/api/tickets/:id/ai-summary` | Generate an AI ticket summary | Admin |
| `GET` | `/api/tickets/:id/comments` | List ticket comments | JWT |
| `POST` | `/api/tickets/:id/comments` | Add ticket comment | JWT |
| `PATCH` | `/api/tickets/:id/comments/:commentId` | Update ticket comment | JWT |
| `DELETE` | `/api/tickets/:id/comments/:commentId` | Delete ticket comment | JWT |
| `GET` | `/api/tickets/:id/attachments` | List ticket attachments | JWT |
| `POST` | `/api/tickets/:id/attachments` | Upload an attachment through API | JWT |
| `POST` | `/api/tickets/:id/attachments/presign` | Create direct-upload URL | JWT |
| `POST` | `/api/tickets/:id/attachments/complete` | Complete direct upload | JWT |
| `GET` | `/api/tickets/:id/attachments/:attachmentId/download` | Download attachment | JWT |
| `POST` | `/api/tickets/:id/attachments/:attachmentId/analyze` | Analyze attachment with AI | JWT |
| `GET` | `/api/tickets/:id/attachments/:attachmentId/analyses` | List attachment analyses | JWT |
| `GET` | `/api/tickets/:id/attachments/:attachmentId/comments` | List attachment comments | JWT |
| `POST` | `/api/tickets/:id/attachments/:attachmentId/comments` | Add attachment comment | JWT |
| `DELETE` | `/api/tickets/:id/attachments/:attachmentId` | Delete attachment | JWT |
| `POST` | `/api/agent/chat` | Chat with the TaskBoard agent | JWT |

The API also mounts `/api/issues` as an authenticated route group for issue-oriented workflows. The frontend primarily uses the `/api/tickets` route group.

## **Security Implementation**

Security controls include:

- Password hashing with bcrypt before storage.
- JWT authentication for protected routes.
- Token versioning to invalidate old tokens after logout/session revocation.
- Soft-deleted users are blocked even if they still have a previously valid token.
- Backend role checks for restricted actions such as project creation, sprint creation, team creation, and AI summaries.
- CORS allow-list controlled by `CORS_ORIGINS`.
- Request body size limit for JSON payloads.
- Attachment file size limit of 8 MB.
- Environment validation in production for required secrets and database settings.
- Sanitized structured logging that redacts sensitive keys such as authorization headers, passwords, tokens, secrets, and API keys.
- Attachment downloads are served through authenticated backend routes rather than exposing raw local paths.
- R2 direct uploads use short-lived presigned URLs.

## **Deployment Strategy**

The project is split into two deployable Vercel projects:

- `frontend/`: Next.js frontend deployed as a Vercel Next.js app.
- root backend: Express API deployed with `@vercel/node`.

Frontend deployment:

- Uses `frontend/vercel.json`.
- Runs `npm run build`.
- Requires `NEXT_PUBLIC_API_GATEWAY_URL` to point to the deployed backend API base URL.

Backend deployment:

- Uses root `vercel.json`.
- Routes all requests to `src/app.js`.
- Requires production database, JWT, CORS, AI, logging, and storage environment variables.
- Should use Cloudflare R2 for persistent attachment storage because serverless filesystems are not reliable for durable uploads.

Recommended production settings:

```env
NODE_ENV=production
STORAGE_PROVIDER=r2
DB_SSL=true
BACKEND_URL=https://taskboard-api.vercel.app
FRONTEND_URL=https://taskboard-frontend.vercel.app
CORS_ORIGINS=https://taskboard-frontend.vercel.app
```

## **Testing & Quality Assurance**

Current validation practices:

- Frontend production build with `npm run build` from `frontend/`.
- Backend startup validation through environment parsing and database connection checks.
- Manual API testing through `/api/docs`, `/api/openapi.json`, and documented curl/debug flows.
- Manual browser QA for authentication, dashboard loading, ticket creation, comments, role-specific actions, attachment flows, and responsive UI.
- Structured logs in `logs/app.log`, `logs/audit.log`, and `logs/error.log` during local development.
- QA notes and known defect tracking in `docs/website-qa-defects.md`.

Useful commands:

```bash
cd frontend
npm run build
```

```bash
npm run dev
```

```bash
cd frontend
npm run dev
```

There is no dedicated automated backend test suite in the current repository. The next quality step would be adding route-level integration tests for authentication, ticket permissions, attachment flows, and role-restricted endpoints.
