# Browser tests

One Playwright suite for the whole monorepo. What it opens in a real browser is what a new user opens: the
examples the docs point at, the SDK rendering underneath them, and the builder on top.

```bash
yarn e2e                  # everything
yarn e2e:ui               # the same, in Playwright's UI
yarn e2e:report           # open the last run's report
yarn e2e:install          # download the browser (once, after cloning)
```

No server has to be running first — every target boots itself, and one that is already up gets reused.

## What it covers

Each spec is named after a target in [`targets.ts`](./targets.ts), and each target is an example the docs tell
somebody to run. **An example a reader is told to start is a promise; a promise nothing checks is a promise that
breaks.** Adding an example to `targets.ts` is what turns it into a checked one.

| Target | Port | What the spec proves |
|---|---|---|
| `no-build` | 4000 | A static HTML file renders the space — no bundler in the picture |
| `render` | 4001 | `render()` from a bundled app, no server |
| `react-component` | 4002 | `<PlitziSdk>` in a host tree, including unmount/remount and a changed prop |
| `server-rendered` | 4003 | The space is in the HTML **before** any script runs |
| `server-components` | 4004 | RSC elements render, and a partial refresh rebuilds only what was asked for |
| `mcp-server` | 4005 | The MCP example answers the handshake an agent opens with |
| `ssr-preview` | 4006 | An unsaved edit renders once, and `/mcp` does not shadow the pages |
| `sessions` | 4007 | Sign in, see your own details, sign out — over an account store |
| `mysql` | 4008 | The same, over a real database (gated) |
| `harness` | 4100 | Any schema, rendered on demand (see below) |
| `builder` | 3000 | The builder mounts and paints (gated) |

Gated targets need something the machine may not have, so they skip with the instruction to fix it rather than
failing the run:

```bash
PLITZI_E2E_VENDOR=1 yarn e2e     # after `yarn workspace @plitzi/plitzi-sdk build-vendor:prod`
PLITZI_E2E_MYSQL=1 yarn e2e      # with MYSQL_URL pointing somewhere reachable
PLITZI_E2E_BUILDER=1 yarn e2e    # with app.plitzi.local in /etc/hosts
```

While iterating, boot only what you are working on:

```bash
PLITZI_E2E_TARGETS=render,harness yarn e2e
```

## The harness

[`harness/`](./harness) is a page whose only job is to render whatever schema a spec hands it:

```ts
await openHarness(page);
await renderSpace(page, mySpace);   // any { schema, style }
```

The examples each demonstrate one way of wiring Plitzi up, which makes them the wrong place to ask *what does
this schema look like* — changing one to answer that breaks what it demonstrates. The harness has no wiring to
protect, so a reported schema, a one-off reproduction or a variant under test can be rendered and looked at with
no backend, no account and no fixture file.

Open it by hand too: `yarn workspace @plitzi/e2e start`, then <http://127.0.0.1:4100>.

## What a spec asserts

Three layers, in the order a failure is most useful to read:

1. **Content** — the text a reader was promised, through the accessibility tree.
2. **Completeness** — every node in the schema reached the DOM. Derived from `offline-data.json` itself, not from
   a hand-written list, so it cannot drift from the space it checks.
3. **Substance** — [`helpers/visualHealth.ts`](./helpers/visualHealth.ts): images actually loaded, nothing
   overflows the viewport, no text painted in the colour of what is behind it, no content-bearing node collapsed
   to zero area.

Layer 3 is the part a unit test cannot reach and a screenshot does not report. None of it needs a baseline image:
these are properties a laid-out page either has or does not, so they mean the same thing on every machine and
fail with a sentence instead of a diff.

On top of that, **every spec fails on a console error or an unhandled rejection**. React turns a failing effect
into a console error and keeps the last good tree on screen — the exact bug that renders correctly and is broken.
A spec that has read its noise and accepts it says so:

```ts
test.use({ allowedConsoleErrors: [/third-party script/] });
```

## Screenshots

Every spec captures at least one, to `e2e/.artifacts/screenshots/<project>/<spec>--<name>.png`, and attaches it
to the report. They are **artifacts to look at, not baselines to compare against** — there are no committed
snapshots, so nothing here fails because a font rendered half a pixel differently on another machine.

## Adding one

1. Add the target to [`targets.ts`](./targets.ts) — id, workspace, origin, one line on what it is for.
2. Add `tests/<project>/<id>.spec.ts` and wrap it in `describeTarget('<id>', …)`, which names the group and
   handles the gate.
3. Assert what that target promises **beyond** the shared space: `expectSharedSpace(page)` already covers the
   part every example has in common.
