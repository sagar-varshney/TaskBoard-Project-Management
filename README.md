# JIRA Clone Backend

This is a starter backend for a JIRA clone. It focuses on JWT authentication, MySQL database design, and REST APIs.

## Tech Stack

- Node.js
- Express.js
- MySQL
- JWT authentication
- bcrypt password hashing

## Setup

1. Install dependencies:

```bash
npm install
```

2. Create the environment file:

```bash
cp .env.example .env
```

3. Update `.env` with your MySQL username, password, database name, and JWT secret.

4. Create the database tables:

```bash
mysql -u root -p < database/schema.sql
```

5. Start the API:

```bash
npm run dev
```

The API runs on `http://localhost:5000` by default.

## Authentication APIs

### Register

`POST /api/auth/register`

Request body:

```json
{
  "email": "user@example.com",
  "password": "password123",
  "firstName": "Sagar",
  "lastName": "Varshney"
}
```

Response:

```json
{
  "message": "Registered successfully",
  "token": "jwt_token",
  "user": {
    "id": 1,
    "email": "user@example.com",
    "first_name": "Sagar",
    "last_name": "Varshney"
  }
}
```

### Login

`POST /api/auth/login`

Request body:

```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

Response:

```json
{
  "message": "Logged in successfully",
  "token": "jwt_token",
  "user": {
    "id": 1,
    "email": "user@example.com",
    "first_name": "Sagar",
    "last_name": "Varshney"
  }
}
```

### Current User

`GET /api/auth/me`

Header:

```text
Authorization: Bearer jwt_token
```

## Project APIs

All project APIs require the `Authorization: Bearer jwt_token` header.

### List Projects

`GET /api/projects`

### Create Project

`POST /api/projects`

Request body:

```json
{
  "key": "JIRA",
  "name": "JIRA Clone",
  "description": "Internship backend project"
}
```

## Issue APIs

All issue APIs require the `Authorization: Bearer jwt_token` header.

### List Issues

`GET /api/issues`

Optional filter:

`GET /api/issues?projectId=1`

### Create Issue

`POST /api/issues`

Request body:

```json
{
  "projectId": 1,
  "assigneeId": 1,
  "title": "Build login API",
  "description": "Create JWT login endpoint",
  "issueType": "task",
  "priority": "high"
}
```

### Update Issue Status

`PATCH /api/issues/:id/status`

Request body:

```json
{
  "status": "in_progress"
}
```

## Database Schema Design

### `users`

Stores registered users.

| Column | Type | Key | Notes |
| --- | --- | --- | --- |
| `id` | `BIGINT UNSIGNED` | Primary Key | Auto-increment user id |
| `email` | `VARCHAR(255)` | Unique | Used for login |
| `password_hash` | `VARCHAR(255)` |  | Hashed password, never store plain password |
| `first_name` | `VARCHAR(100)` |  | User first name |
| `last_name` | `VARCHAR(100)` |  | User last name |
| `created_at` | `TIMESTAMP` |  | Created time |
| `updated_at` | `TIMESTAMP` |  | Updated time |

### `projects`

Stores JIRA-style projects.

| Column | Type | Key | Notes |
| --- | --- | --- | --- |
| `id` | `BIGINT UNSIGNED` | Primary Key | Auto-increment project id |
| `project_key` | `VARCHAR(20)` | Unique | Short key like `JIRA` |
| `name` | `VARCHAR(150)` |  | Project name |
| `description` | `TEXT` |  | Optional description |
| `owner_id` | `BIGINT UNSIGNED` | Foreign Key | References `users.id` |
| `created_at` | `TIMESTAMP` |  | Created time |
| `updated_at` | `TIMESTAMP` |  | Updated time |

### `issues`

Stores bugs, tasks, and stories.

| Column | Type | Key | Notes |
| --- | --- | --- | --- |
| `id` | `BIGINT UNSIGNED` | Primary Key | Auto-increment issue id |
| `project_id` | `BIGINT UNSIGNED` | Foreign Key | References `projects.id` |
| `reporter_id` | `BIGINT UNSIGNED` | Foreign Key | References `users.id` |
| `assignee_id` | `BIGINT UNSIGNED` | Foreign Key | References `users.id`, nullable |
| `title` | `VARCHAR(255)` |  | Issue title |
| `description` | `TEXT` |  | Optional details |
| `issue_type` | `ENUM` |  | `bug`, `task`, or `story` |
| `status` | `ENUM` |  | `todo`, `in_progress`, or `done` |
| `priority` | `ENUM` |  | `low`, `medium`, `high`, or `critical` |
| `created_at` | `TIMESTAMP` |  | Created time |
| `updated_at` | `TIMESTAMP` |  | Updated time |

## Relationships

- One user can own many projects: `projects.owner_id -> users.id`
- One project can have many issues: `issues.project_id -> projects.id`
- One user can report many issues: `issues.reporter_id -> users.id`
- One user can be assigned many issues: `issues.assignee_id -> users.id`

## Example curl Commands

Register:

```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"password123","firstName":"Sagar","lastName":"Varshney"}'
```

Login:

```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"password123"}'
```
