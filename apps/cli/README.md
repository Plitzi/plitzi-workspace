# @plitzi/cli

The command line for Plitzi.

```bash
npx @plitzi/cli create my-site                 # a project that renders a space
npx @plitzi/cli add plugin seat-picker legend  # elements of your own, in the project you are in
npx @plitzi/cli create seat-picker --plugin    # a plugin package any space can load
npx @plitzi/cli pack plugin                    # a plugin built, and zipped the way the builder takes it
npx @plitzi/cli upload plugin                  # that zip, on the space you work in, and installed there
```

## `create`

Scaffolds a project that renders a Plitzi space, installs it, and leaves it ready to start. Three choices shape it —
the package manager, `--mode` and `--source` — and they are the person's to make, so `create` never makes them alone:

- **At a terminal**, anything not passed is asked for, with the likely answer offered as the default.
- **With nobody at the terminal** — an agent, CI — it stops before writing anything and prints each missing choice
  as a question for the person, addressed to the agent that ran it: ask the user, wait, run again with their answers.
  It offers no way around them: `--yes` only takes the defaults (`server`, `local`, the invoking package manager) for
  a person at a terminal. A script passes the three flags — which is also what makes it reproducible.

| | `--source local` | `--source cloud` |
|---|---|---|
| **`--mode server`** | A page server of your own, rendering a space that lives in the project. No account. | A page server of your own, rendering the live space out of Plitzi. |
| **`--mode client`** | Vite + the SDK in the browser. No server at all, no account. | The SDK fetches the space from Plitzi with the public render key. |

```bash
plitzi create my-site                                                 # asks the three choices
plitzi create my-site --package-manager npm --mode server --source local
plitzi create my-site --package-manager pnpm --mode client --source local   # Vite, hot module replacement
plitzi create my-site --package-manager yarn --mode server --source cloud --key …   # the live space
plitzi create my-site --yes                                           # at a terminal: server + local + the invoking manager
plitzi create . --force --no-install --package-manager npm --mode server --source local   # into a directory that has work in it
```

## The package manager

`--package-manager npm|yarn|pnpm` says which one the project is written for: what it installs with, and what
every command in its README and its Playwright config names. The one that invoked the CLI is only offered as the
default when it is asked for — `yarn dlx` and `pnpm dlx` get their own name suggested — because it is a guess about
the *invocation*: running `npx` once to scaffold a project you then work in with Yarn is exactly the case it gets
wrong.

A Yarn project also gets a `.yarnrc.yml` pinning `nodeLinker: node-modules`. Yarn 4 installs Plug'n'Play by
default, and the project runs straight from `node_modules` — its server by Node, its plugins by the page server's
bundler — so the linker is pinned to the layout npm and pnpm already give it.

## Node runs the TypeScript

Every script that runs TypeScript — `start`, `author`, `shot` — is plain `node`: Node 22.18+ strips the types
itself, so nothing transpiles beside the server. (`tsx` did, and its loader thread cost a page server more memory
than the server: ~270 MB to start where the same server starts in ~90.) The project's `tsconfig` holds it to what
that needs — relative imports name their `.ts` file (`allowImportingTsExtensions`), type-only imports say so
(`verbatimModuleSyntax`), nothing is written that stripping would leave broken (`erasableSyntaxOnly`) — so a
mistake is a `typecheck` error, not a crash at `npm start`. `engines` says `>=22.18`.

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
  `custom` element — the one thing about Plitzi a page of built-in elements cannot show. Every folder of
  `src/plugins` is registered by itself, under its name in camelCase, so `plitzi add plugin` is all a new one takes. Its props ARE the
  element's attributes, so a data source pointed at that element later reaches the component with no plumbing in
  between. Server-rendered in server mode (`action: 'compile'`), part of the bundle in client mode.
- **A visual test.** The `visual` script starts the project, opens the page and asserts that every element the space
  *names* is visible — the strongest assertion available about a page nobody hand-wrote, and it needs no upkeep.
- **Prettier and ESLint**, configured rather than mentioned: type-checked rules, with Prettier owning layout and
  `eslint-config-prettier` keeping the two from arguing on save. `lint` and `format` are scripts from the first
  commit, which is the only moment a repository's style is cheap to decide.
- **The authoring skill**, in `.claude/skills/`, so an agent working in the project knows how a space is put
  together before it touches one.

## `add plugin`

Adds elements of your own to the project you are in — one, several at once (`add plugin seat-picker legend`), or one at
a time as the need comes. Each is a folder, written the way Plitzi's own elements are (`@plitzi/sdk-elements`): the
component, its `declaration.ts` (its `type`, the events it fires, the actions it answers to, and the element the builder
adds), its `Settings.tsx` panel for the builder, and the `index.ts` that puts them together. It asks what to call each,
what the builder shows, and what it is for, and checks every folder is free before writing any.

