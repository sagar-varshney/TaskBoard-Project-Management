# TaskBoard

TaskBoard is a JIRA-inspired project management application with authentication, role-based ticket workflows, sprint/team management, attachment collaboration, and AI-assisted ticket triage.

## Highlights

- JWT authentication with bcrypt password hashing
- Role-based access for `admin`, `developer`, and `member`
- Ticket dashboard with status-based workflow columns
- Ticket detail pages with comments, activity history, assignment, impact, and fix plan
- Sprint and scrum team management
- Attachment upload, preview, comments, categories, tags, versioning, and AI analysis history
- Cloudflare R2 object storage support for deployment-friendly file handling
- LangGraph-powered assistant for approved ticket read/write actions
- Gemini and Groq integration for AI-assisted workflows

## Tech Stack

| Area | Technology |
| --- | --- |
| Frontend | Next.js 15, React, CSS |
| Backend | Node.js, Express.js |
| Database | MySQL, `mysql2` |
| Authentication | JWT, bcrypt |
| AI | Gemini, Groq |
| Agent | LangGraph.js |
| File Storage | Local storage or Cloudflare R2 |

## Roles

| Role | Summary |
| --- | --- |
| `admin` | Full workspace control, including project planning, delegation, sprints, teams, and AI summaries |
| `developer` | Can create tickets, update work progress, comment, and help manage attachments |
| `member` | Can create and comment on tickets, with limited work updates when delegated |

Backend authorization enforces role rules even if a request is made outside the frontend.

## Project Structure

```text
database/
  schema.sql
  migrations/

src/
  config/
  controllers/
  middleware/
  routes/
  services/
  utils/
  app.js
  server.js

frontend/
  app/
    admin/
    components/
    my-tickets/
    tickets/
```

## Setup

### Backend

```bash
npm install
cp .env.example .env
```

Update `.env` with your local MySQL credentials, JWT secret, and optional AI/storage keys.

Create a fresh database:

```bash
mysql -u root -p < database/schema.sql
```

For an existing database, run migrations in order:

```bash
mysql -u root -p < database/migrations/001_add_roles_and_soft_delete.sql
mysql -u root -p < database/migrations/002_add_ticket_details_and_comments.sql
mysql -u root -p < database/migrations/003_add_ticket_operations.sql
mysql -u root -p < database/migrations/004_add_token_version_to_users.sql
mysql -u root -p < database/migrations/005_add_issue_attachments.sql
mysql -u root -p < database/migrations/006_add_r2_attachment_storage.sql
mysql -u root -p < database/migrations/007_improve_attachment_collaboration.sql
```

Start the backend:

```bash
npm run dev
```

Backend runs on:

```text
http://localhost:5001
```

### Frontend

```bash
cd frontend
npm install
cp .env.local.example .env.local
npm run dev
```

Frontend runs on:

```text
http://localhost:3000
```

## Environment

Backend `.env` uses these values:

```env
PORT=5001
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=jira_clone

JWT_SECRET=replace_with_a_long_random_secret
JWT_EXPIRES_IN=1d

GEMINI_API_KEY=your_gemini_api_key
GEMINI_MODEL=gemini-2.5-flash-lite

GROQ_API_KEY=your_groq_api_key
GROQ_MODEL=openai/gpt-oss-20b

STORAGE_PROVIDER=local
R2_ACCOUNT_ID=your_cloudflare_account_id
R2_ACCESS_KEY_ID=your_r2_access_key_id
R2_SECRET_ACCESS_KEY=your_r2_secret_access_key
R2_BUCKET=taskboard-attachments
```

Frontend `.env.local`:

```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:5001/api
```

Never commit real `.env` files.

## Attachment Storage

TaskBoard separates file metadata from file content:

- MySQL stores attachment metadata, ownership, ticket relationship, category, tags, version, comments, AI history, and the storage object key.
- Cloudflare R2 stores the actual uploaded file bytes.
- The backend controls access to files through authenticated routes.

For local development, use:

```env
STORAGE_PROVIDER=local
```

For R2-backed uploads, configure the `R2_*` values and use:

```env
STORAGE_PROVIDER=r2
```

To migrate existing local attachments to R2:

```bash
npm run migrate:attachments:r2
```

## Database Overview

Core tables include:

| Table | Purpose |
| --- | --- |
| `users` | Accounts, roles, token versioning, and soft deletion |
| `projects` | Project workspaces |
| `issues` | Tickets and planning fields |
| `sprints` | Sprint planning |
| `scrum_teams` | Team records |
| `scrum_team_members` | Team membership |
| `issue_comments` | Ticket comments |
| `issue_attachments` | Attachment metadata and storage references |
| `issue_attachment_comments` | Comments tied to a specific attachment |
| `issue_attachment_analyses` | Saved AI analysis history |
| `issue_activity` | Ticket audit timeline |

## Development Notes

- Run backend and frontend in separate terminals.
- Keep secrets in `.env` and `frontend/.env.local`.
- Use migrations for database changes after the initial schema is created.
- Backend role checks are the source of truth; frontend permissions are only for user experience.
- Attachment files should be stored in object storage for deployment rather than inside MySQL.
