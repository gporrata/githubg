# githubg

githubg is a local Electron app for tracking GitHub pull requests across the
repositories your authenticated GitHub account can access.

## Prerequisites

- Node.js 24 or newer
- GitHub CLI installed
- GitHub CLI authenticated with `gh auth login`

githubg reuses the local `gh` CLI session. It does not ask for or store a
separate personal access token.

## Commands

```sh
npm install
npm run dev
npm run lint
npm run typecheck
npm run build
npm run pack
```

`npm run pack` creates an unpacked local app build under `release/`.
`npm run dist` creates installer artifacts with Electron Builder.

## Features

- Open PRs tab for pull requests authored by the authenticated user.
- Reviews tab for open pull requests authored by locally designated teammates.
- Jira tab for current-sprint Jira Cloud tickets in configured workflow statuses,
  with linked open GitHub PRs.
- PR cards with branch, ticket parsing, comments, review status, check status,
  GitHub links, review thread links, and merge controls.
- Per-PR merge method selection with squash as the default.
- Local persistence for team members, theme, merge method overrides, Jira
  settings, Jira authorization, and post-merge visibility tracking.
- Theme selection that applies immediately.
- Periodic polling refresh and app badge count updates.

## Jira setup

Create an Atlassian OAuth 2.0 (3LO) app in the Atlassian developer console and
add these scopes:

```text
read:jira-work read:jira-user offline_access
```

In githubg Settings, enter the Jira site URL, project key, OAuth client ID, and
OAuth client secret. The app trims values, uppercases the project key, and strips
trailing slashes from the site URL.

When you grant Jira access, githubg starts a temporary localhost callback server
at:

```text
http://127.0.0.1:<ephemeral-port>/jira/callback
```

The app opens the Atlassian consent flow in your browser, exchanges the returned
code in the main process, discovers the configured Jira Cloud site, and stores
the resulting tokens locally in the app store so Jira stays connected across
restarts. Disconnect Jira from Settings to remove the stored Jira tokens.

The Jira tab shows current-sprint tickets for the configured project whose
status is Ready, In Progress, Waiting for Review, Needs Validation, In
Validation, Failed Validation, Blocked, or Done. It discovers common sprint and
story point fields from Jira metadata when possible. Open GitHub PRs are linked
to tickets by matching the Jira key in the branch name or PR title.
