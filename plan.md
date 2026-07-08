# plan.md

## Runner Prompt

Implement githubg following `plan.md` one commit at a time, in order. For each
unchecked item under "Commits": implement only the scope described, run
lint/typecheck/build (and tests if present), then create a git commit using
the exact semantic message shown (append detail after the colon only if
useful). Check the box off in `plan.md` in the same commit. Push the commit. Do not combine
commits. The continue to the next. Repeat until all commits are done.

Once done remove plan.md. Reedit about.md so that its clear and understandable. commit + push.

## Architecture Decisions

- **Stack**: Electron + React + TypeScript for the renderer.
- **Auth**: reuse the token from an existing local `gh` CLI login
  (`gh auth login`) — no separate PAT entry or OAuth app flow. The app
  requires `gh` to be installed and authenticated on the machine.
- **GitHub data access**: GraphQL API, fetching PR + reviews + comments +
  check status in as few round trips as possible.
- **Repo scope**: every repo the authenticated account can access (no
  configured repo allowlist).
- **Refresh strategy**: polling on an interval — no webhooks, no server/public
  endpoint needed for a local desktop app.
- **Reviews tab semantics**: all open PRs authored by teammates, not just PRs
  where the user is a requested reviewer.
- **Local persistence**: team member list, settings/theme, and merged-PR
  tracking state live in a local store (`electron-store` or SQLite) —
  nothing synced remotely.
- **Ticket number sort**: parsed via regex off the branch name; branches that
  don't match sort last.
- **Post-merge visibility**: a PR stays visible after merge until its
  GitHub Actions workflow runs (triggered on merge/push/etc.) complete,
  capped at the day after the merge.
- **Merge button**: per-PR override of merge method, default squash;
  disabled until required status checks pass.
- **Single instance**: on launch, detect and kill any existing githubg
  process, then start fresh (not `requestSingleInstanceLock`/focus-existing).
- **Icon**: the linked PNG is downloaded once and bundled locally as the app
  icon; a badge shows the open PR count.

## Commits

- [x] `chore: scaffold electron + react + typescript app`
  Set up project skeleton (electron-vite or electron-forge with a
  vite-react-ts template), base tsconfig, eslint/prettier, npm scripts for
  dev/build/lint.

- [x] `feat: enforce single running instance via kill-and-restart`
  On app launch, detect an existing githubg process and kill it before
  continuing startup.

- [x] `feat: add bundled app icon and dock/tray badge count`
  Download and bundle the linked PNG as the app icon; wire up a badge
  showing the current open PR count (placeholder count until data layer
  exists).

- [x] `feat: resolve github token from local gh CLI session`
  On startup, shell out to `gh auth token` (or equivalent) to obtain the
  token; fail with a clear error message if `gh` isn't installed/authed.

- [x] `feat: add graphql client for github api access`
  Wire up an authenticated GraphQL client (e.g. `@octokit/graphql`) using
  the resolved token; add a typed query module for PR + reviews + comments
  + check status.

- [x] `feat: fetch and parse open PRs across accessible repos`
  Query all open PRs authored by the user across every accessible repo;
  parse ticket number from branch name via regex; sort by branch name then
  ticket number, unmatched branches last.

- [ ] `feat: add local persistence store`
  Set up `electron-store` (or SQLite) with schemas for team members,
  settings (theme), and merged-PR tracking state.

- [ ] `feat: build main window shell with tabs and footer`
  Main window layout: Open PRs / Reviews tabs, footer with '+' button
  (left) and gear icon (right aligned).

- [ ] `feat: implement PR card component with open/collapsed states`
  Card shows PR name, branch, GitHub link, created date, comment count,
  approval status, merge-in-progress state, and border color rules
  (yellow/red/green). Collapsed state adds comment threads with links.

- [ ] `feat: add per-pr merge button with method selector`
  Merge button on collapsed card, default squash, per-PR method override;
  disabled until required status checks pass; calls GraphQL/REST mutation
  to merge on click.

- [ ] `feat: track post-merge visibility via workflow run completion`
  After a PR merges, keep it visible until its triggered GitHub Actions
  workflow runs complete, capped at the day after merge; persist merge
  timestamp in local store.

- [ ] `feat: implement reviews tab`
  Fetch and render all open PRs authored by configured team members,
  reusing the PR card component.

- [ ] `feat: add designate team members modal`
  '+' button opens a modal to add/remove team members via a dropdown of
  known GitHub users from accessible repos; persists to local store.

- [ ] `feat: add settings modal with theme selection`
  Gear icon opens a modal with a dropdown of common predefined themes;
  selecting a theme instantly applies it and persists the choice.

- [ ] `feat: poll github api on an interval and refresh ui`
  Background polling loop refreshes Open PRs / Reviews data and the open
  PR badge count on a configurable interval.

- [ ] `build: package app with electron-builder`
  Configure packaging/build output for local installs (app is not
  publicly distributed).

- [ ] `docs: add readme with setup and usage instructions`
  Document prerequisites (`gh` CLI installed/authenticated), install/dev/
  build commands, and a short feature overview.
