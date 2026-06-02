# TaskBoard

TaskBoard is a JIRA-inspired project management application. It currently includes JWT authentication, role-aware ticket APIs, soft-delete schema support, and a Next.js ticket dashboard.

## Current Scope

- Register with email, password, first name, and last name
- Login with email and password
- Hash passwords before storing them in MySQL
- Generate JWT tokens after successful registration or login
- Verify JWT tokens before returning the current user
- Test the protected profile route from the frontend
- Create and list projects
- Create, list, and get tickets
- Edit tickets as an admin
- View ticket counts and status columns on the dashboard

LLM-powered ticket assistance will be expanded in a later milestone.

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
    globals.css
    layout.js
    page.js

src/
  config/
    db.js
  controllers/
    auth.controller.js
  middleware/
    auth.middleware.js
  routes/
    auth.routes.js
  utils/
    app-error.js
    jwt.js
  app.js
  server.js

database/
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

Promote only a trusted user when admin ticket editing is needed:

```sql
UPDATE users SET role = 'admin' WHERE email = 'trusted-user@example.com';
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
| `role` | `ENUM('member', 'admin')` |  | Members can read/create tickets; admins can also edit tickets |
| `deleted_at` | `TIMESTAMP` |  | Null for active users; timestamp for soft-deleted users |
| `created_at` | `TIMESTAMP` |  | Created time |
| `updated_at` | `TIMESTAMP` |  | Updated time |

## Ticket APIs

All ticket APIs require:

```text
Authorization: Bearer jwt_token
```

| Method | Route | Access | Purpose |
| --- | --- | --- | --- |
| `GET` | `/api/tickets` | Authenticated user | List tickets |
| `GET` | `/api/tickets/:id` | Authenticated user | Get one ticket |
| `POST` | `/api/tickets` | Authenticated user | Create a ticket |
| `PATCH` | `/api/tickets/:id` | Admin only | Edit ticket fields or status |
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
  "title": "Build dashboard",
  "description": "Add ticket status columns",
  "issueType": "task",
  "priority": "high"
}
```

Edit ticket body:

```json
{
  "status": "in_progress",
  "priority": "critical"
}
```

The existing `/api/issues` routes remain available for compatibility.

## Ticket Database Schema

Tickets are stored in the existing `issues` table.

| Column | Type | Key | Notes |
| --- | --- | --- | --- |
| `id` | `BIGINT UNSIGNED` | Primary Key | Auto-increment ticket id |
| `project_id` | `BIGINT UNSIGNED` | Foreign Key | References `projects.id` |
| `reporter_id` | `BIGINT UNSIGNED` | Foreign Key | References `users.id` |
| `assignee_id` | `BIGINT UNSIGNED` | Foreign Key | References `users.id`, nullable |
| `title` | `VARCHAR(255)` |  | Ticket title |
| `description` | `TEXT` |  | Optional details |
| `issue_type` | `ENUM` |  | `bug`, `task`, or `story` |
| `status` | `ENUM` |  | `todo`, `in_progress`, or `done` |
| `priority` | `ENUM` |  | `low`, `medium`, `high`, or `critical` |
| `created_at` | `TIMESTAMP` |  | Created time |
| `updated_at` | `TIMESTAMP` |  | Updated time |

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
