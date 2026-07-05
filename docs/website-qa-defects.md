# TaskBoard Website QA Defects

Date: 2026-07-02

This report documents defects found during an exploratory website test of the local TaskBoard app.

Test environment:

- Frontend: `http://localhost:3000`
- Backend: `http://localhost:5001`
- Browser: in-app browser
- Test users: generated local QA users

## Summary

| # | Area | Defect | Severity |
|---|------|--------|----------|
| 1 | Ticket creation | Whitespace-only ticket titles are accepted and displayed as blank cards | High |
| 2 | Ticket detail | Blank ticket title creates a broken-looking page heading | Medium |
| 3 | Comments | Internal comments are visible to unrelated member users | High |
| 4 | Authentication | Registration accepts whitespace-only first and last names | Medium |
| 5 | Dashboard | Ticket creation success message disappears immediately | Low |
| 6 | Auth navigation | Unauthenticated My Tickets page shows conflicting empty-state text | Low |
| 7 | Auth navigation | Unauthenticated ticket detail error gives no direct way back to login | Low |
| 8 | Access control | New member accounts can see all workspace projects and tickets | Review needed |

## Defect 1: Whitespace-Only Ticket Titles Are Accepted

Severity: High

Page:

```text
Dashboard -> Create ticket
```

Steps to reproduce:

1. Log in as a member.
2. Go to the dashboard.
3. In the Create ticket form, select a project.
4. Enter only spaces in the Title field.
5. Submit the form.

Expected behavior:

The page should reject the ticket and show a validation message such as:

```text
Title cannot be empty.
```

Actual behavior:

The ticket is created successfully, but the title is blank. The board shows a ticket card with an empty heading.

Evidence observed:

The board contained a new ticket card with key `R90321-15`, but the heading text was empty.

Impact:

Users cannot identify the ticket from the board or personal queue. This creates bad data and a poor user experience.

Suggested fix:

Validate trimmed title values on both frontend and backend:

```js
if (!title.trim()) {
  // reject
}
```

## Defect 2: Blank Ticket Title Creates Broken Detail Heading

Severity: Medium

Page:

```text
/tickets/:id
```

Steps to reproduce:

1. Create a ticket with a whitespace-only title.
2. Open that ticket detail page.

Expected behavior:

The detail page should either prevent the bad ticket from existing or show a clear fallback such as:

```text
Untitled ticket
```

Actual behavior:

The page heading renders like:

```text
R90321-15:
```

with nothing after the colon.

Impact:

The page looks broken and gives the user no useful ticket title.

Suggested fix:

Prevent blank titles at creation time. Also add a defensive UI fallback for existing bad data.

## Defect 3: Internal Comments Are Visible To Unrelated Member Users

Severity: High

Page:

```text
Ticket detail -> Comments
```

Steps to reproduce:

1. Log in as member user A.
2. Open a ticket.
3. Add a comment and check `Internal note`.
4. Log out.
5. Log in as member user B.
6. Open the same ticket.

Expected behavior:

An internal comment should be hidden from users who are not allowed to view internal notes, or the UI should not label the comment as internal if no privacy behavior exists.

Actual behavior:

Member user B can see:

```text
Internal
QA internal note visibility test
```

Impact:

The UI implies privacy, but the comment is visible to another unrelated member. This can expose sensitive internal notes.

Suggested fix:

Define internal-comment visibility rules and enforce them in `listIssueComments`. For example, only admins/developers or assigned users should see internal comments. Also hide the `Internal note` checkbox for users who cannot create internal notes.

## Defect 4: Registration Accepts Whitespace-Only Names

Severity: Medium

Page:

```text
Register
```

Steps to reproduce:

1. Open the Register tab.
2. Enter a valid email.
3. Enter a valid password.
4. Enter spaces only for First name.
5. Enter spaces only for Last name.
6. Submit the form.

Expected behavior:

The form should reject the registration and require visible first and last names.

Actual behavior:

The account is created. After login, the sidebar shows only:

```text
member
```

The user name area is blank.

Impact:

Blank names make assignments, comments, audit logs, and admin user lists confusing.

Suggested fix:

Validate `firstName.trim()` and `lastName.trim()` on both frontend and backend.

## Defect 5: Ticket Creation Success Message Disappears

Severity: Low

Page:

```text
Dashboard -> Create ticket
```

Steps to reproduce:

1. Create a valid ticket from the dashboard.
2. Observe the dashboard after the board reloads.

Expected behavior:

The page should show:

```text
Ticket created successfully.
```

or another clear confirmation.

Actual behavior:

The ticket is created and appears on the board, but no success message remains visible.

Evidence observed:

After creating a valid test ticket, the ticket was present on the board, but `.dashboard-message` was empty.

Likely cause:

The dashboard sets a success message and then calls `loadDashboard`, which clears the message at the start of loading.

Impact:

Users may not get clear confirmation that the create action worked.

Suggested fix:

Avoid clearing the message during refresh when the refresh follows a successful action, or set the message after `loadDashboard` completes.

## Defect 6: Unauthenticated My Tickets Page Shows Conflicting Text

Severity: Low

Page:

```text
/my-tickets
```

Steps to reproduce:

1. Log out.
2. Navigate directly to `/my-tickets`.

Expected behavior:

The page should redirect to login or show only a login/session message.

Actual behavior:

The page shows both:

```text
Your login session is missing. Return to the dashboard and log in again.
```

and:

```text
No tickets are assigned to you, owned by you, or reported by you.
```

Impact:

The empty-state message is misleading because the app did not actually load the user's tickets.

Suggested fix:

When authentication is missing, do not render the empty ticket state. Redirect to login or render only the session error.

## Defect 7: Unauthenticated Ticket Detail Error Has No Direct Login Link

Severity: Low

Page:

```text
/tickets/:id
```

Steps to reproduce:

1. Log out.
2. Navigate directly to a ticket detail URL.

Expected behavior:

The page should provide a clear action back to login, such as a button/link:

```text
Back to login
```

Actual behavior:

The page shows only plain text:

```text
Your login session is missing. Return to the dashboard and log in again.
```

Impact:

The user has no obvious clickable recovery path.

Suggested fix:

Add a visible link/button to `/` when a detail page fails because the session is missing.

## Defect 8: New Member Accounts Can See All Workspace Projects And Tickets

Severity: Review needed

Page:

```text
Dashboard
```

Steps to reproduce:

1. Register a brand-new member user.
2. Land on the dashboard.

Observed behavior:

The new member can see all existing workspace projects and tickets, including tickets created by other users.

Expected behavior:

This depends on the product requirement. If TaskBoard is intended to be an open workspace, this is acceptable. If projects should have membership restrictions, this is a data-access defect.

Impact if project membership is required:

New users can see project/ticket data they may not belong to.

Suggested fix:

Add project membership rules and filter project/ticket queries by the current user's membership.

## Console Errors

No browser console errors were observed during this QA pass.

## Test Data Created

This pass created local QA data:

- Generated member test users.
- A whitespace-title ticket.
- A valid message-test ticket.
- One internal-note test comment.

The data was created in the local development environment only.
