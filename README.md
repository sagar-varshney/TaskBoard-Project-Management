# TaskBoard

TaskBoard is a JIRA-inspired project management application. It currently includes JWT authentication, role-aware ticket workflows, user soft delete support, project/ticket management, sprint and scrum team management, ticket comments, activity history, Gemini ticket insights, and a Next.js dashboard.

## Current Scope

- Register with email, password, first name, and last name
- Login with email and password
- Hash passwords before storing them in MySQL
- Generate JWT tokens after successful registration or login
- Verify JWT tokens before returning the current user
- Test the protected profile route from the frontend
- Create and list projects
- Create, list, and get tickets
- Open ticket details from linked ticket IDs
- Edit ticket metadata as an admin
- Delegate tickets to assignees and owners
- Allow developers or delegated users to update ticket work progress
- Add, edit, and delete ticket comments
- Track ticket activity history
- Create and assign sprints
- Create and assign scrum teams
- View personal work from the My Tickets page
- View ticket counts and status columns on the dashboard
- Generate Gemini AI ticket insights as an admin

LLM-powered ticket assistance is currently wired through Gemini and can be expanded into deeper agentic workflows later.

## Tech Stack

### Frontend

- Next.js
- React
- CSS
- Fetch API
- Browser `localStorage` for the demo JWT token

### Backend

- Node.js
- Express.js
- MySQL
- `mysql2`
- `jsonwebtoken`
- `bcryptjs`
- `dotenv`
- `cors`

## Project Structure

```text
frontend/
  app/
    components/
      AuthForm.js
      Dashboard.js
      MyTickets.js
      TicketDetail.js
    my-tickets/
      page.js
    tickets/
      [id]/
        page.js
    globals.css
    layout.js
    page.js

src/
  config/
    db.js
  controllers/
    auth.controller.js
    issue.controller.js
    project.controller.js
    sprint.controller.js
    team.controller.js
    user.controller.js
  middleware/
    auth.middleware.js
    role.middleware.js
  routes/
    auth.routes.js
    issue.routes.js
    project.routes.js
    sprint.routes.js
    team.routes.js
    ticket.routes.js
    user.routes.js
  utils/
    app-error.js
    jwt.js
  app.js
  server.js

database/
  migrations/
  schema.sql
```

## Setup

### 1. Install Backend Dependencies

From the project root:

```bash
npm install
```

### 2. Configure Backend Environment Variables

Create the backend environment file:

```bash
cp .env.example .env
```

Update `.env` with your MySQL credentials and JWT secret. The local backend currently runs on port `5001`.

Example:

```env
PORT=5001
NODE_ENV=development

DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=jira_clone

JWT_SECRET=replace_this_with_a_long_random_secret
JWT_EXPIRES_IN=1d
```

Do not commit `.env`.

### 3. Create MySQL Tables

```bash
mysql -u root -p < database/schema.sql
```

If your database was created before roles and soft deletes were added, run the one-time migration:

```bash
mysql -u root -p < database/migrations/001_add_roles_and_soft_delete.sql
```

If your database was created before ticket detail fields, comments, sprints, teams, and activity history were added, run these migrations in order:

```bash
mysql -u root -p < database/migrations/002_add_ticket_details_and_comments.sql
mysql -u root -p < database/migrations/003_add_ticket_operations.sql
```

Promote only a trusted user when admin ticket editing is needed:

```sql
UPDATE users SET role = 'admin' WHERE email = 'trusted-user@example.com';
```

Promote a developer user when work-progress updates are needed:

```sql
UPDATE users SET role = 'developer' WHERE email = 'developer@example.com';
```

### 4. Start The Backend

```bash
npm run dev
```

Backend URL:

```text
http://localhost:5001
```

### 5. Install Frontend Dependencies

Open a second terminal:

```bash
cd frontend
npm install
```

### 6. Configure Frontend Environment Variables

Create the frontend environment file:

```bash
cp .env.local.example .env.local
```

The default frontend config points to:

```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:5001/api
```

### 7. Start The Frontend

```bash
npm run dev
```

Frontend URL:

```text
http://localhost:3000
```

## Authentication Flow

### Register

1. User enters email, password, first name, and last name.
2. Backend validates the request.
3. Backend checks that the email is not already registered.
4. Backend hashes the password using bcrypt.
5. Backend stores the new user in MySQL.
6. Backend signs and returns a JWT token.
7. Frontend stores the demo token in `localStorage`.

### Login

1. User enters email and password.
2. Backend finds the user by email.
3. Backend compares the password with the stored bcrypt hash.
4. Backend signs and returns a JWT token when the password matches.
5. Frontend stores the demo token in `localStorage`.

### Protected Route

1. Frontend sends the JWT in the Authorization header:

```text
Authorization: Bearer jwt_token
```

2. Backend middleware verifies the JWT signature and expiry.
3. Backend fetches the current user from MySQL.
4. Backend returns the user profile.

## Authentication APIs

### Register

```text
POST /api/auth/register
```

Request body:

