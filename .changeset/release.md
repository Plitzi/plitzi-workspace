---
'@plitzi/plitzi-builder': patch
'@plitzi/cli': patch
'@plitzi/sdk-mcp': patch
'@plitzi/plitzi-sdk': patch
'@plitzi/sdk-server': patch
'@plitzi/sdk-auth': patch
'@plitzi/sdk-authoring': patch
'@plitzi/sdk-dev-tools': patch
'@plitzi/sdk-elements': patch
'@plitzi/sdk-event-bridge': patch
'@plitzi/sdk-interactions': patch
'@plitzi/sdk-navigation': patch
'@plitzi/sdk-plugins': patch
'@plitzi/sdk-schema': patch
'@plitzi/sdk-shared': patch
'@plitzi/sdk-style': patch
'@plitzi/sdk-variables': patch
---

## Agents

- **`plitzi space watch`** (`@plitzi/cli`): the space read again on every save of `src/space/`, `src/plugins/`,
  `src/data/` or `public/data/`, and only what changed said — what the save did to the space element by element, the
  findings and warnings it brought and fixed (one that only moved down its file is the same one), a save that changed
  nothing, or that the space stopped authoring and why. `--json` is one event a line (`ready`, `pass`, `refused`,
  `error`), for an agent to run in the background instead of `author` and `space lint` after every edit. Each pass reads
  the space in a process of its own (`space watch-pass`, hidden). `space lint`'s reading is `spaceFindings`, shared.
- **A space's activity, followed** (`@plitzi/sdk-shared`, `@plitzi/sdk-mcp`, `@plitzi/cli`): what happened on a space
  after a cursor — its draft changed (a person in the builder, an agent, the autofix), a version went out, a server
  action failed or was refused — and, with nothing yet, waited for, up to 50 s. One vocabulary,
  `@plitzi/sdk-shared/activity` (`SpaceActivity`, `SpaceActivityPage`, `activityLine`, `isSpaceActivityPage`, the
  limits); the reader's own writes left out and counted (`skippedMine`), `mine` keeps them.
  - **`plitzi_activity { after, wait, limit, mine }`** (`@plitzi/sdk-mcp`), on the new `getActivity` adapter
    (`SSRAdapters`). Only an `agent` grant reads it: a site's `render` token or a `host` key is answered
    `MEMBER_GRANT_REQUIRED`. The listing budget is 78k (was 77k) for it.
  - **`plitzi space activity [--follow] [--after <cursor>] [--mine] [--limit <n>] [--json]`** (`@plitzi/cli`), over
    the platform's `GET /spaces/:spaceId/activity`; `--follow` stays, one page a line with `--json`, and asks again
    when the platform does not answer.
  - A tool may declare `documents: false` (`ToolSpec`): the host loads none of the space for it, and passes the call's
    abort signal through `ToolContext.activity`.

## Docs

- **A self-hosted runtime's endpoints go in `data`**, as 0.38.15 moved them: `docs/en/runtimes.md`, the
  `10-runtime` example and the website still put `served.stage` in `preAuth`, before the cross-site guard.
- New: `docs/en/activity.md`; `space watch` in `docs/en/agent-tooling.md`'s loop; the CLI README, the CLI skill, the
  generated project's `AGENTS.md`, the MCP guide and README.
