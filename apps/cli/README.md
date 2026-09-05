# @plitzi/cli

The command line for Plitzi.

```bash
npx @plitzi/cli create my-site
```

## `create`

Scaffolds a project that renders a Plitzi space, installs it, and leaves it ready to start. Two decisions shape
it and nothing else does:

| | `--source local` | `--source cloud` |
|---|---|---|
| **`--mode server`** (default) | A page server of your own, rendering a space that lives in the project. No account. | A page server of your own, rendering the live space out of Plitzi. |
| **`--mode client`** | Vite + the SDK in the browser. No server at all, no account. | The SDK fetches the space from Plitzi with the public render key. |

```bash
plitzi create my-site                          # server + local: the default, and the one that needs nothing
plitzi create my-site --mode client            # browser-rendered, Vite, hot module replacement
plitzi create my-site --source cloud --key …   # read the live space out of Plitzi
plitzi create . --force --no-install           # write into a directory that has work in it, install nothing
```

The package manager comes from the one that invoked it, so `yarn dlx` and `pnpm dlx` get their own commands back
rather than a second lockfile.

## What lands in the project

- **The space, as yours.** A local project gets `src/space.ts` — a *copy* of the space Plitzi gives a new
  account, declared as a tree, some CSS and a palette rather than exported as a document. It is the same
  declaration the platform authors a new space from, so what you start with and what signing up gives you cannot
  come apart — and unlike a document, you can read and change it.
- **A live loop.** In client mode a save is a hot module replacement: the space module is swapped and the tree
  remounted, so the page updates without reloading. In server mode `--watch` restarts the process and the next
  request renders the change.
- **A visual test.** `npm run visual` starts the project, opens the page and asserts that every element the space
  *names* is visible — the strongest assertion available about a page nobody hand-wrote, and it needs no upkeep.
- **The authoring skill**, in `.claude/skills/`, so an agent working in the project knows how a space is put
  together before it touches one.

## Credentials

`create` never mints one. A cloud project's key comes from Credentials in the builder, is written to `.env`, and
`.gitignore` is written in the same breath. Server and browser take **different** keys and the scaffold names
them differently on purpose: a server gets the secret self-hosting key, a browser gets the public render key,
whose protection is the origin it is presenting from.
