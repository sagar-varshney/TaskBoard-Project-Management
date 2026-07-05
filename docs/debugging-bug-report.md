# TaskBoard Debugging Bug Report

Date: 2026-07-01

This report documents bugs found while debugging the TaskBoard API with VS Code Node Inspector. The main method used was:

1. Set a breakpoint in the relevant controller.
2. Send a real API request from the frontend or curl.
3. Inspect `req.body`, `req.params`, `req.user`, local variables, and SQL inputs.
4. Compare expected behavior with actual behavior.

## Summary

| # | Area | Bug | Severity |
|---|------|-----|----------|
| 1 | Tickets | Blank ticket titles are accepted on create | Medium |
| 2 | Comments | Editing a comment can reset `is_internal` to false | High |
| 3 | Attachments | Direct upload completion can create broken attachment records | High |
| 4 | Projects | Blank project keys or names are accepted | Medium |
| 5 | Teams | `memberIds` type is not validated | Medium |
| 6 | Auth | Blank first/last names are accepted during registration | Low |
| 7 | Sprints | Blank sprint names are accepted | Medium |
| 8 | Teams | Blank scrum team names are accepted | Medium |
| 9 | Planning | Ticket can be assigned to a sprint from another project | High |
| 10 | Planning | Ticket can be assigned to a scrum team from another project | High |
| 11 | Sprints | Sprint end date can be before start date | Medium |
| 12 | Teams | Duplicate member IDs return a misleading team-name conflict | Low |

## Bug 1: Blank Ticket Titles Are Accepted

Location: `src/controllers/issue.controller.js`, around line 191

Expected behavior:

A ticket title should contain real visible text. A spaces-only title should be rejected.

Actual behavior:

The create-ticket validation checks:

```js
if (!projectId || !title) {
  throw new AppError("projectId and title are required", 400);
}
```

In JavaScript, `"   "` is truthy, so it passes validation. Later the code inserts `title.trim()`, which becomes an empty string.

Reproduce:

```bash
curl -X POST http://localhost:5001/api/tickets \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <TOKEN>" \
  -d '{"projectId":1,"title":"   "}'
```

Debugger proof:

Pause in `createIssue` and inspect:

```js
title
!title
title.trim()
```

You should see `title` is `"   "`, `!title` is `false`, and `title.trim()` is `""`.

Impact:

Empty-looking tickets can appear on the board and detail pages.

Suggested fix:

Change the validation to reject trimmed empty values:

```js
if (!projectId || !title || !title.trim()) {
  throw new AppError("projectId and title are required", 400);
}
```

## Bug 2: Editing Comments Can Reset `is_internal` To False

Location: `src/controllers/issue.controller.js`, around line 562

Expected behavior:

Editing comment text should not change whether a comment is internal unless the request explicitly asks to change it.

Actual behavior:

The update code writes:

```js
[commentText.trim(), Boolean(isInternal), req.params.commentId]
```

If the request does not include `isInternal`, then `isInternal` is `undefined`, and `Boolean(undefined)` becomes `false`.

Reproduce:

Create or find an internal comment, then send:

```bash
curl -X PATCH http://localhost:5001/api/tickets/1/comments/1 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <TOKEN>" \
  -d '{"commentText":"Edited text only"}'
```

Debugger proof:

Pause in `updateIssueComment` and inspect:

```js
isInternal
Boolean(isInternal)
```

You should see `isInternal` is `undefined`, while `Boolean(isInternal)` is `false`.

Impact:

An internal/private comment can accidentally become public.

Suggested fix:

Fetch the existing `is_internal` value and preserve it when `isInternal` is not provided.

## Bug 3: Direct Upload Completion Can Create Broken Attachment Records

Location: `src/controllers/attachment.controller.js`, around line 385

Expected behavior:

The `/complete` endpoint should only save attachment metadata after confirming the file actually exists in R2.

Actual behavior:

`completePresignedAttachmentUpload` checks that `objectKey` starts with `tickets/<ticketId>/`, then inserts the metadata. It does not verify the R2 object exists.

Reproduce:

1. Call `/api/tickets/:id/attachments/presign`.
2. Do not upload the file to the returned R2 URL.
3. Call `/api/tickets/:id/attachments/complete` with the returned `objectKey`.

Debugger proof:

Pause in `completePresignedAttachmentUpload` and step through the code. There is no R2 `HEAD`/existence check before the MySQL insert.

Impact:

The app can show an attachment row that cannot be downloaded, previewed, or analyzed.

Suggested fix:

Add a storage service method that verifies the object exists in R2 before inserting the metadata row.