- **In a project `plitzi create` wrote**, it goes in `src/plugins`, where the project already looks: nothing to
  register, and `start:dev` restarts onto it. Host it with `custom({ renderType: 'seatPicker' })` in `src/space.ts`
  — or, when the space lives in Plitzi, with a Custom element in the builder.
- **In a project written before plugins were found by folder**, it goes in `src/plugins` too, and prints the line to
  add to the `plugins` list in `src/main.ts`.
- **In a plugin package**, it goes in `src/`, and is added to `src/elements.ts` and `src/declarations.ts`, from which
  the package publishes it.
- **In any other project**, it asks which folder holds the project's components (`--dir` answers it) and prints how
  to register the element — for `render()`, for `<PlitziSdk>` in a React application, and for a page server.

A name that would make a built-in element's type (`button`, `form`) is refused: a space could not tell the two apart.

## `create --plugin`

A plugin package: elements any space can load, with a Vite preview to write them in. It builds nothing itself —
`pack plugin` does, for every plugin — so it carries no bundler config and no build dependency.

```bash
plitzi create seat-picker --plugin                   # asks the name, what the builder shows, what it is for, who publishes it
plitzi create packages/seat-picker --plugin --name @acme/plitzi-plugin-seat-picker --package-manager yarn
plitzi create seat-picker --plugin --elements legend,price-tag   # a package of three elements
```

Without a directory, inside a repository, it offers the folders that repository keeps its packages in (its workspace
globs, and `plugins/`); inside one it installs with the repository's own package manager and leaves its install
settings alone.

Its scripts: `start` (every element inside a space, rendered by the SDK in the browser, with hot module
replacement), `visual` (a browser checks each element renders, answers a click, and leaves the page whole),
`typecheck`, `lint` and `format`.

## `pack plugin`

The one place a plugin is built — from a plugin package, or from element folders of any project:

```bash
plitzi pack plugin                                    # in a plugin package: every element it holds
plitzi pack plugin src/plugins/SeatPicker             # an element of a self-hosted project
plitzi pack plugin src/plugins/SeatPicker src/plugins/Legend   # several in one plugin, the first its main
```

It writes one ES module (esbuild; React and the SDK kept out — the page provides them; images and fonts inside, since
a page imports the module from a blob URL), `plugin-manifest.json` written from the elements' declarations with each
file's integrity hash, and the zip the builder takes: upload it under Resources, as a plugin. A package also gets its
type declarations, written with its own TypeScript. Or serve the build at a versioned address with CORS open, and list
it in a space's plugins as `{ type, resource }`.

Without folders, outside a package, it offers the elements in `src/plugins` — the folders with a declaration, which is
what a manifest is written from. `--out` moves the build, `--no-zip` leaves the zip out, and `--plugin-version` sets the
version the manifest carries (the project's own by default).

## `login`, `space` and `upload plugin`

```bash
plitzi login          # sign in, in your browser
plitzi space          # choose the space to work in, in your browser
plitzi whoami         # who you are signed in as, and the space
plitzi upload plugin  # the zip pack plugin left, on that space
plitzi logout         # the session revoked on the platform, and forgotten here
```

Signing in happens in the browser, on the platform's own sign-in — the CLI never asks for a password, and MFA or a
social sign-in work without it knowing. What it keeps is the session and a way to renew it, in
`~/.config/plitzi/connection.json` (`%APPDATA%\plitzi` on Windows), readable by you alone. It is renewed on its own,
and it shows among your account's devices, where it can be ended like any other.

**One space at a time.** The space is chosen on the same grant screen an AI connector's is, and the CLI works in that
one until `plitzi space` chooses another — which replaces the connection, and revokes the one before. No command takes a
space of its own: an upload goes to the space `plitzi whoami` names, so a plugin meant for a staging space cannot end
up in the live one because of a flag.

`upload plugin` takes the zip named, or the one `pack plugin` left in the project (the newest, when there are several —
asked at a terminal). It is checked for its `plugin-manifest.json` before anything is sent. Without a connection, or
without a space, the browser opens for what is missing, so the first upload is one command too. It goes on one of the
space's CDNs — `--cdn <identifier>`, or asked when there are several — and is installed, as the builder does when a
zip is dropped under Resources: added, or the plugin already there moved to the new version with its settings kept.

`--api` (or `PLITZI_API_URL`) points it at another platform, a self-hosted or local one; the CLI trusts the
certificate authorities the system trusts, as the browser beside it does.

## Credentials

`create` never mints one. A cloud project's key comes from Credentials in the builder, is written to `.env`, and
`.gitignore` is written in the same breath. Server and browser take **different** keys and the scaffold names
them differently on purpose: a server gets the secret self-hosting key, a browser gets the public render key,
whose protection is the origin it is presenting from.
