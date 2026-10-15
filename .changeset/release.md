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

## Security

- **A site's credential reads nothing of the space over MCP** (`@plitzi/sdk-mcp`): the `render` token every published
  page embeds — and a self-hosting `host` key — resolved to a grant naming the space, and the MCP served every read
  under it: the unpublished draft, the change history with who made each change and every value before and after, the
  functions' source, the space's private data, its action documents and connectors. Only an `agent` grant attaches a
  space now; any other is a connection with no space (`plitzi_render` and the public guides), told so in the words
  `NO_SPACE_ATTACHED` already uses. A deployment whose `getGrant` answered other scopes for reading must issue agent
  grants for them.

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
    (`SSRAdapters`). The listing budget is 78k (was 77k) for it.
  - **`plitzi space activity [--follow] [--after <cursor>] [--mine] [--limit <n>] [--json]`** (`@plitzi/cli`), over
    the platform's `GET /spaces/:spaceId/activity`; `--follow` stays, one page a line with `--json`, and asks again
    when the platform does not answer.
  - **The people in the builder see the agent work** (`@plitzi/sdk-server`, `@plitzi/sdk-shared`, `@plitzi/sdk-mcp`,
    `@plitzi/plitzi-builder`): an agent grant carries the application the member connected (`Grant.client`,
    `StoredSpaceToken.client`, `SSRGrant.client`), and every MCP write `SSRWriteContext.client` — the history's
    `client` for an agent, which was never set. A collaborator may be an agent (`SubscriptionCollaborator.agent`): the
    builder draws it as a robot, names it `Claude · for ana` (`collaboratorTitle`) in the header, on the canvas and in
    its notices. The deployment announces it — Plitzi's joins it on a write, selects what it changed, and lets it go
    after a minute of nothing. `activityLine` names it the same way (`Claude for ana over the MCP, …`), so
    `plitzi space activity` says which application wrote.
  - A tool may declare `documents: false` (`ToolSpec`): the host loads none of the space for it, and passes the call's
    abort signal through `ToolContext.activity`.

## Authoring

- **A file that does not parse is said at its line under any loader** (`@plitzi/sdk-authoring`): `moduleProblem` read
  the first line of the error, and an esbuild transform (tsx, vitest) puts only `Transform failed with 1 error:` there
  — the file, line and what is wrong are on the next. A line of the message that points at a file of the project is
  now the problem (`src/space/hero.ts:139: Expected "}" but found ";"`), the project's root matched as given and as it
  is on disk (`/var/…` and `/private/var/…` on macOS).

## Testing

- **`unusedPort` is chosen where the system never hands one out** (`@plitzi/sdk-server`): it answered a port the system
  had just handed out (`listen(0)`), from the ephemeral range every outgoing connection takes its local port from — so
  another worker's request could take it before the test listened, and CI failed `runtime.test.ts` with `EADDRINUSE`
  (the page server then ends the process). It is a free port below that range now, at random, checked first.

## Docs

- **A self-hosted runtime's endpoints go in `data`**, as 0.38.15 moved them: `docs/en/runtimes.md`, the
  `10-runtime` example and the website still put `served.stage` in `preAuth`, before the cross-site guard.
- New: `docs/en/activity.md`; `space watch` in `docs/en/agent-tooling.md`'s loop; the CLI README, the CLI skill, the
  generated project's `AGENTS.md`, the MCP guide and README.
