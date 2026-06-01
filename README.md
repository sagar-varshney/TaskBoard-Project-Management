# TaskBoard

TaskBoard is a JIRA-inspired project management application. The current milestone focuses on user authentication with a Next.js frontend, an Express backend, JWT tokens, bcrypt password hashing, and MySQL.

## Current Scope

- Register with email, password, first name, and last name
- Login with email and password
- Hash passwords before storing them in MySQL
- Generate JWT tokens after successful registration or login
- Verify JWT tokens before returning the current user
- Test the protected profile route from the frontend

Project and issue management will be expanded in a later milestone.

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
| `created_at` | `TIMESTAMP` |  | Created time |
| `updated_at` | `TIMESTAMP` |  | Updated time |

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
