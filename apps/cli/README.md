# @plitzi/cli

The command line for Plitzi.

```bash
npx @plitzi/cli create my-site                 # a project that renders a space
npx @plitzi/cli add plugin seat-picker legend  # elements of your own, in the project you are in
npx @plitzi/cli create seat-picker --plugin    # a plugin package any space can load
npx @plitzi/cli pack plugin                    # a plugin built, and zipped the way the builder takes it
npx @plitzi/cli upload plugin                  # that zip, on the space you work in, and installed there
```

## What every command does the same way

- **The answer goes to stdout; everything else to stderr** — errors, and the prompts on the way (sign in, open this
  address). So `--json`, where a command has it, prints one object on one line and nothing more.
- **It exits 1 when it did not do what it was asked**, with why in red; a check that found something wrong exits 1 too.
- **A value that is not one is refused**, saying what the flag takes — a width out of range, a scheme that is not
  `light` or `dark`, a count of 0 — never quietly turned into the default.
- **The same flag means the same thing everywhere:** `-o, --out` where it writes, `-f, --force` to write over what is
  there, `-e, --environment` for which version of the space, `--width` for the widths a page is looked at (one, or
  several separated by commas), `--api` for the platform, `--json` for a tool or an agent.

## `create`

Scaffolds a project that renders a Plitzi space, installs it, and leaves it ready to start. Three choices shape it —
the package manager, `--mode` and `--source` — and they are the person's to make, so `create` never makes them alone:

- **At a terminal**, anything not passed is asked for, with the likely answer offered as the default.
- **With nobody at the terminal** — an agent, CI — it stops before writing anything and prints each missing choice
  as a question for the person, addressed to the agent that ran it: ask the user, wait, run again with their answers.
  It offers no way around them: `--yes` only takes the defaults (`server`, `local`, the invoking package manager) for
  a person at a terminal. A script passes the three flags — which is also what makes it reproducible.

|                     | `--source local`                                                                    | `--source cloud`                                                   |
| ------------------- | ----------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| **`--mode server`** | A page server of your own, rendering a space that lives in the project. No account. | A page server of your own, rendering the live space out of Plitzi. |
| **`--mode client`** | Vite + the SDK in the browser. No server at all, no account.                        | The SDK fetches the space from Plitzi with the public render key.  |

```bash
plitzi create my-site                                                 # asks the three choices
plitzi create my-site --package-manager npm --mode server --source local
plitzi create my-site --package-manager pnpm --mode client --source local   # Vite, hot module replacement
plitzi create my-site --package-manager yarn --mode server --source cloud --key …   # the live space
plitzi create my-site --yes                                           # at a terminal: server + local + the invoking manager
plitzi create . --force --no-install --package-manager npm --mode server --source local   # into a directory that has work in it
```

### From a space on Plitzi

```bash
plitzi create my-board --from pizarra                                        # the draft, as code
plitzi create my-board --from pizarra --environment production --revision 3  # a snapshot, as it was frozen
plitzi create my-board --from pizarra --source cloud                         # the pages stay on Plitzi
```

