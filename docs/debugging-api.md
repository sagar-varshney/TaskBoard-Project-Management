# Debugging The Backend API

This project can be debugged with VS Code, Thunder Client, curl, or the Next.js frontend.

## VS Code Setup

1. Open this repository in VS Code.
2. Go to **Run and Debug**.
3. Select **Debug Backend API**.
4. Press the green play button.

The backend starts with Node's inspector on port `9229` and serves the API on the port from `.env`, usually `http://localhost:5001`.

Use **Debug Backend API From First Line** when you want execution to pause before the server starts. Use **Attach To Backend API** if you already started the server with:

```bash
npm run debug
```

## Where To Put Breakpoints

Good first breakpoint locations:

- `src/app.js`: route registration and the central error handler
- `src/middleware/auth.middleware.js`: JWT validation and user lookup
- `src/controllers/auth.controller.js`: register, login, logout
- `src/controllers/issue.controller.js`: ticket create, read, update, comments, activity
- `src/controllers/attachment.controller.js`: upload, presign, complete, download, analyze, delete
- `src/services/storage.service.js`: local/R2 storage calls and presigned URL generation
- `src/services/agent.service.js`: chatbot planning and tool execution

## How To Intercept An API Request

1. Start **Debug Backend API**.
2. Put a breakpoint inside the route/controller you want to inspect.
3. Send the request from Thunder Client, curl, or the frontend.
4. When VS Code pauses, inspect:
   - `req.params`
   - `req.query`
   - `req.body`
   - `req.user`
   - SQL query results
   - thrown errors before they reach the error handler

For protected routes, include:

```text
Authorization: Bearer <your-login-token>
```

## Example Debug Flow

To debug direct attachment uploads:

1. Put a breakpoint in `createPresignedAttachmentUpload`.
2. Upload a file from the ticket detail page.
3. Continue execution after checking `fileName`, `mimeType`, `fileSize`, `category`, and `tags`.
4. Put another breakpoint in `completePresignedAttachmentUpload`.
5. Check `objectKey`, metadata normalization, versioning, and the final MySQL insert.

Expected browser network sequence:

```text
presign  200
R2 PUT   200
complete 201
```

If you only see `/attachments 201`, the frontend used the multipart fallback route.

## Debugging Tips

- Use **Step Over** for normal line-by-line debugging.
- Use **Step Into** when you want to enter helper functions like `findTicket` or `createPresignedPutUrl`.
- Use the **Debug Console** to evaluate values while paused.
- If port `5001` is already in use, stop the older backend process before starting the debugger.
- If MySQL is not running or `.env` is wrong, the server will fail before routes are available.