```json
{
  "email": "sampleuser@example.com",
  "password": "password123",
  "firstName": "samplename",
  "lastName": "testname"
}
```

Example response:

```json
{
  "message": "Registered successfully",
  "token": "jwt_token",
  "user": {
    "id": 1,
    "email": "sampleuser@example.com",
    "first_name": "samplename",
    "last_name": "testname"
  }
}
```

### Login

```text
POST /api/auth/login
```

Request body:

```json
{
  "email": "sampleuser@example.com",
  "password": "password123"
}
```

Example response:

```json
{
  "message": "Logged in successfully",
  "token": "jwt_token",
  "user": {
    "id": 1,
    "email": "sampleuser@example.com",
    "first_name": "samplename",
    "last_name": "testname"
  }
}
```

### Current User

```text
GET /api/auth/me
```

Required header:

```text
Authorization: Bearer jwt_token
```

Example response:

```json
{
  "user": {
    "id": 1,
    "email": "sampleuser@example.com",
    "first_name": "samplename",
    "last_name": "testname",
    "created_at": "2026-06-01T00:00:00.000Z"
  }
}
```

## Authentication Database Schema

### `users`

Stores registered users.

| Column | Type | Key | Notes |
| --- | --- | --- | --- |
| `id` | `BIGINT UNSIGNED` | Primary Key | Auto-increment user id |
| `email` | `VARCHAR(255)` | Unique | Used for login |
| `password_hash` | `VARCHAR(255)` |  | Bcrypt hash; plain passwords are never stored |
| `first_name` | `VARCHAR(100)` |  | User first name |
| `last_name` | `VARCHAR(100)` |  | User last name |
| `role` | `ENUM('member', 'developer', 'admin')` |  | Members can read/create tickets; developers can update work fields; admins can manage metadata |
| `deleted_at` | `TIMESTAMP` |  | Null for active users; timestamp for soft-deleted users |
| `created_at` | `TIMESTAMP` |  | Created time |
| `updated_at` | `TIMESTAMP` |  | Updated time |

## Role Rules

| Role | Permissions |
| --- | --- |
| `member` | Register, login, create/read projects and tickets, comment, and update work fields only when assigned or set as owner |
| `developer` | Update ticket work fields such as status, resolution, and fix plan; cannot change sprint/type/priority/header |
| `admin` | Manage ticket metadata, assignee/owner delegation, sprints, teams, comments, and Gemini ticket insights |

## Ticket APIs

All ticket APIs require:

```text
Authorization: Bearer jwt_token
```

| Method | Route | Access | Purpose |
| --- | --- | --- | --- |
| `GET` | `/api/tickets` | Authenticated user | List tickets |
| `GET` | `/api/tickets/my` | Authenticated user | List tickets reported by, assigned to, or owned by the current user |
| `GET` | `/api/tickets/:id` | Authenticated user | Get one ticket |
| `POST` | `/api/tickets` | Authenticated user | Create a ticket |
| `PATCH` | `/api/tickets/:id` | Role-aware | Admin edits metadata; developer/delegated user updates work fields |
| `GET` | `/api/tickets/:id/comments` | Authenticated user | List ticket comments |
| `POST` | `/api/tickets/:id/comments` | Authenticated user | Add a comment |
| `PATCH` | `/api/tickets/:id/comments/:commentId` | Author or admin | Edit a comment |
| `DELETE` | `/api/tickets/:id/comments/:commentId` | Author or admin | Soft-delete a comment |
| `GET` | `/api/tickets/:id/activity` | Authenticated user | List ticket activity history |
| `POST` | `/api/tickets/:id/ai-summary` | Admin only | Generate a Gemini ticket insight |

Optional list filters:

```text
GET /api/tickets?projectId=1
GET /api/tickets?status=in_progress
```

Create ticket body:

```json
{
  "projectId": 1,
  "assigneeId": 2,
  "ownerId": 3,
  "sprintId": 1,
  "scrumTeamId": 1,
  "title": "Build dashboard",
  "description": "Add ticket status columns",
  "issueType": "task",
  "priority": "high",
  "impact": "Users cannot track work clearly",
  "fixPlan": "Add dashboard columns and ticket detail view"
}
```

Admin metadata edit body:

```json
{
  "title": "Fix login bug",
  "issueType": "bug",
  "priority": "critical",
  "sprintId": 1,
  "scrumTeamId": 1,
  "assigneeId": 2,
  "ownerId": 3,
  "impact": "Users cannot sign in",
  "description": "Login fails for valid credentials"
}
```

Developer or delegated user work update body:

```json
{
  "status": "in_progress",
  "resolution": "unresolved",
  "fixPlan": "Investigating backend authentication flow"
}
```

The existing `/api/issues` routes remain available for compatibility.

## Project, Sprint, Team, And User APIs

All routes require a JWT.

