# githubg

githubg is a local Electron app for keeping track of GitHub pull requests across
the repositories available to the authenticated GitHub CLI account.

## Stack

- Electron, React, TypeScript, and electron-vite.
- GitHub authentication is reused from `gh auth login`.
- GitHub data is fetched with authenticated GraphQL queries, plus GitHub Actions
  REST calls for post-merge workflow status.
- Local-only persistence uses `electron-store`.
- Local packaging uses Electron Builder.

## Main Views

- Open PRs: pull requests authored by the authenticated user.
- Reviews: open pull requests authored by locally designated team members.

Both views render PR cards with branch and ticket information, GitHub links,
created date, comment and review status, merge status, check status, review
threads, and merge controls.

## Local Features

- Team members can be added or removed from a modal opened with the footer plus
  button.
- The settings modal provides predefined themes that apply immediately.
- Per-PR merge methods are persisted locally, with squash as the default.
- Merged PRs stay visible until related GitHub Actions workflow runs complete,
  capped at one day after merge.
- The app polls GitHub on an interval and updates the app badge with the open PR
  count.
- Launching githubg kills an existing `githubg` process before opening a fresh
  instance.
