# Testing

Two runners, with a clean line between them.

| | Runner | Where | What it is for |
|---|---|---|---|
| Unit / integration | Vitest | beside the source it tests | A function, a hook, a component, a server handler — anything that can be decided without a browser |
| End to end | Playwright | [`e2e/`](../../e2e) | What a person opens: the examples, the SDK rendering in them, the builder |

```bash
yarn test          # every package's Vitest suite
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
yarn e2e:install                       # download the browser, once after cloning
yarn e2e                               # run everything — servers boot themselves
PLITZI_E2E_TARGETS=render yarn e2e     # boot one target while iterating
yarn e2e:report                        # open the last report
```

**The examples are the suite's backbone.** Each one is a runnable setup the documentation points a new user at,
which makes it a promise — and a promise nothing checks is a promise that breaks. Every example in
[`examples/`](../../examples) has a spec asserting what its own README claims, so a change that quietly breaks
the first thing a new user runs fails here instead of in their terminal.

### What a browser can see that nothing else can

Beyond "the right text is on the page", each spec checks properties only a laid-out document has: images that
actually loaded, no horizontal overflow, no text painted in the colour of what sits behind it, no content-bearing
element collapsed to zero area — and it fails on any console error or unhandled rejection, because React turns a
failing effect into a console error and leaves the last good tree on screen.

There are **no committed screenshot baselines**. Screenshots are written to `e2e/.artifacts/screenshots/` to be
looked at; the assertions that gate a run are the ones that mean the same thing on every machine.

### Rendering an arbitrary schema

`e2e/harness` is a page that renders whatever `{ schema, style }` it is handed, with no backend and no account:

```bash
yarn workspace @plitzi/e2e start    # http://127.0.0.1:4100
```

Use it to reproduce a reported schema, or to look at a variant without changing an example — changing an example
to answer a question breaks what that example exists to demonstrate.

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