| Method | Route | Access | Purpose |
| --- | --- | --- | --- |
| `GET` | `/api/projects` | Authenticated user | List projects |
| `POST` | `/api/projects` | Authenticated user | Create a project |
| `GET` | `/api/users` | Authenticated user | List active users for delegation dropdowns |
| `GET` | `/api/sprints` | Authenticated user | List sprints |
| `POST` | `/api/sprints` | Admin only | Create a sprint |
| `GET` | `/api/teams` | Authenticated user | List scrum teams |
| `POST` | `/api/teams` | Admin only | Create a scrum team |

## Ticket Database Schema

Tickets are stored in the existing `issues` table.

| Column | Type | Key | Notes |
| --- | --- | --- | --- |
| `id` | `BIGINT UNSIGNED` | Primary Key | Auto-increment ticket id |
| `project_id` | `BIGINT UNSIGNED` | Foreign Key | References `projects.id` |
| `reporter_id` | `BIGINT UNSIGNED` | Foreign Key | References `users.id` |
| `assignee_id` | `BIGINT UNSIGNED` | Foreign Key | References `users.id`, nullable |
| `owner_id` | `BIGINT UNSIGNED` | Foreign Key | References `users.id`, nullable |
| `sprint_id` | `BIGINT UNSIGNED` | Foreign Key | References `sprints.id`, nullable |
| `scrum_team_id` | `BIGINT UNSIGNED` | Foreign Key | References `scrum_teams.id`, nullable |
| `title` | `VARCHAR(255)` |  | Ticket title |
| `description` | `TEXT` |  | Optional details |
| `issue_type` | `ENUM` |  | `bug`, `task`, or `story` |
| `status` | `ENUM` |  | `todo`, `in_progress`, or `done` |
| `priority` | `ENUM` |  | `low`, `medium`, `high`, or `critical` |
| `resolution` | `ENUM` |  | `unresolved`, `fixed`, `wont_fix`, or `duplicate` |
| `sprint` | `VARCHAR(120)` |  | Legacy/free-text sprint field |
| `scrum_team` | `VARCHAR(120)` |  | Legacy/free-text team field |
| `impact` | `TEXT` |  | Impact of the issue |
| `fix_plan` | `TEXT` |  | What is being done to fix it |
| `created_at` | `TIMESTAMP` |  | Created time |
| `updated_at` | `TIMESTAMP` |  | Updated time |

### `sprints`

Stores real sprint records that tickets can reference.

| Column | Type | Key | Notes |
| --- | --- | --- | --- |
| `id` | `BIGINT UNSIGNED` | Primary Key | Auto-increment sprint id |
| `project_id` | `BIGINT UNSIGNED` | Foreign Key | References `projects.id` |
| `name` | `VARCHAR(120)` | Unique per project | Sprint name |
| `goal` | `TEXT` |  | Sprint goal |
| `start_date` | `DATE` |  | Optional start date |
| `end_date` | `DATE` |  | Optional end date |
| `status` | `ENUM` |  | `planned`, `active`, or `completed` |

### `scrum_teams` And `scrum_team_members`

Stores scrum teams and the users assigned to those teams.

### `issue_comments`

Stores ticket comments.

| Column | Type | Key | Notes |
| --- | --- | --- | --- |
| `id` | `BIGINT UNSIGNED` | Primary Key | Auto-increment comment id |
| `issue_id` | `BIGINT UNSIGNED` | Foreign Key | References `issues.id` |
| `user_id` | `BIGINT UNSIGNED` | Foreign Key | Comment author |
| `comment_text` | `TEXT` |  | Comment body |
| `is_internal` | `BOOLEAN` |  | Marks an internal note |
| `deleted_at` | `TIMESTAMP` |  | Null for active comments; timestamp for soft-deleted comments |

### `issue_activity`

Stores ticket history such as field changes, comments added, comments edited, and comments deleted.

## Frontend Pages

| Page | Purpose |
| --- | --- |
| `/` | Login/register screen and ticket dashboard after authentication |
| `/tickets/:id` | Ticket detail page with metadata, work update fields, comments, and activity history |
| `/my-tickets` | Personal queue for tickets reported by, assigned to, or owned by the current user |

## LLM Research

Current free-tier provider research and official links are documented in:

```text
docs/llm-api-options.md
```

The Gemini endpoint is wired but requires a personal key in backend `.env`:

```env
GEMINI_API_KEY=your_personal_gemini_api_key
GEMINI_MODEL=gemini-2.5-flash-lite
```

## Example curl Commands

Register:

```bash
curl -X POST http://localhost:5001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"sampleuser@example.com","password":"password123","firstName":"samplename","lastName":"testname"}'
```

Login:

```bash
curl -X POST http://localhost:5001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"sampleuser@example.com","password":"password123"}'
```

Protected route:

```bash
curl http://localhost:5001/api/auth/me \
  -H "Authorization: Bearer jwt_token"
```

## Security Notes

- Plain passwords are never stored in MySQL.
- JWT secrets and database passwords belong only in `.env`.
- `.env` and `frontend/.env.local` are ignored by Git.
- `localStorage` is used for this development milestone. A production version should consider secure `HttpOnly` cookies to reduce token exposure from cross-site scripting attacks.