## Bug 4: Blank Project Keys Or Names Are Accepted

Location: `src/controllers/project.controller.js`, around line 23

Expected behavior:

Project key and project name should contain real visible text.

Actual behavior:

The validation checks:

```js
if (!key || !name) {
  throw new AppError("Project key and name are required", 400);
}
```

Spaces-only strings pass this check, then become empty after `.trim()`.

Reproduce:

```bash
curl -X POST http://localhost:5001/api/projects \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <ADMIN_TOKEN>" \
  -d '{"key":"   ","name":"   "}'
```

Debugger proof:

Pause in `createProject` and inspect:

```js
key
name
!key
!name
key.trim()
name.trim()
```

You should see `!key` and `!name` are both `false`, but `trim()` returns empty strings.

Impact:

Invalid projects can be created, which can affect ticket keys, dropdowns, and dashboard display.

Suggested fix:

Validate trimmed values:

```js
if (!key || !key.trim() || !name || !name.trim()) {
  throw new AppError("Project key and name are required", 400);
}
```

## Bug 5: Team Creation Does Not Validate `memberIds` Type

Location: `src/controllers/team.controller.js`, around line 51

Expected behavior:

`memberIds` should be an array of user IDs.

Actual behavior:

The code loops over `memberIds` directly:

```js
for (const memberId of memberIds) {
```

If the client sends `"memberIds": "123"`, JavaScript iterates the string as `"1"`, `"2"`, `"3"`.

Reproduce:

```bash
curl -X POST http://localhost:5001/api/teams \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <ADMIN_TOKEN>" \
  -d '{"projectId":1,"name":"Debug Team","memberIds":"123"}'
```

Debugger proof:

Pause at the `for...of` loop and inspect:

```js
memberIds
memberId
```

You should see `memberIds` is a string and `memberId` becomes one character at a time.

Impact:

The API can insert unintended members or return confusing foreign-key errors.

Suggested fix:

Validate the shape before inserting:

```js
if (!Array.isArray(memberIds)) {
  throw new AppError("memberIds must be an array", 400);
}
```

## Bug 6: Blank First/Last Names Are Accepted During Registration

Location: `src/controllers/auth.controller.js`, around lines 10 and 52

Expected behavior:

Registered users should have visible first and last names.

Actual behavior:

Registration checks only `!firstName` and `!lastName`, but spaces-only names pass. The insert uses `firstName.trim()` and `lastName.trim()`, which can become empty strings.

Reproduce:

```bash
curl -X POST http://localhost:5001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"blank-name@example.com","password":"password123","firstName":"   ","lastName":"   "}'
```

Debugger proof:

Pause in `validateRegisterInput` and inspect:

```js
firstName
lastName
firstName.trim()
lastName.trim()
```

Impact:

The UI can show users with blank names in assignment dropdowns, comments, activity logs, and admin pages.

Suggested fix:

Validate trimmed first and last names before hashing/inserting.

## Bug 7: Blank Sprint Names Are Accepted

Location: `src/controllers/sprint.controller.js`, around lines 35 and 47

Expected behavior:

Sprint names should contain visible text.

Actual behavior:

`createSprint` checks `!name`, but spaces-only names pass. The insert uses `name.trim()`.

Reproduce:

```bash
curl -X POST http://localhost:5001/api/sprints \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <ADMIN_TOKEN>" \
  -d '{"projectId":1,"name":"   ","status":"planned"}'
```

Debugger proof:

Pause in `createSprint` and inspect:

```js
name
!name
name.trim()
```

Impact:

Blank sprints can appear in planning dropdowns and admin pages.

Suggested fix:

Validate `!name.trim()`.

## Bug 8: Blank Scrum Team Names Are Accepted

Location: `src/controllers/team.controller.js`, around lines 36 and 48

Expected behavior:

Scrum team names should contain visible text.

Actual behavior:

`createTeam` checks `!name`, but spaces-only names pass. The insert uses `name.trim()`.

Reproduce:

```bash
curl -X POST http://localhost:5001/api/teams \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <ADMIN_TOKEN>" \
  -d '{"projectId":1,"name":"   ","memberIds":[]}'
```

Debugger proof:

Pause in `createTeam` and inspect:

```js
name
!name
name.trim()
```

Impact:

Blank teams can appear in assignment and admin interfaces.

Suggested fix:

Validate `!name.trim()`.

## Bug 9: Tickets Can Be Assigned To A Sprint From Another Project

Location: `src/controllers/issue.controller.js`, around lines 215, 219, and 328

Expected behavior:

