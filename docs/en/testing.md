# Testing

Two runners, with a clean line between them.

| | Runner | Where | What it is for |
|---|---|---|---|
| Unit / integration | Vitest | beside the source it tests | A function, a hook, a component, a server handler — anything that can be decided without a browser |
| End to end | Playwright | [`e2e/`](../../e2e) | What a person opens: the SDK rendering a space, the page server, the builder |

```bash
yarn test          # every package's Vitest suite — the examples' aside
yarn e2e           # the browser suite, for the whole monorepo
```

## Unit tests — Vitest

Co-located with the code (`Component.test.tsx` beside `Component.tsx`), `@testing-library/react` for anything
that renders. Run one package's suite with `yarn workspace @plitzi/<name> test`.

Cover edge cases, re-renders, leaks and performance — not just the happy path.

## End to end — Playwright

One suite at the repo root, because what it tests is the repo rather than any one app. Full detail in
[`e2e/README.md`](../../e2e/README.md); the short version:

```bash
yarn e2e:install               # download the browser, once after cloning
yarn e2e                       # the full run — against a real plitzi-sdk-server
yarn e2e:ci                    # what a machine with nothing provisioned can do
yarn e2e --project=server      # one app, and only the servers it needs
yarn e2e:ui                    # watch it happen, and step back through any action
yarn e2e:report                # open the last report
```

### Categories

**One category per app, sub-categories inside** — a flat list of every feature stops being readable long before
it is complete.

| Category | App | Sub-categories |
|---|---|---|
| `sdk` | `@plitzi/plitzi-sdk` | `rendering`, `viewports` |
| `server` | `@plitzi/sdk-server` | `ssr`, `rsc`, `preview`, `auth`, `actions`, `workers`, `plugins`, `fromSpace` |
| `mcp` | `@plitzi/sdk-mcp` | `endpoint` |
| `builder` | `@plitzi/plitzi-builder` | `boot` |
| `cross` | more than one app | `parity`, `agent`, `auth` |
| `examples` | — (on request only) | one per example |

Both levels are addressable: `yarn e2e --project=server` for the app, `yarn e2e tests/server/rsc` for one part.

Everything but `examples` runs against **surfaces the suite owns**: a browser harness that renders any schema, a
page server with pages, RSC, preview and MCP all on at once, and a second one with accounts and sessions. The examples are not those surfaces — they are written for a person, one wiring decision each, and
bending one to make a test possible breaks what it exists to show.

**The CLI's projects are run, not only written.** `plugins` builds a package `plitzi create --plugin` wrote and loads it
from its manifest; `fromSpace` answers an export from a small platform of its own, runs the built CLI's `create --from`
inside the workspace — so the project resolves the workspace's packages, never npm's — and serves the space from the
project it wrote: its plugin rendered on the server, its runtime's route, its action running its function, its files.
The same cycle against the real platform — API, databases, buckets, upload and push, snapshots, `space pull` — is
`plitzi-sdk-server`'s `test/e2e/flows/spaces/space-as-project.e2e.test.ts` (see
[A space as a project](./projects-from-spaces.md#where-it-is-tested)).

**The `examples` category has its own job.** An example a new user is told to run is a promise: each one has a spec
asserting what its own README claims. They are not part of the workspace's own checks — the root `yarn test`,
`yarn lint`, `yarn typecheck` and `yarn e2e` leave the examples out, and so does CI. `yarn e2e --project=examples`
runs them, when an example is what changed.

### Seeing it happen

`yarn e2e:ui` is the one to reach for: pick tests, watch them run, step back through every action with the DOM as
it was at that moment. The rest are flags on the same command rather than scripts of their own: `--headed` for a
visible browser, `--debug` for the Inspector, `--list` for the test list.

Launch it scoped — `yarn e2e:ui --project=server` — because Playwright's project filter starts on a single
project, and an unscoped window looks empty rather than filtered.

### What a browser can see that nothing else can

Beyond "the right text is on the page", each spec checks properties only a laid-out document has: images that
actually loaded, no horizontal overflow, no text painted in the colour of what sits behind it, no content-bearing
element collapsed to zero area — and it fails on any console error or unhandled rejection, because React turns a
failing effect into a console error and leaves the last good tree on screen.

There are **no committed screenshot baselines**. Screenshots are written to `e2e/.artifacts/screenshots/` to be
looked at; the assertions that gate a run are the ones that mean the same thing on every machine.

One rule worth knowing before writing a spec: **find an element by `data-plitzi-el`, never by `data-id`.** Every
render carries `data-plitzi-el` — the element's id, the name the space gave it (`settings.testAttributes: false` is the
only thing that takes it off). `data-id`, `data-name` and `data-type` are the builder's: they appear only with
debugging on or in the canvas, so a check written against them passes there and fails on the published page.

### Rendering an arbitrary schema

`e2e/harness` is a page that renders whatever `{ schema, style }` it is handed, with no backend and no account:

```bash
yarn workspace @plitzi/e2e start    # http://127.0.0.1:5100
```

Use it to reproduce a reported schema, or to look at a variant without changing an example — changing an example
to answer a question breaks what that example exists to demonstrate.

## In CI

The browser suite runs on every push (`.github/workflows/ci.yml`), **alongside lint** rather than after it —
both need the build, neither needs the other. It provisions nothing: every server it needs, it starts, and
`yarn e2e:ci` answers the backend in the browser. Targets that need something the runner does not have skip with
the reason. The HTML report is uploaded as an artifact, so a failure can be replayed locally with its trace.

## Before opening a PR

```bash
yarn typecheck
yarn lint
yarn test
yarn e2e
```

## See also

- [Development](./development.md) — stack, commands, contribution workflow
- [`e2e/README.md`](../../e2e/README.md) — targets, gates, fixtures, adding a spec
- [`examples/README.md`](../../examples/README.md) — the examples the suite checks
