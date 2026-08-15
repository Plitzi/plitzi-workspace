# Browser tests

One Playwright for the whole monorepo, cut into categories you can run on their own.

```bash
yarn e2e:install               # download the browser (once, after cloning)
yarn e2e                       # everything
yarn e2e --project=rsc         # one category — and only the servers it needs
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

## Categories

Each is a Playwright project — `yarn e2e --project=<name>`.

| Category | What it covers | Runs against |
|---|---|---|
| `sdk` | The SDK rendering in a browser: elements, the space stylesheet, viewports, arbitrary schemas | harness |
| `ssr` | Pages rendered by the server — what arrives before a script runs, and what happens after | e2e server |
| `rsc` | Per-element server data: the three runtimes, the slices, the partial refresh | e2e server |
| `preview` | Draft renders that are never saved, and the one-shot token that serves one | e2e server |
| `mcp` | The endpoint an agent connects to, mounted beside the pages it edits | e2e server |
| `combined` | Flows that cross surfaces | harness + e2e server |
| `examples` | Every example still does what its own README says | the examples |
| `builder` | The visual builder | builder (gated) |

**`combined` is the one that earns its keep.** Most of what breaks in this repo breaks *between* two things that
each work: the client and server render paths disagreeing, a token minted by one package that the other will not
accept. Those failures are invisible to every category above it.

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

`spaces/` holds what they render: `sampleSpace()` is the one the examples ship (so these specs and a reader see
the same thing), `minimalSpace()` is two elements and a stylesheet, for when a spec is about one thing and thirty
elements around it would only add thirty possible causes to a failure.

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

- **A test for something that exists** — put it in the category it belongs to. If it needs two surfaces, it
  belongs in `combined`.
- **A new surface to test** — add a target to [`targets.ts`](./targets.ts), then list it in the category that
  needs it in [`categories.ts`](./categories.ts). Declaring it there is what makes Playwright start it.
- **A new category** — one entry in `categories.ts` and a matching `tests/<name>/` directory.
- **Something the e2e server cannot do yet** (auth, a second space, a plugin) — add it to `server/main.ts`. It is
  a fixture, not a demonstration: it is allowed to turn everything on.