A server project holding everything the space is made of — its pages as authoring code, its actions as `defineAction`
code (JSON, with the reason said, where one would not read back exactly), its functions, the source of its plugins and
runtime, and its files downloaded into `public/` with every CDN address rewritten — served by the project with nothing
of Plitzi's. `.env` gets a signing key made for it and the names of the variables and credentials the space had, never
their values. It signs in as you and needs a space you may change; the end of `create` says what came across
differently. What the project was given is recorded in `.plitzi/space.json` — commit it — for [`pull`](#pull) and
[`push`](#push). See `docs/en/projects-from-spaces.md`.

## The package manager

`--package-manager npm|yarn|pnpm` says which one the project is written for: what it installs with, and what
every command in its README and its Playwright config names. The one that invoked the CLI is only offered as the
default when it is asked for — `yarn dlx` and `pnpm dlx` get their own name suggested — because it is a guess about
the _invocation_: running `npx` once to scaffold a project you then work in with Yarn is exactly the case it gets
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

| Manager | File                             | Why                                                                                                                                                                               |
| ------- | -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| npm     | `allowScripts` in `package.json` | npm 11 lists unreviewed install scripts and will start blocking them: esbuild's is approved, fsevents' (a prebuilt binary beside a `binding.gyp`) refused                         |
| pnpm    | `pnpm-workspace.yaml`            | pnpm stops the install over a skipped build (`allowBuilds: esbuild`), and holds back packages under its minimum release age (`minimumReleaseAgeExclude: @plitzi/*`)               |
| Yarn    | `.yarnrc.yml`                    | Yarn quarantines packages younger than a day (YN0016): `npmPreapprovedPackages: @plitzi/*` — written only for Yarn ≥ 4.10, since an older Yarn refuses a setting it does not know |

The exemptions cover `@plitzi/*` only. A third-party dependency published in the last day is still held back, and
when an install fails the CLI says which setting names it.

## What lands in the project

- **The space, as yours.** A local project gets `src/space.ts` — a _copy_ of the space Plitzi gives a new
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
  _names_ is visible — the strongest assertion available about a page nobody hand-wrote, and it needs no upkeep.
- **Prettier and ESLint**, configured rather than mentioned: type-checked rules, with Prettier owning layout and
  `eslint-config-prettier` keeping the two from arguing on save. `lint` and `format` are scripts from the first
  commit, which is the only moment a repository's style is cheap to decide.
- **The authoring skill**, in `.claude/skills/`, so an agent working in the project knows how a space is put
  together before it touches one: a cheatsheet to start from, references by subject and recipes by intent — each a
  file that authors with no warning. `.claude` is left out of the project's lint and formatting.
- **`AGENTS.md`**: the commands, the port, where data goes, how to look at a page, and what not to read.
- **Quiet output.** `author` prints one line when the space is fine (every problem with its code when it is not), the
  server only what goes wrong (`npm start -- --verbose` for every request), `typecheck` one line per error. Under the
  warnings, `author` prints the space's **suggestions**
  (`[suggest] repeated-on-pages · … (saves 57) · src/pages/docs.ts:291`): a shorter way to the same page — a layout
  for a header on every page, a component for a card copied with other words, a link's own `content` — the ones that
  save the most first. Not problems: the space authors either way. `npm run author -- --json` carries them in
  `suggestions`.

## The folders that are not the source

| Folder | What it is | In git |
| --- | --- | --- |
| `public/` | Served to anyone who asks, as it is — data, pictures, a favicon. **It is on the internet**: never a secret, a key, a private document or data only some visitors may read | yes |
| `tmp/` | What the project writes for itself while it runs: the plugins the server builds (`tmp/.sdk-plugins`), resized pictures, the port it took (`tmp/dev-server.json`), the space as last authored, screenshots and test output. Rebuilt when missing | no |
| `data/` | Server mode: what the server keeps for the space — its `kv` in `data/kv.json` (`createFileKv`): saved layouts, counters, cached answers. The deployment's data: kept across restarts, never rebuilt. `action.kv` in `src/serverOptions.ts` keeps it elsewhere (`createSqliteKv` for several processes, or a database) | no |
| `.plitzi/` | What the CLI records about the project: the space it came from (`space.json`), the functions' working copy, the files `create` wrote — what `pull`, `push` and `upgrade` stand on | yes |

`src/main.ts` is the CLI's (`upgrade` keeps it current). What the server does besides serving the space is the
project's own, in files it reads: `src/serverOptions.ts` (handed to `createServer` — `images`, `action.limits`,
`action.kv`, `rsc`) and, with `--source local`, `src/actions.ts` (the space's server actions, one `defineAction` each).
What `main.ts` wires itself — where the space comes from, the plugins, `public/`, `functions/`, the actions' lookups —
is left out of `serverOptions`' type, and comes after it, so an option there can never unwire it.
`functions/` holds the project's own server code; `start:dev` restarts on a change to any of them. A plugin is not
server code to restart for: a save to one is built again and swapped in the open pages where it is drawn — the rest of
the page, its state included, stays — its server half (`src/plugins/<Name>/functions/`) is loaded again in place, and a
new plugin folder is registered without a restart.

## `create --template blank` and `--template catalog`

A space written in the project starts as the welcome tour, with a plugin of the project's own. `--template blank`
starts it as tokens for both themes, a layout whose `site-main` the pages render in, and one empty page — with
`public/data/` and no example plugin — for a project that is about to be a specific site. `--template catalog` starts
it as a complete small shop to read and change: a layout with a menu, a product card component, the products in
`public/data/products.json` read as a typed source, a catalog filtered by category, and a page per product — a file
per part under `src/site/`. Both go with `--source local`.

## `check` and `shot`

```bash
plitzi check / --width 1440,390            # is the page whole? in text, per width; --json for a tool
plitzi check /products --state --element catalog-count   # and what it holds: state, sources, one element
plitzi check / --ssr                       # and what the server's HTML lacks that the hydrated page has
plitzi shot /about --width 390 --scheme dark
plitzi shot / --frames 4 --every 500       # what moves: a marquee, an autoplay
plitzi shot / --compare https://example.com --width 1440   # beside another site: what differs, and how
```

Both run on the project's own Playwright against its running server (`npm start`), and refuse a port that answers as
another project. They wait for the page to settle — loaded, then half a second with nothing asked for — counting no
stream that stays open, so a page with a realtime `channel` is checked like any other (`openPage` of
`@plitzi/sdk-authoring`, which the generated `npm run visual` uses too). `check` reports every element the space owes the page that is missing or hidden (with why), broken
images, sideways scroll, text in the colour behind it, console errors, refused requests and failed flows — and the
page's data: a binding that reads a path its provider's answer lacks (with the keys it has), a provider that failed,
the rows each list rendered. A page's state in a few hundred tokens, where a screenshot costs thousands.

`--scheme` is the space's own theme, set as a visitor's toggle sets it (the `theme` cookie); left out, the space's
default, and `shot` names the file by the theme it was painted in. The dev tools' badge is hidden from both. A
full-page `shot` is the whole page — the pane the SDK scrolls in unrolled, every lazy picture loaded, every arrival
waiting for the scroll shown as it ends — in `tmp/shots/` unless `--out` says where.

`shot --compare` writes the two pictures side by side and the differences in red. It compares each section where it
is on the other page, so a page 400 px longer is said once, with the section the drift starts at; then it pairs the
texts both pages have and says what each does differently there — `h1 "Learn CSS" — font-size 68px → 60px · y +19px`.
`--frames` compares pictures taken one after another and names what moved. A project `create` writes has them as
`npm run check` and `npm run shot`.

## `fix`

```bash
plitzi fix            # what authoring would fix, as a diff of your own source
plitzi fix --write    # written, formatted as the project formats, and checked
```

The fixes are the ones with a single reading (`fixSpace`'s: a key the element never reads, `'true'` where a boolean
goes, a URL in page mode, a `state.` prefix on a state key…). Each is made in the call that wrote the element — found
by the line and column the element remembers — and only where the value is written as a literal; anything else is
listed with where it is and why it was left. `--write` authors the space again in a fresh process and keeps the edits
only if every fix is gone and no problem was added; a fix that would add one is put back and said.

## `import`

```bash
plitzi import https://example.com/pricing                 # into src/imported
plitzi import https://example.com/ --out src/home --width 1440,390
```

A page you own or may reuse, measured in the project's own Playwright as a place to start writing from — never a copy
of it. The widest width is desktop, the others tablet and mobile; the page is measured once more in the dark scheme.
What lands in `--out`:

- `tokens.ts` — the page's own custom properties by their names, then the colours it shows most, each with the value
  the same place shows in the dark (the light one again, said in `IMPORT.md`, when it has no dark scheme); the corners
  and shadows it repeats; its Google fonts. `variables`, `fonts` and `t` to hand to the space.
- `outline.ts` — `container()`s for its landmarks and blocks, each with its layout per breakpoint written as what the
  narrower widths change, colours as tokens, and a block hidden at a width as `display: 'none'` there. A repeated block
  is written once, and its rows go to `data/<name>.json`.
- `assets.json`, `screens/<width>.png`, and `IMPORT.md`: what was not carried over (the text, states, scripts, fonts
  not on Google) and what to do next.

It reads only a site that is yours: one served from this machine (a host that resolves to loopback), with nothing asked
of anybody; or, with `--account`, one a verified domain of one of your spaces covers — the `_plitzi` TXT record a custom
domain is verified by, under **Domains** in the dashboard, asked of your Plitzi account (`--api`), signing in when you
are not. Without `--account` it never reaches the platform: a site not served from this machine is refused, saying so.
Anything else is refused before a page is opened.

It refuses an `--out` that already has files unless `--force`, and then names the files an earlier import left that it
did not write again.

## `explain`

```bash
plitzi explain container        # an element: its attributes and their values, what it fires and answers, its slots
plitzi explain navigate         # a step: its params and the function that writes it
plitzi explain onScroll         # a trigger: what it hands its flow, and what fires it
plitzi explain class-and-css    # a problem's code: what was wrong, what to write instead
plitzi explain content-attribute # a suggestion's code: what is written the long way, and the short one
plitzi explain bindTemplate     # a helper: how it is written, what it is for, an example
plitzi explain motion           # the arrivals, triggers and loops the SDK plays
plitzi explain --list steps     # every one of a kind: elements, steps, triggers, codes, transformers, helpers
```

What a name means when authoring, from the catalogues the checks themselves read — the answer to a question that would
otherwise be a search through the SDK's types. `--json` answers in one object; over MCP it is `plitzi://explain/{name}`.

## `upgrade`

```bash
plitzi upgrade                       # what this CLI would change in the project — shown, nothing written
plitzi upgrade skills --write        # only the skills, each replaced whole from the packages installed
plitzi upgrade --write --take src/author.ts
```

A project brought up to the CLI it has now, part by part: `files` (the machinery — `author.ts`, `main.ts`, the
Playwright and lint configs, `AGENTS.md`), `packages` (`package.json` merged, `@plitzi/*` raised to this version, then
the install), `skills` (`.claude/skills/plitzi-*`, whole, so a reference a skill no longer has goes with it) and
`renames` (a name a version renamed, at its file and line). A file nobody changed since the CLI wrote it is replaced;
one the project made its own is a diff, left unless `--take` names it (`all` for every one). The generated
`.prettierignore` names them, so the project's `format` never turns one into a file `upgrade` believes was changed. A file of the project's own
that the machinery reads (`src/serverOptions.ts`, `src/actions.ts`) is written when the project has none and the
`main.ts` reading it is the CLI's, and never replaced. A script is the same: one the CLI wrote and nobody changed takes
today's command, one the project changed is left and said (`.plitzi/scaffold.json` records both, and the package
manager the files were written for — what a project not installed yet has no lockfile to say). In a project made from
a space, `src/main.ts` and `.prettierignore` are the space's: `upgrade` names them and leaves them to `plitzi pull`. `update` is the same
command, and `plitzi skills update` is `upgrade skills --write`. `npm run author` says when the authoring skill is
older than the `@plitzi/sdk-authoring` installed.

## `data describe`

```bash
plitzi data describe public/data/products.json          # its shape, and one row of its longest list
plitzi data describe public/data/products.json --json   # { shape, example }
```

The fields of a JSON file, their types and which rows have them — `price?: number  (in 812 of 879)` — so a page can
be bound to half a megabyte of data after reading twenty lines of it.

## `pull`

```bash
plitzi pull                                    # the space's changes in, yours kept
plitzi pull --force                            # where a file changed on both sides, the space's copy wins
plitzi pull --environment production --revision latest   # follow another version from now on
```

In a project `create --from` wrote: a file the space changed and you did not is written, one you changed and the space
did not is kept, one the space no longer has is removed unless you changed it. A file changed on both makes the pull
write **nothing** and name them. Both sides are compared as the project's Prettier writes them. `.env` is never touched;
`package.json` only gains the packages the space's code now asks for. It follows the version the project was made from —
the draft, an environment's latest, or a pinned revision.

## `push`

```bash
plitzi push                                    # at a terminal: tick what goes up — what changed is ticked already
plitzi push space functions                    # only these: space, functions, runtime, plugins
plitzi push space --force                      # replace the draft even though it was edited in the builder since
```

The way back of `pull`: the project put on the space it works with, as its **draft**. With nobody at the terminal it
sends what changed since the project last had the space. Each part goes up as its own command sends it, in the order
that names come before what names them:

1. `plugins` — every plugin whose source changed, packed and uploaded to the space's CDN (`--cdn`/`--bucket` when it
   has several public buckets);
