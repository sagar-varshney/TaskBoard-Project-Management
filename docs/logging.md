# Backend Logging

TaskBoard writes structured JSON logs for API debugging, user action tracking, and production readiness.

## Log Files

Logs are written to the `logs/` directory, which is ignored by Git.

| File | Purpose |
|------|---------|
| `logs/app.log` | Server lifecycle, completed API requests, and warnings |
| `logs/error.log` | API errors and server startup failures |
| `logs/audit.log` | User and business actions such as registration, ticket creation, uploads, and agent chat |

Every log entry is a single JSON object on one line. This makes logs easy to search locally and easy to ship to production log systems later.

Production logs also include demo-friendly fields for Vercel:

| Field | Purpose |
|-------|---------|
| `category` | Groups logs as `app`, `audit`, `security`, or `error` |
| `severity` | Searchable severity: `info`, `warning`, or `error` |
| `summary` | Human-readable one-line explanation of the event |
| `logFile` | Keeps the local-style grouping: `app.log`, `audit.log`, or `error.log` |

## Request IDs

Every API response includes:

```text
X-Request-Id: <uuid>
```

Use this ID to connect a frontend/API failure to the backend logs.

Example:

```bash
grep '<request-id>' logs/app.log logs/error.log logs/audit.log
```

## Logged Events

Examples of events currently logged:

- `server_started`
- `api_request_completed`
- `api_error`
- `api_route_not_found`
- `user_registered`
- `user_logged_in`
- `user_logged_out`
- `project_created`
- `sprint_created`
- `scrum_team_created`
- `issue_created`
- `issue_updated`
- `issue_comment_added`
- `attachment_upload_presigned`
- `attachment_uploaded`
- `attachment_analyzed`
- `attachment_deleted`
- `agent_chat_queried`
- `login_failed`
- `rate_limit_exceeded`
- `unauthorized_api_attempt`
- `csrf_validation_failed`
- `cors_origin_blocked`
- `user_blocked`
- `user_unblocked`

## Vercel Log Searches

In the Vercel backend project, open **Logs** and search these terms:

```text
category":"security
```

Shows blocked origins, failed logins, unauthorized API attempts, CSRF failures, and rate-limit events.

```text
category":"audit
```

Shows user and business actions such as login, logout, ticket changes, uploads, and AI assistant queries.

```text
agent_chat_queried
```

Shows AI assistant usage.

```text
summary
```

Shows logs with human-readable explanations.

```text
error.log
```

Shows backend errors. An empty result is a healthy sign during normal demos.

## Useful Environment Variables

```env
LOG_DIR=logs
LOG_TO_CONSOLE=true
LOG_REQUEST_BODY=false
```

`LOG_REQUEST_BODY=false` is the safer default. Failed non-GET requests still log a sanitized body to help debug validation/API problems. Set `LOG_REQUEST_BODY=true` only in local development if you want request bodies logged for successful writes too.

Sensitive fields such as passwords, tokens, authorization headers, cookies, and secrets are redacted before logging.

## Debugging Examples

Find failed API requests:

```bash
grep '"statusCode":400' logs/app.log
```

Find server-side errors:

```bash
tail -n 50 logs/error.log
```

Find actions by a user:

```bash
grep '"userId":1' logs/audit.log
```

Find ticket activity:

```bash
grep '"issueId":5' logs/audit.log
```
