# TaskBoard

TaskBoard is a JIRA-inspired project management application with JWT authentication, role-based workflows, ticket collaboration, sprint/team management, activity history, and Gemini-powered ticket insights.

## Features

- Register/login with JWT authentication and bcrypt password hashing
- MySQL schema with user soft deletion
- Role-specific experiences for `admin`, `developer`, and `member`
- Project and ticket creation
- Kanban-style ticket dashboard
- Linked ticket detail pages
- Assignee and owner delegation
- Sprint and scrum team management
- Ticket comments with edit, delete, and internal-note support
- Ticket activity history
- Personal My Tickets queue
- Admin-only Gemini ticket insights
- LangGraph agent chatbot for approved ticket read/write operations
- Quota-resistant local command handling for common chatbot actions

## Roles

| Role | Access |
| --- | --- |
| `admin` | Manages projects, ticket metadata, delegation, sprints, teams, comments, and Gemini insights |
| `developer` | Creates tickets and updates work fields such as status, resolution, and fix plan |
| `member` | Creates/comments on tickets and updates work fields only when delegated as assignee or owner |

Backend authorization enforces these rules even if a user manually calls an API.

## Tech Stack

- **Frontend:** Next.js 15, React, CSS, Fetch API
- **Backend:** Node.js, Express.js
- **Database:** MySQL with `mysql2`
- **Authentication:** JWT and bcrypt
- **AI:** Google Gemini REST API
- **Agent orchestration:** LangGraph.js

## Main Pages

| Route | Purpose |
| --- | --- |
| `/` | Login/register and role-specific dashboard |
| `/tickets/:id` | Ticket details, comments, activity, and permitted controls |
| `/my-tickets` | Tickets reported by, assigned to, or owned by the current user |
| `/admin/sprints` | Admin-only sprint management |
| `/admin/teams` | Admin-only scrum team management |

## Quick Setup

### Backend

```bash
npm install
cp .env.example .env
```

Update `.env` with your MySQL credentials, JWT secret, and optional Gemini key.

Create a new database:

```bash
mysql -u root -p < database/schema.sql
```

For an existing database, run migrations in order:

```bash
mysql -u root -p < database/migrations/001_add_roles_and_soft_delete.sql
mysql -u root -p < database/migrations/002_add_ticket_details_and_comments.sql
mysql -u root -p < database/migrations/003_add_ticket_operations.sql
```

Start the backend:

```bash
npm run dev
```

Backend: `http://localhost:5001`

### Frontend

```bash
cd frontend
npm install
cp .env.local.example .env.local
npm run dev
```

Frontend: `http://localhost:3000`

## Environment Variables

Backend `.env`:

```env
PORT=5001
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=jira_clone

JWT_SECRET=replace_with_a_long_random_secret
JWT_EXPIRES_IN=1d

GEMINI_API_KEY=your_personal_gemini_api_key
GEMINI_MODEL=gemini-2.5-flash-lite
```

Frontend `.env.local`:

```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:5001/api
```

Never commit real `.env` files.

## Core APIs

All protected routes require:

```text
Authorization: Bearer jwt_token
```

### Authentication

| Method | Route | Purpose |
| --- | --- | --- |
| `POST` | `/api/auth/register` | Register a member |
| `POST` | `/api/auth/login` | Login and receive JWT |
| `GET` | `/api/auth/me` | Get current authenticated user |

### Tickets

| Method | Route | Purpose |
| --- | --- | --- |
| `GET` | `/api/tickets` | List tickets |
| `GET` | `/api/tickets/my` | List current user's related tickets |
| `GET` | `/api/tickets/:id` | Get ticket details |
| `POST` | `/api/tickets` | Create ticket |
| `PATCH` | `/api/tickets/:id` | Role-aware ticket update |
| `GET/POST` | `/api/tickets/:id/comments` | List/add comments |
| `PATCH/DELETE` | `/api/tickets/:id/comments/:commentId` | Edit/delete comment |
| `GET` | `/api/tickets/:id/activity` | Get activity history |
| `POST` | `/api/tickets/:id/ai-summary` | Generate admin-only Gemini insight |

### Agent Chat

| Method | Route | Purpose |
| --- | --- | --- |
| `POST` | `/api/agent/chat` | Ask the LangGraph agent to read or perform permitted ticket actions |

The agent uses three LangGraph nodes:

1. Planner chooses one approved tool. Common commands use deterministic local parsing; complex requests use Gemini.
2. Tool executor calls the existing authenticated TaskBoard APIs.
3. Deterministic responder formats the verified API result.

Supported tools include listing projects/tickets, reading a ticket, creating a basic ticket, updating permitted ticket fields, and adding comments. Existing backend role checks and ticket audit logging still apply.

Common commands that work without consuming Gemini quota:

```text
Show all tickets
Show my tickets
List active tickets
Show DEMO-5
Create a high priority bug in DEMO titled Review checkout logs
Set DEMO-5 status to in progress
Add a comment to DEMO-5 saying The issue is being investigated
```

Complex natural-language requests use Gemini when quota is available. If Gemini is rate-limited, the API returns a short retry message while common commands continue to work.

### Workspace Management

| Method | Route | Access |
| --- | --- | --- |
| `GET/POST` | `/api/projects` | List projects / admin creates project |
| `GET/POST` | `/api/sprints` | List sprints / admin creates sprint |
| `GET/POST` | `/api/teams` | List teams / admin creates team |
| `GET` | `/api/users` | List active users for delegation |

## Database Overview

| Table | Purpose |
| --- | --- |
| `users` | Accounts, roles, and user soft deletion |
| `projects` | Project workspaces |
| `issues` | Tickets, delegation, sprint/team links, impact, and fix plan |
| `sprints` | Sprint records and lifecycle |
| `scrum_teams` | Scrum teams |
| `scrum_team_members` | Users belonging to scrum teams |
| `issue_comments` | Comments, internal notes, and comment soft deletion |
| `issue_activity` | Audit trail of ticket changes and comment actions |

Important ENUM values:

- User role: `member`, `developer`, `admin`
- Ticket type: `bug`, `task`, `story`
- Ticket status: `todo`, `in_progress`, `done`
- Priority: `low`, `medium`, `high`, `critical`
- Resolution: `unresolved`, `fixed`, `wont_fix`, `duplicate`
- Sprint status: `planned`, `active`, `completed`

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

frontend/app/
  admin/
  components/
  my-tickets/
  tickets/[id]/
  page.js
  globals.css

docs/
  llm-api-options.md
```

## Security Notes

- Passwords are stored only as bcrypt hashes.
- JWTs are verified on protected routes.
- Soft-deleted users cannot login or use old tokens.
- Sensitive keys remain in backend `.env`.
- Backend role checks prevent frontend permission bypass.
- Agent tools call the existing authenticated APIs instead of writing directly to MySQL.

## Development Notes

- Run the backend and frontend in separate terminals.
- Avoid running `npm run build` while `npm run dev` is active in `frontend`, because both commands write to Next.js `.next`.
- Standalone pages such as `/my-tickets` and `/tickets/:id` read the latest saved JWT before each API request.