2. `functions` — `functions/`, as `functions push`;
3. `runtime` — the runtime module, as `runtime push`;
4. `space` — `src/space.ts` authored, with the actions `src/actions.ts` serves and the connectors in `src/connectors/`.

The draft is never replaced unseen: when it was edited in the builder since the project's last pull or push, the push
is refused — pull first, or `--force`. A project that never had the space (one not made with `create --from`) may take a
space nobody has worked on yet; one that holds work asks for `--force` too. Always the space the CLI is connected to,
which must be the one the project came from, and never a published environment: publish in the builder. Afterwards
`.plitzi/space.json` records what was sent, so `pull` keeps working — on a project that started on its own too.

## `add plugin`

Adds elements of your own to the project you are in — one, several at once (`add plugin seat-picker legend`), or one at
a time as the need comes. Each is a folder, written the way Plitzi's own elements are (`@plitzi/sdk-elements`): the
component, its `declaration.ts` (its `type`, the events it fires, the actions it answers to, and the element the builder
adds), its `Settings.tsx` panel for the builder, and the `index.ts` that puts them together. It asks what to call each,
what the builder shows, and what it is for, and checks every folder is free before writing any.

- **In a project `plitzi create` wrote**, it goes in `src/plugins`, where the project already looks: nothing to
  register, and a running `start:dev` picks it up without a restart. Host it with `custom({ renderType: 'seatPicker' })` in `src/space.ts`
  — or, when the space lives in Plitzi, with a Custom element in the builder.
