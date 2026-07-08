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
- PR cards with branch, ticket parsing, comments, review status, check status,
  GitHub links, review thread links, and merge controls.
- Per-PR merge method selection with squash as the default.
- Local persistence for team members, theme, merge method overrides, and
  post-merge visibility tracking.
- Theme selection that applies immediately.
- Periodic polling refresh and app badge count updates.
