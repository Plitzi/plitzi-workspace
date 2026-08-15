# Browser tests

One Playwright for the whole monorepo, cut into categories you can run on their own.

```bash
yarn e2e:install               # download the browser (once, after cloning)
yarn e2e                       # everything
yarn e2e --project=server      # one app — and only the servers it needs
yarn e2e:list                  # what exists, without running it
```

Nothing has to be running first: every category declares the servers it needs and Playwright starts them. One
that is already up gets reused.

## Seeing it happen

| Command | What you get |
|---|---|
| `yarn e2e:ui` | **The one to reach for.** Playwright's UI: pick tests, watch them run, step back through every action with the DOM as it was at that moment |
| `yarn e2e:headed` | The same run, in a browser window you can watch |
| `yarn e2e:debug` | The Inspector — pause, step, try selectors against the live page |
| `yarn e2e:codegen` | Click around the harness and get the code for what you did |
| `yarn e2e:report` | The last run's report, with screenshots and traces |

`e2e:codegen` opens the harness at <http://127.0.0.1:4100>, so start it first with
`yarn workspace @plitzi/e2e start` (or point codegen at any other target).

> **Launch the UI scoped: `yarn e2e:ui --project=server`.** Opened with no project, Playwright's own project
> filter starts on a single one — the panel shows two files and looks broken rather than filtered. The filter
> itself is behind the collapsed chevron at the top left, next to `Status: all  Projects: …`; ticking the apps
> you want there does the same thing.
>
> UI mode also starts only the servers the suite owns (three), not the examples' nine — unscoped it would sit on
> an empty panel for the better part of a minute. `yarn e2e:ui --project=examples` brings those up when they are
> what you are working on.

## Categories

**One per app, sub-categories inside.** The top level answers *which app is this about*; the level below answers
*which part of it*. A flat list of every feature stops being readable long before it is complete.

| Category | App | Sub-categories | Runs against |
|---|---|---|---|
| `sdk` | `@plitzi/plitzi-sdk` | `rendering`, `viewports` | harness |
| `server` | `@plitzi/sdk-server` | `ssr`, `rsc`, `preview`, `auth` | e2e server + auth server |
| `mcp` | `@plitzi/sdk-mcp` | `endpoint` | e2e server |
| `builder` | `@plitzi/plitzi-builder` | `boot` | builder (gated) |
| `cross` | — more than one | `parity`, `agent`, `auth` | harness + both servers |
| `examples` | — onboarding | one per example | the examples |

Both levels are addressable, and a category starts only the servers it declares:

```bash
yarn e2e --project=server            # the whole page server
yarn e2e tests/server/rsc            # one part of it, by path
yarn e2e --project=server tests/server/auth
```

**`cross` is the one that earns its keep.** Most of what breaks in this repo breaks *between* two apps: the client
and server render paths disagreeing, a token minted by one package that another will not accept. Those failures
are invisible to every category above it.

## Where the tests run

Two surfaces, both owned by this package. That is deliberate: the examples are written for a person, and a spec
that needs RSC and preview at once would have to bend one to get them — which breaks what that example exists to
demonstrate.

- **`harness/`** — a page that renders whatever schema a spec hands it, with no server at all:

  ```ts
  await openHarness(page);
  await renderSpace(page, minimalSpace({ heading: 'anything' }));
  ```

  Open it by hand too: `yarn workspace @plitzi/e2e start` → <http://127.0.0.1:4100>. It is also the fastest way
  to look at a reported schema without a backend, an account or a fixture file.

- **`server/`** — a page server with everything on at once: pages, RSC (with its three probe elements), draft
  preview and the MCP endpoint, on <http://127.0.0.1:4200>. Its space lives in memory, so a write through MCP is
  visible to the run and never touches anything on disk. `yarn workspace @plitzi/e2e start:server`.

- **`server/authServer.ts`** — the same, with people in it, on <http://127.0.0.1:4201>: real password hashing, a
  session per account, and a space carrying both ways a site keeps a visitor out — two pages sharing `/` that
  differ by `accessLevel`, and a protected `/account` that redirects a guest to `/login`.
  `yarn workspace @plitzi/e2e start:auth`.

`spaces/` holds what they render: `sampleSpace()` is the one the examples ship (so these specs and a reader see
the same thing), `minimalSpace()` is two elements and a stylesheet for when a spec is about one thing and thirty
elements around it would only add thirty possible causes to a failure, and `authSpace()` is the four-page space
the `auth` category walks.

> The account store keeps **one session per account**, as a real one does. That is why `tests/auth` runs serially:
> two tests signing in as the same person in parallel would each quietly retire the other's session.

The `examples` category is the exception, and its job is narrower: **an example a new user is told to run is a
promise**, and that category is the promise being kept. Nothing else depends on the examples.

## What a spec asserts

Three layers, in the order a failure is most useful to read:

1. **Content** — the text a reader was promised, through the accessibility tree.
2. **Completeness** — every element the schema declares reached the DOM, counted per type. Derived from the space
   itself, so it cannot drift from what it checks.
3. **Substance** — [`helpers/visualHealth.ts`](./helpers/visualHealth.ts): images actually loaded, nothing
   overflowing the viewport, no text painted in the colour of what is behind it, no content-bearing element
   collapsed to zero area.

> Assert on classes (`.plitzi-component__heading`), never on `data-id`. Those attributes are **server-side only** —
> they exist so hydration can find what the server rendered, and a client-side render emits none. A check written
> against them can only ever pass against SSR, and looks like a broken renderer everywhere else.

On top of that, **every spec fails on a console error or an unhandled rejection**. React turns a failing effect
into a console error and keeps the last good tree on screen — the exact bug that renders correctly and is broken.
A spec that has read its noise and accepts it says so:

```ts
test.use({ allowedConsoleErrors: [/third-party script/] });
```

## Screenshots

Every spec captures at least one, to `e2e/.artifacts/screenshots/<category>/<spec>--<name>.png`, and attaches it
to the report. They are **artifacts to look at, not baselines to compare against** — there are no committed
snapshots, so nothing fails because a font rendered half a pixel differently on another machine.

## Gates

A gated target needs something this machine may not have, so it skips with the instruction to fix it rather than
failing the run:

```bash
PLITZI_E2E_VENDOR=1 yarn e2e     # after `yarn workspace @plitzi/plitzi-sdk build-vendor:prod`
PLITZI_E2E_MYSQL=1 yarn e2e      # with MYSQL_URL pointing somewhere reachable
PLITZI_E2E_BUILDER=1 yarn e2e    # with app.plitzi.local in /etc/hosts
```

`PLITZI_E2E_TARGETS=harness yarn e2e` narrows further by hand, for iterating on one surface.

## Adding to it

- **A test for something that exists** — `tests/<app>/<part>/`. If it needs more than one app, it belongs in
  `tests/cross/`.
- **A new part of an app** — a new directory under that app, plus a line in that category's `subcategories` in
  [`categories.ts`](./categories.ts) so it is documented rather than merely present.
- **A new app** — one entry in `categories.ts` with its `app` and `targets`, and a matching `tests/<name>/`.
- **A new surface to test against** — add a target to [`targets.ts`](./targets.ts) and list it in the categories
  that need it. Declaring it there is what makes Playwright start it.
- **Something the e2e servers cannot do yet** — add it to `server/main.ts` (or `authServer.ts`). They are
  fixtures, not demonstrations: they are allowed to turn everything on.