- **In a project written before plugins were found by folder**, it goes in `src/plugins` too, and prints the line to
  add to the `plugins` list in `src/main.ts`.
- **In a plugin package**, it goes in `src/`, and is added to `src/elements.ts` and `src/declarations.ts`, from which
  the package publishes it.
- **In any other project**, it asks which folder holds the project's components (`--dir` answers it) and prints how
  to register the element — for `render()`, for `<PlitziSdk>` in a React application, and for a page server.

A name that would make a built-in element's type (`button`, `form`) is refused: a space could not tell the two apart.

Told its shape, it writes that shape rather than the counter it writes otherwise — one element at a time:

```bash
plitzi add plugin ticker --prop interval:number=5000 --prop paused:boolean --trigger onTick:count --callback reset --headless
```

`--prop name:type=default` (string, number or boolean) is an attribute: in the props, the declaration's defaults and
`bindingsAllowed`, and a control in `Settings.tsx`; `--prop rows:list` and `--prop meta:json` are data a binding fills
(`unknown[]`, `Record<string, unknown>`, empty until it does). `--trigger onTick:count,at` is an event and what a flow
started by it reads, fired with the `useTickerEvents()` hook it gets — never on the builder's canvas. `--callback reset`
is an action a flow can call. `--headless` is an element with nothing to see: hidden on a page, a badge in the builder,
and `drawsNothing` in its declaration, so a page check does not look for it. The files are written as the project's
Prettier writes them.

