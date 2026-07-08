# githubg

- electron based app for viewing github PRs
- main window has several tabs:
  - Open PRs
  - Reviews

## Footer
- a footer with a '+' button (designate team members modal) and a gear icon aligned to the right (settings modal)

### Designate team members
- the '+' button is to show a modal to add or remove members from my team
- the accounts of members should be a drop down of know people in the github repos i have access to
- team member list is persisted locally only (not synced anywhere)

### Settings modal
- the gear icon shows a modal only to select a theme
- have commonly used themes drop down defined
- changing theme instantly changes app theme

## Open PRs
- shows all of my open PRs, scanning every repo the authenticated account can access
- sort PRs by branch name then ticket number
- ticket number off branch name is just regex off the branch name so if tst-7645_require_destination then it would be tst-7645
- branches that don't match the ticket-number regex sort last
- for each open PR show a card
- each PR card has an open or collapsed state
- the open state for a PR shows
  - PR name
  - branch
  - github link to open PR in browser
  - when created
  - number of comments
  - if approved
  - is being merged
  - yellow border if open, no comments
  - red border if open, with comments
  - green border if merged
- the collapsed state for a PR shows
  - all of the open state information as a header
  - each comment thread with links to the PR comment thread
  - merge button (adjustable per-PR to denote how to merge; default to squash merge) if PR is mergeable, disabled until required status checks pass
- even when merged, PR stays visible until its GitHub Actions workflow runs (triggered on merge/push/etc.) complete, capped at the day after it's been merged

## Reviews
- all open PRs authored by other members on my team (not just ones where I'm a requested reviewer)
- similarly show the the PRs like in Open PRs

## General
- use this icon https://imgs.search.brave.com/egGd_9l2fpniYiy3ZuMZCmFdNT_BjSTjTsAs9tqnlbI/rs:fit:860:0:0:0/g:ce/aHR0cHM6Ly9jZG4u/aWNvbnNjb3V0LmNv/bS9pY29uL2ZyZWUv/cG5nLTI1Ni9mcmVl/LWdpdGh1Yi1pY29u/LXN2Zy1kb3dubG9h/ZC1wbmctMTI2NDMx/MzUucG5nP2Y9d2Vi/cCZ3PTEyOA. its ok this app will not be publicly available
- the icon PNG is downloaded once and bundled locally as the app icon
- if there are open PRs show that number in a circle below the icon
- only one githubg app should be running at a time
- when starting check for existing githubg app running and kill it if so, then start fresh

## Architecture Decisions
- stack: Electron + React + TypeScript for the renderer
- auth: reuse the token from an existing local `gh` CLI login (`gh auth login`); no separate PAT entry or OAuth app flow. App requires `gh` to be installed and authenticated on the machine.
- GitHub data access: GraphQL API (fetch PR + reviews + comments + check status in as few requests as possible)
- refresh strategy: polling on an interval (not webhooks, no server/public endpoint needed for a local desktop app)
- local persistence (team member list, settings/theme, merged-PR tracking): a local store (e.g. `electron-store` or SQLite) — nothing synced remotely
- single instance: on launch, detect and kill any existing githubg process, then start the new one (not `requestSingleInstanceLock`/focus-existing)