A ticket should only be assigned to a sprint that belongs to the same project as the ticket.

Actual behavior:

The database foreign key only proves that `sprint_id` exists in the `sprints` table. It does not prove that the sprint belongs to the ticket's project. The create and update paths do not check this relationship.

Reproduce:

1. Create Project A and Project B.
2. Create a sprint under Project B.
3. Create or update a ticket under Project A using Project B's `sprintId`.

Debugger proof:

Pause in `createIssue` or `updateIssue` and inspect:

```js
projectId
sprintId
```

Then query the sprint's `project_id` in MySQL. The controller does not compare it with the ticket's project.

Impact:

Project planning data becomes inconsistent. A ticket can appear linked to a sprint outside its project.

Suggested fix:

Before saving `sprintId`, query `sprints` with both `id = ?` and `project_id = ?`.

## Bug 10: Tickets Can Be Assigned To A Scrum Team From Another Project

Location: `src/controllers/issue.controller.js`, around lines 215, 220, and 333

Expected behavior:

A ticket should only be assigned to a scrum team that belongs to the same project as the ticket.

Actual behavior:

The database foreign key only proves that `scrum_team_id` exists. The controller does not check that the team belongs to the same project as the ticket.

Reproduce:

1. Create Project A and Project B.
2. Create a team under Project B.
3. Create or update a ticket under Project A using Project B's `scrumTeamId`.

Debugger proof:

Pause in `createIssue` or `updateIssue` and inspect:

```js
projectId
scrumTeamId
```

Then compare the selected team's `project_id`. No controller check prevents the mismatch.

Impact:

Team ownership and project planning data can become inconsistent.

Suggested fix:

Before saving `scrumTeamId`, query `scrum_teams` with both `id = ?` and `project_id = ?`.

## Bug 11: Sprint End Date Can Be Before Start Date

Location: `src/controllers/sprint.controller.js`, around lines 33 and 47

Expected behavior:

A sprint's `endDate` should not be earlier than `startDate`.

Actual behavior:

`createSprint` accepts `startDate` and `endDate`, but does not compare them before inserting.

Reproduce:

```bash
curl -X POST http://localhost:5001/api/sprints \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <ADMIN_TOKEN>" \
  -d '{"projectId":1,"name":"Bad Date Sprint","startDate":"2026-07-10","endDate":"2026-07-01","status":"planned"}'
```

Debugger proof:

Pause in `createSprint` and inspect:

```js
startDate
endDate
```

Step forward and notice there is no date-order validation before the insert.

Impact:

Admin planning views can contain impossible sprint timelines.

Suggested fix:

If both dates are provided, validate `new Date(endDate) >= new Date(startDate)`.

## Bug 12: Duplicate Member IDs Return A Misleading Team Conflict

Location: `src/controllers/team.controller.js`, around lines 51 and 75

Expected behavior:

If `memberIds` includes duplicates, the API should either deduplicate them or return a clear validation error.

Actual behavior:

The join table has a primary key on `(team_id, user_id)`. If `memberIds` contains duplicates, the second insert throws `ER_DUP_ENTRY`. The catch block maps all duplicate errors to:

```js
"Scrum team already exists for this project"
```

But the team name is not the problem.

Reproduce:

```bash
curl -X POST http://localhost:5001/api/teams \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <ADMIN_TOKEN>" \
  -d '{"projectId":1,"name":"Duplicate Member Team","memberIds":[1,1]}'
```

Debugger proof:

Pause in the `catch` block and inspect:

```js
error.code
error.message
```

You should see a duplicate-key error from the join table, but the API responds as if the team name already exists.

Impact:

The user receives the wrong error message, making debugging and form correction harder.

Suggested fix:

Validate uniqueness before insertion:

```js
if (new Set(memberIds).size !== memberIds.length) {
  throw new AppError("memberIds cannot contain duplicates", 400);
}
```

## Recommended Fix Priority

1. Fix Bug 2 first because it can expose internal comments.
2. Fix Bugs 9 and 10 next because cross-project planning data can corrupt ticket organization.
3. Fix Bug 3 because broken attachment rows are user-facing and can affect analysis/download flows.
4. Fix whitespace validation bugs together with a shared helper.
5. Fix team member validation and duplicate handling.

## Debugging Pattern Used

For each bug, the same pattern applies:

1. Identify what the API should reject or preserve.
2. Find the controller handling that request.
3. Pause at validation or SQL insertion.
4. Inspect the local variables.
5. Step forward and confirm the bad value reaches the database update/insert.
6. Describe the user-facing impact.