`--server` gives the element a server half: `functions/index.ts` in its folder, written like a space's functions — its
routes answer under `/fn/plugins/<type>/` (`usePluginRoute(type)` in the component names them), its tasks are steps
`<type>.<action>`, and it runs with a plugin's own corner of `kv`, none of the space's credentials or channels. In a
server-mode project or a plugin package (which gets `@plitzi/sdk-server` for the types); a project that renders in the
browser alone has nothing to run it, and is refused. `pack plugin` carries it as `functions.source.json`, and the
platform builds and keeps it privately when the plugin is uploaded — see
[functions § a plugin's server half](../../docs/en/functions.md#10-a-plugins-server-half).

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

It writes one ES module (esbuild; React and the SDK kept out — the page provides them; images, fonts and any file
imported whole — `worker.js?raw` for its text, `engine.wasm?inline` for a data URI — inside, since a page imports the
module from a blob URL), `plugin-manifest.json` written from the elements' declarations with each file's integrity
hash, and the zip the builder takes — its stylesheet in the `plitzi-sdk-plugin` cascade layer, below the space's
styles, so a space's classes and `customCss` win over it: upload it under Resources, as a plugin. A package also gets its
type declarations, written with its own TypeScript. Or serve the build at a versioned address with CORS open, and list
it in a space's plugins as `{ type, resource }`.

Without folders, outside a package, it offers the elements in `src/plugins` — the folders with a declaration, which is
what a manifest is written from. `--out` moves the build, `--no-zip` leaves the zip out, and `--plugin-version` sets the
version the manifest carries (the project's own by default).

Beside the zip it writes the plugin's **source** (`<name>.source.json.gz`): every file of the project its elements import
— followed with the project's own TypeScript, `import type` included — and the packages they need. `upload plugin`
keeps it on the space, which is what `create --from` brings back. `--source-root` names the project those paths are
relative to, when the elements are not a project of their own. A file outside it, a credentials file or a credential
in the code keeps it from being written — said, and never stopping the build.

## `pack source`

```bash
plitzi pack source src/runtime.ts --kind runtime --name runtime -o runtime.source.json.gz
```

What `upload plugin` and `runtime push` keep, written to a file to look at: the closure of the entries named, gzipped.


## `login`, `space` and `upload plugin`

```bash
plitzi login          # sign in, in your browser
plitzi space          # choose the space to work in, in your browser
plitzi whoami         # who you are signed in as, and the space; --json for a tool
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
space's public buckets — `--bucket <identifier>` (narrowed to one CDN with `--cdn <identifier>`), or asked when there
are several; a private bucket is refused, since no page could load from it — and is installed, as the builder does when
a zip is dropped under Resources: added, or the plugin already there moved to the new version with its settings kept. The
source `pack plugin` wrote beside the zip goes up after it, into the space's private bucket.

`--api` (or `PLITZI_API_URL`) points it at another platform, a self-hosted or local one; the CLI trusts the
certificate authorities the system trusts, as the browser beside it does.

## `runtime`

```bash
plitzi runtime push                                   # pack src/runtime.ts and keep it as the space's draft runtime
plitzi runtime status                                 # how each environment's runtime is, and its variables' names; --json
printf %s "$URL" | plitzi runtime vars set REDIS_URL   # a value from stdin stays out of the shell history
plitzi runtime vars unset REDIS_URL
plitzi runtime size medium                            # the size the draft runs at (--environment for a published one)
plitzi runtime stop                                   # stopped, and kept stopped until started
plitzi runtime start                                  # started again — stopped by hand, or for going unused
```

A space's runtime is its own server code, run beside it on the platform — for what its functions cannot be: a
connection kept open, memory that outlives a request, Node and its packages (`docs/en/runtimes.md`).

**Its code lives in a project of yours** — a folder, usually a repository — and nowhere else: the builder shows how a
runtime runs and sets its variables, but it does not hold its code and cannot change it. The project has
`src/runtime.ts` (or `--entry`), whose default export is `defineRuntime(…)`, and `@plitzi/sdk-server` installed: a
project from `plitzi create` in server mode has it; `examples/self-hosting/10-runtime` is the smallest one to start
from, and it runs as a server of its own too.

`push` packs the module with the project's own `@plitzi/sdk-server` — the module and every package it imports, bar
`@plitzi/*` and React, which the platform provides — and sends it to the space `plitzi whoami` names. It becomes the
draft's runtime, which starts on it; **publishing the space** from the builder takes it to the published site. A
runtime is part of the plans that carry it; on another, the push is refused and says so. The source it was
packed from is kept beside it, and a publish freezes it with the code.

**It runs at a size** — small (0.25 CPU, 256 MB), medium (0.5 CPU, 512 MB) or large (1 CPU, 1 GB) — chosen per
environment among the sizes the space's plan includes. `status` says what each environment runs at and which sizes the
plan includes; `size` chooses another, and that runtime starts again at it.

**An unused runtime stops by itself** — nothing sent to its endpoints and no task run on it for a week, on the platform — so it spends
nothing idle, and stays stopped until `start`, the builder, a push or a publish starts it again. `status` says when a
running one would stop, and why a stopped one is.

## `functions`

```bash
plitzi functions pull                                              # the space's functions into functions/
plitzi functions push                                              # functions/ saved as the space's draft, built and checked
plitzi functions try seismic.feed --params '{"minMagnitude":"4"}'  # one task of the saved draft, in the sandbox
plitzi functions dev seismic.feed --params '{}' --watch            # on this machine, as the platform runs it
```

A space's own server code — tasks its actions run as steps, routes under `/fn/` — and `functions/` is a working copy
of it: `.plitzi/functions.json` keeps what was pulled, so `pull` refuses to overwrite what is not pushed (`--force`
throws it away) and `push` refuses when the space moved on since. A problem comes back as
`functions/<file>:<line> <message>`. `dev` runs with the project's own `@plitzi/sdk-server` (`isolated-vm` and
`core-js` beside it); credentials come from `PLITZI_FUNCTIONS_CREDENTIALS`. See `docs/en/functions.md`.

## Credentials

`create` never mints one. A cloud project's key comes from Credentials in the builder, is written to `.env`, and
`.gitignore` is written in the same breath. Server and browser take **different** keys and the scaffold names
them differently on purpose: a server gets the secret self-hosting key, a browser gets the public render key,
whose protection is the origin it is presenting from.
