# @plitzi/cli

The command line for Plitzi.

```bash
npx @plitzi/cli create my-site
```

## `create`

Scaffolds a project that renders a Plitzi space, installs it, and leaves it ready to start. Three choices shape it —
the package manager, `--mode` and `--source` — and they are the person's to make, so `create` never makes them alone:

- **At a terminal**, anything not passed is asked for, with the likely answer offered as the default.
- **With nobody at the terminal** — an agent, CI — it stops before writing anything and prints the flags still
  missing, so the agent asks the person rather than guessing. `--yes` takes the defaults (`server`, `local`, the
  invoking package manager) for a script that genuinely means them.

| | `--source local` | `--source cloud` |
|---|---|---|
| **`--mode server`** | A page server of your own, rendering a space that lives in the project. No account. | A page server of your own, rendering the live space out of Plitzi. |
| **`--mode client`** | Vite + the SDK in the browser. No server at all, no account. | The SDK fetches the space from Plitzi with the public render key. |

```bash
plitzi create my-site                                                 # asks the three choices
plitzi create my-site --package-manager npm --mode server --source local
plitzi create my-site --package-manager pnpm --mode client --source local   # Vite, hot module replacement
plitzi create my-site --package-manager yarn --mode server --source cloud --key …   # the live space
plitzi create my-site --yes                                           # server + local + the invoking manager
plitzi create . --force --no-install --yes                            # into a directory that has work in it
```

## The package manager

`--package-manager npm|yarn|pnpm` says which one the project is written for: what it installs with, and what
every command in its README and its Playwright config names. The one that invoked the CLI is only offered as the
default when it is asked for — `yarn dlx` and `pnpm dlx` get their own name suggested — because it is a guess about
the *invocation*: running `npx` once to scaffold a project you then work in with Yarn is exactly the case it gets
wrong.

A Yarn project also gets a `.yarnrc.yml` pinning `nodeLinker: node-modules`. Yarn 4 installs Plug'n'Play by
default and a server-mode project cannot start under it — `node --import tsx` dies resolving its own entry — so
the linker is pinned to the layout npm and pnpm already give it.

Each project also carries what lets its **first install through on release day**, which is the day every
`@plitzi/*` package it depends on is new:

| Manager | File | Why |
|---|---|---|
| npm | `allowScripts` in `package.json` | npm 11 lists unreviewed install scripts and will start blocking them: esbuild's is approved, fsevents' (a prebuilt binary beside a `binding.gyp`) refused |
| pnpm | `pnpm-workspace.yaml` | pnpm stops the install over a skipped build (`allowBuilds: esbuild`), and holds back packages under its minimum release age (`minimumReleaseAgeExclude: @plitzi/*`) |
| Yarn | `.yarnrc.yml` | Yarn quarantines packages younger than a day (YN0016): `npmPreapprovedPackages: @plitzi/*` — written only for Yarn ≥ 4.10, since an older Yarn refuses a setting it does not know |

The exemptions cover `@plitzi/*` only. A third-party dependency published in the last day is still held back, and
when an install fails the CLI says which setting names it.

## What lands in the project

- **The space, as yours.** A local project gets `src/space.ts` — a *copy* of the space Plitzi gives a new
  account, declared as a tree, some CSS and a palette rather than exported as a document. It is the same
  declaration the platform authors a new space from, so what you start with and what signing up gives you cannot
  come apart — and unlike a document, you can read and change it.
- **A live loop.** In client mode a save is a hot module replacement: the space module is swapped and the tree
  remounted, so the page updates without reloading. In server mode `--watch` restarts the process and the next
  request renders the change.
- **A plugin of the project's own.** `src/plugins/StatCard` is a React component the space renders through a
  `custom` element — the one thing about Plitzi a page of built-in elements cannot show. Its props ARE the
  element's attributes, so a data source pointed at that element later reaches the component with no plumbing in
  between. Server-rendered in server mode (`action: 'compile'`), part of the bundle in client mode.
- **A visual test.** The `visual` script starts the project, opens the page and asserts that every element the space
  *names* is visible — the strongest assertion available about a page nobody hand-wrote, and it needs no upkeep.
- **Prettier and ESLint**, configured rather than mentioned: type-checked rules, with Prettier owning layout and
  `eslint-config-prettier` keeping the two from arguing on save. `lint` and `format` are scripts from the first
  commit, which is the only moment a repository's style is cheap to decide.
- **The authoring skill**, in `.claude/skills/`, so an agent working in the project knows how a space is put
  together before it touches one.

## Credentials

`create` never mints one. A cloud project's key comes from Credentials in the builder, is written to `.env`, and
`.gitignore` is written in the same breath. Server and browser take **different** keys and the scaffold names
them differently on purpose: a server gets the secret self-hosting key, a browser gets the public render key,
whose protection is the origin it is presenting from.
