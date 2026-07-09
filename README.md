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
- Jira tab for current-sprint Jira Cloud tickets assigned to the connected
  Atlassian account, with linked open GitHub PRs.
- PR cards with branch, ticket parsing, comments, review status, check status,
  GitHub links, review thread links, and merge controls.
- Per-PR merge method selection with squash as the default.
- Local persistence for team members, theme, merge method overrides, Jira
  credentials, and post-merge visibility tracking.
- Theme selection that applies immediately.
- Periodic polling refresh and app badge count updates.

## Jira setup

Open the Jira tab and use the API token link to create an Atlassian API token:

```text
https://id.atlassian.com/manage-profile/security/api-tokens
```

Enter your Jira URL, Atlassian email, and API token in the Jira tab. The Jira
URL field accepts values such as `https://tstllc.jira.com`; the app trims values
and strips trailing slashes from the site URL.

After the API token is entered, githubg verifies access with Jira's
`/rest/api/3/myself` endpoint. If verification succeeds, the credentials are
stored locally in the app store and the Jira tab loads current-sprint tickets
assigned to the connected account. Disconnect Jira from the Jira tab to remove
the stored credentials.

The Jira tab shows current-sprint tickets whose status is Ready, In Progress,
Waiting for Review, Waiting for Peer Review, Needs Validation, In Validation,
Failed Validation, Blocked, or Done. It discovers common sprint and story point
fields from Jira metadata when possible. Open GitHub PRs are linked to tickets by
matching the Jira key in the branch name or PR title.
