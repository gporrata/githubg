# Jira Tab Implementation Spec

Branch: `add-jira-tickets-tab`

This branch already includes starter Jira shared types, Jira settings in `GithubgSettings`, and store schema support. Continue from this branch and complete the Jira tab feature.

## Goal

Add a third tab named **Jira** to the Electron app. It should let a user authorize Jira Cloud through OAuth 2.0 / 3LO, remember authorization across restarts, and show current-sprint Jira tickets as collapsible cards.

## Current app structure

- Renderer entry: `src/renderer/src/App.tsx`
- Existing PR card: `src/renderer/src/components/PullRequestCard.tsx`
- Preload API: `src/preload/index.ts`
- Main IPC: `src/main/ipc.ts`
- Store: `src/main/store.ts`
- GitHub PR loader: `src/main/github/pullRequests.ts`
- Existing styles: `src/renderer/src/styles.css`

Preserve the current Open PRs and Reviews tab behavior.

## Requirements

### Settings

Add settings UI for:

- Jira OAuth client ID
- Jira site URL, such as `https://example.atlassian.net`
- Jira project key, such as `ABC`

Trim inputs, normalize project key to uppercase, and strip trailing slash from site URL.

### Authorization

Implement Jira Cloud OAuth 2.0 / 3LO for a desktop Electron app using a localhost loopback callback:

```text
http://127.0.0.1:<ephemeral-port>/jira/callback
```

Use the main process to start the temporary callback server, open the browser, exchange the code, discover the accessible Jira site/cloud id, then shut down the server. Support reconnect/disconnect and refresh when needed. Persist authorization so the user stays connected after restart. Prefer OS secure credential storage if practical; otherwise keep the fallback isolated and document it.

Initial scopes:

```text
read:jira-work read:jira-user offline_access
```

### Jira data

Fetch tickets from the configured project's active/current sprint. Include only these statuses:

- Ready
- In Progress
- Waiting for Review
- Needs Validation
- In Validation
- Failed Validation
- Blocked
- Done

Each ticket card needs:

- key
- summary
- readable description text
- Jira link
- status
- sprint name
- story points when discoverable
- associated open GitHub PRs

Story points vary by Jira instance. Discover the field from metadata if possible; fall back to `null`.

Convert Jira Cloud description data into readable plain text. If empty, show `No description.`

### PR linking

Match open GitHub PRs to Jira tickets by case-insensitive ticket key in:

- PR branch name
- PR title
- existing ticket metadata if useful

When a Jira card is open, show associated open PRs. Clicking one should switch to the Open PRs tab and reveal/highlight the matching PR card.

### UI

Add a third tab: **Jira**.

If settings are missing or Jira is not connected, show a clear setup state and a `Grant Jira access` button. Disable the button until required settings exist.

If connected, show tickets as cards. Add a new `JiraTicketCard` component that mirrors `PullRequestCard` patterns: header, expand button, facts grid, collapsed/open state, and expanded details.

Card styling:

- Failed Validation: red border
- Done: blue border
- Other states: use existing neutral/accent style

### IPC surface

Expose Jira methods through preload. Suggested methods:

```ts
getJiraAuthState()
connectJira()
disconnectJira()
listJiraTickets()
setJiraSettings(settings)
```

Suggested IPC names:

- `jira:auth-state`
- `jira:connect`
- `jira:disconnect`
- `jira:tickets:list`
- `settings:set-jira`

### Error states

Handle missing settings, cancelled auth, callback failure, refresh failure, inaccessible site, no active sprint, no tickets, and Jira API errors without crashing the app.

### README

Update README with Jira setup steps: creating an Atlassian OAuth app, required scopes, localhost callback behavior, required app settings, and what the Jira tab displays.

## Validation

Run and fix all failures:

```sh
npm run typecheck
npm run lint
npm run build
```

Open a PR from `add-jira-tickets-tab` to `master` when complete.
