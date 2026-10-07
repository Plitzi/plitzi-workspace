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
- **`--dry-run` says what it would do, and does none of it** — on every command that writes or sends: `create`,
  `add plugin`, `add runtime`, `pull`, `push`, `pack plugin`, `source`, `import`, `upload plugin`, `functions pull`/
  `push`, `runtime push`/`start`/`stop`/`size`/`vars`, `skills update`, `doctor --fix`. Each file it would write (`+` new, `~` replaced, `-`
  removed), what it would install or run, what it would send and where. It still reads what it needs to say so — the
  project, the files it would send, the space it would pull, signing in for that. `upgrade` and `fix` only show until
  `--write`.

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

- **The space, as yours.** A local project gets `src/space/` — a _copy_ of the space Plitzi gives a new account,
  declared as a tree, some CSS and a palette rather than exported as a document, a file per part: `index.ts` (the page
  and the space), `tokens.ts`, `theme.ts`, `content.ts`. It is the same declaration the platform authors a new space
  from, so what you start with and what signing up gives you cannot come apart — and unlike a document, you can read
  and change it.
- **A live loop.** In client mode a save is a hot module replacement: the space module is swapped and the tree
  remounted, so the page updates without reloading. In server mode `start:dev` authors a saved space again — in a
  process of its own, handing the documents to the server, which serves them from memory — and the open page loads
  again; it swaps a saved plugin where it is drawn, and restarts only for the server's own code.
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
| `public/` | Served to anyone who asks, as it is — pictures, a favicon, and in client mode the data the browser fetches (`public/data/`). **It is on the internet**: never a secret, a key, a private document or data only some visitors may read | yes |
| `src/data/` | Server mode: the project's own data — JSON its server reads for a provider (`query: '/data/<file>'`, `runtime: 'server'`) and never serves (`dataDir`). What a provider reads is in the page it renders: data a page must not carry is a server action's to read | yes |
| `src/functions/` | Server mode: the project's own server code — tasks and `/fn/` routes (`defineFunctions`), built at boot | yes |
| `vendor/plugins/` | The plugins the project runs as they were built, with no source (a project made from a space gets them), each folder with its `plugin-manifest.json`. The server runs them, and `author`, `check`, `fix` and `push` know every element type each provides | yes |
| `tmp/` | What the project writes for itself while it runs: the plugins the server builds (`tmp/.sdk-plugins`), resized pictures, the port it took (`tmp/dev-server.json`), screenshots and test output. Rebuilt when missing | no |
| `state/` | Server mode: what the server keeps for the space — its `kv` in `state/kv.json` (`createFileKv`): saved layouts, counters, cached answers. The deployment's state: kept across restarts, never rebuilt. `action.kv` in `src/config/serverOptions.ts` keeps it elsewhere (`createSqliteKv` for several processes, or a database) | no |
| `.plitzi/` | What the CLI records about the project: the space it came from (`space.json`), the functions' working copy, the files `create` wrote — what `pull`, `push` and `upgrade` stand on | yes |

**`plitzi/` is the CLI's; `src/` is yours — but `src/main.ts`.** `plitzi/` holds `author.ts`, the types plugins import
(`assets.d.ts`, server mode) or the page's base styles (`preflight.css`, client mode), and a `README.md` saying what
each folder of `src/` is. `src/main.ts`, the entry point, is the CLI's too, kept in `src/` where an entry point is
looked for; `upgrade` keeps all of them current, and the build compiles `src/` into `dist/main.js`. In server mode it is a few lines: it authors the space
(`authorProjectSpace` from `@plitzi/sdk-authoring/node`, which reads `src/space/` as `author` reads it) and hands
it, the actions and the options to `serveProject` from `@plitzi/sdk-server/project`, which wires the rest from where the
project keeps it — so a fix to the server arrives with `npm update`, not as a file to upgrade. Neither is told where the
project is: it is the folder every script runs in, and both refuse to start anywhere else, naming what is missing
(`package.json`, `src/`) — run them from the project's root. Nor do they start on a part where nothing reads it — a
plugin folder with no `index.ts`, code in `src/plugin/`, `.env` in `src/` — naming every one at once (`doctor` says each
with its fix). A plugin is declared by its folder: the server, `author` and `check` find every
`src/plugins/<Name>/declaration.ts` (`pluginDeclarations` from `@plitzi/sdk-authoring/node`). What the server does
besides serving the space is the project's own, in files it reads: `src/config/serverOptions.ts` (handed to `serveProject` —
`images`, `action.limits`, `action.kv`, `rsc`) and, with `--source local`, `src/actions/index.ts` (the space's server
actions, one `defineAction` each, a file each as they grow).
What `serveProject` wires itself — where the space comes from, the plugins, `public/`, `src/data/`, `src/functions/`,
the actions' lookups — is left out of `serverOptions`' type (`ProjectServerOptions`), and comes after it, so an option
there can never unwire it.
`src/functions/` holds the project's own server code; `start:dev` restarts on a change to any of them. A plugin is not
server code to restart for: a save to one is built again and swapped in the open pages where it is drawn — the rest of
the page, its state included, stays — its server half (`src/plugins/<Name>/functions/`) is loaded again in place, and a
new plugin folder is registered without a restart.

## `create --template blank` and `--template catalog`

A space written in the project starts as the welcome tour, with a plugin of the project's own. `--template blank`
starts it as tokens for both themes, a layout whose `site-main` the pages render in, and one empty page — with
a folder for its data and no example plugin — for a project that is about to be a specific site. `--template catalog`
starts it as a complete small shop to read and change: a layout with a menu, a product card component, the products
in `src/data/products.json` read on the server as a typed source (`public/data/products.json`, fetched by the browser,
in client mode), a catalog filtered by category, and a page per product — a file per part under `src/space/`. Both go
with `--source local`.

## `check` and `shot`

```bash
plitzi check / --width 1440,390            # is the page whole? in text, per width; --json for a tool
plitzi check /products --state --element catalog-count   # and what it holds: state, sources, one element
plitzi check / --ssr                       # and what the server's HTML lacks that the hydrated page has
PLITZI_CHECK_PASSWORD=… plitzi check /studio --as maya   # a page for signed-in visitors, signed in through /auth first
plitzi shot /about --width 390 --scheme dark
plitzi shot / --frames 4 --every 500       # what moves: a marquee, an autoplay
plitzi shot / --compare https://example.com --width 1440   # beside another site: what differs, and how
```

Both run on the project's own Playwright against its running server (`npm start`), and refuse a port that answers as
another project. They wait for the page to settle — loaded, then half a second with nothing asked for — counting no
stream that stays open, so a page with a realtime `channel` is checked like any other (`openPage` of
`@plitzi/sdk-authoring`, which the generated `npm run visual` uses too). `check` reports every element the space owes the page that is missing or hidden (with why), broken
images, sideways scroll, text in the colour behind it, console errors, refused requests and failed flows — and the
page's data: a binding that reads a path its provider's answer lacks (with the keys it has) — none inside an element
the page is not showing, which is not mounted — a provider that failed, and each list's rows, drawn and in its source
(`feed 4 of 8 rows`, `hits not rendered (16 in its source)`; `--json`: `lists: { id: { rendered, source } }`). A page's state in a few hundred tokens, where a screenshot costs thousands.

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

## `lint`

```bash
plitzi lint                    # the space's source, eslint's way: each practice to change at its file and line
plitzi lint --json             # one object: { scope, notChecked, counts, findings }
plitzi lint --max-warnings 0   # more warnings than that fail (exit 1); --strict: any warning does
```

How the space in `src/space/` is written — what only its source can say, and what grows hard to read and to change as
a space reaches thousands of lines. Each finding has a stable `code`, a severity, the file, line and column, what to
write instead, and `docs`: the reference of the project's skills that explains the practice. A project `create` writes
has it as `npm run lint:space`.

| Code | What it finds |
|---|---|
| `unused-file` | a file of `src/space/` nothing `src/space/index.ts` imports reaches |
| `file-too-long` | a file of more than 400 non-blank lines: split it by what changes together |
| `pages-in-one-file` | two pages or more (past 40 lines) written in `index.ts`, which only assembles the space; three or more (past 150 lines) in any other file — one file per page, or per page family, under `src/space/pages/` |
| `inline-records` | ten or more records written inline that a page renders (`.map`ped, or a list's `items`): rows of data for `src/data/` (`public/data/` without a server), read by a provider into one `list` |
| `repeated-css` | the same CSS — three declarations or more, in any order or spelling — written three times: one class |
| `special-case-in-map` | a `map` that singles out a row by its `id`, `key`, `slug`, `name`, `title` or `label`: the difference belongs in the row's data |
| `colour-not-token` | a hex, `rgb()`/`hsl()`/`oklch()`… or a named colour where a colour is all a property takes — outside the declared tokens (`variables`, `light`/`dark`), anchors, masks, markup and URLs |
| `positional-id` | an id minted for an element nobody named — `container-45`, `heading-a7k2` |
| `disable-names-suggestion` | a `plitzi-lint-disable` comment naming a suggestion of authoring's, which a comment does not silence: `quiet: ['<code>']` on its element |
| `space-does-not-author` | error: the space does not author, so authoring's suggestions could not be read — `npm run author` says why |
| `project-layout` | error: the project is laid out where its server and `npm run author` refuse to start — one line, each error `doctor`'s to say; authoring's suggestions are read once they are fixed |
| `source-unreadable` | error: the source could not be read (no TypeScript installed, a rule that could not finish) |

Beside them, every suggestion authoring makes about the space it authors to (`authorSpace(…).suggestions`) — whatever
its code, the day authoring adds it — as a warning at the line that wrote its element; `plitzi explain <code>` says what
each means. They are quieted on the element (`quiet: ['repeated-shape']`), where the builder and the MCP read it too —
the report says so under them. A practice the source departs from on purpose is said where it is, eslint's way, for
lint's own codes:
`// plitzi-lint-disable-next-line colour-not-token -- the partner's own red`, `-line` for its own line, and
`// plitzi-lint-disable <codes>` for the whole file.

It is not whether the space authors — what it refuses and warns of is `npm run author`'s — nor a page as it renders
(`check`), nor the project around the space (`doctor`); every report says so (`notChecked`). Exit code 1 while anything
is an error; with `--strict` a warning too, with `--max-warnings <n>` more than n of them.

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
plitzi explain navigate         # a step: its params, what it publishes, and the function that writes it
plitzi explain onScroll         # a trigger: what it hands its flow, and what fires it
plitzi explain class-and-css    # a problem's code: what was wrong, what to write instead
plitzi explain content-attribute # a suggestion's code: what is written the long way, and the short one
plitzi explain bindTemplate     # a helper: how it is written, what it is for, an example
plitzi explain motion           # the arrivals, triggers and loops the SDK plays
plitzi explain --list steps     # every one of a kind: elements, steps, triggers, codes, transformers, helpers
```

What a name means when authoring, from the catalogues the checks themselves read — the answer to a question that would
otherwise be a search through the SDK's types. `--json` answers in one object; over MCP it is `plitzi://explain/{name}`.

## `doctor`

```bash
plitzi doctor                  # every area, each problem with where it is and what fixes it
plitzi doctor --fix            # repairs what is simple and safe, then checks again
plitzi doctor --fix --dry-run  # what --fix would repair, nothing done
plitzi doctor --json           # one object: { ok, counts, areas, findings, repaired, recommendations }
plitzi doctor --strict         # warnings fail too — for a CI that keeps the project up to its CLI
```

Whether the project is whole as the CLI sets it up, read from what it is now rather than from what the CLI once wrote:
a developer may change any file, and the checks are what each part must be for the project to install, start, build and
push. It is the CLI's check of the project, not of the space: what the space authors to and warns of is `npm run
author`'s, how it is written `lint`'s, and how a page renders `check`'s. Exit code 1 while anything is an error (with `--strict`, a warning).

Each finding has an area, a stable `code`, the file and its `fix`; the report ends with **what to run next** — the few
commands (`plitzi upgrade --write`, an install, `doctor --fix`) that clear most of the list, by how many each fixes.

**`--fix`** makes only what is simple and safe, then examines the project again: a layout an older CLI left, moved (every
import, `new URL(…, import.meta.url)` and script naming a moved file follows, and what the CLI recorded of its files
follows them); a part out of place with one reading of where it goes, moved the same way — `src/plugin/` into
`src/plugins/`, an `index.js` to `index.ts`, `src/.env` to the root when it has none, a name that differs only in case
renamed through one of its own; `.env.example` written from `.env` with no value kept, `.env` copied from
`.env.example`; an older CLI's dead files and caches deleted; `.gitignore` lines added or taken out; `"type": "module"`
and `engines`; a folder `start:dev` watches; a `PLITZI_SIGNING_SECRET` where there is none (or one too short). A move
that would write over a file is said and left. What replaces a file of the project's, installs, or touches git is
recommended, never done — `upgrade --write` and the install are a step of their own.

**A project an older CLI made** is the usual patient, and its own installed CLI may predate `doctor`: run the latest one
from it — `npx @plitzi/cli@latest doctor --fix`, then what it recommends. While its layout is an older one (the space in
`src/space.ts`, `author` in `src/`, `functions/` at the root), nothing else is checked — read against it, every other
area would only say what the move fixes — and `upgrade` writes no file until it is moved.

**Where each part lives** is one check (`checkProjectLayout`, `@plitzi/sdk-shared/project/layout`) said by three: the
server refuses to start on its errors, listing every one (and prints its warnings while developing — a plugin folder
added broken while `start:dev` runs is said there, and the server goes on), `npm run author` and the CLI's checks
(`check`, `push`, `fix`) refuse to author, and `doctor` says each with its fix under `layout`. `lint` says in one line
that there are some. Its codes, each with what it means, are `PROJECT_LAYOUT_CODES`: errors — a plugin folder with no
`index.ts` (or `index.tsx`), or both; a JavaScript entry; a folder name that is no element type (`story-editor` →
`StoryEditor`), two folders of one type, a plugin also built in `vendor/plugins/`; a plugin's `functions/`,
`src/functions/` or `src/runtime/` with code and no `index.ts`; a local space with no `src/space/index.ts`, or one
exported by default; a built plugin whose manifest is missing, unreadable, or names no script there; `.env` inside
`src/`; code in a folder named like one the server reads (`src/plugin/`, `plugins/` at the root). Warnings — the same
folder with nothing it would read (`src/Data/`, `src/runtimes/`, `src/public/`); a plugin with no `declaration.ts`; a
file loose in `src/plugins/`; a file of `src/data/` that is not JSON; no `.env` or no `.env.example`; JSON in
`public/data/` of a project with a server, and a file in `public/` named like a secret. A near name is asked about —
did you mean `index.ts`, `src/plugins/`? — and one that differs only in case says it works on macOS and not on Linux.

| Area | What is held |
|---|---|
| `layout` | where an older CLI kept what this one reads elsewhere (`src/space.ts`, `src/site/`, `src/actions.ts`, `src/author.ts`, `functions/`) and what it left behind (`src/plugins/declarations.ts`, `.sdk-plugins/`, `.plitzi/dev-server.json`, the `tmp/space.json` an older `src/main.ts` re-read the space from); every part where the server, `npm run author` and the CLI's checks read it (`PROJECT_LAYOUT_CODES`, above) |
| `packages` | `"type": "module"`, the Node version; every package the project and its scripts need, declared and installed at a version its range allows; the SDK's packages at one version, no older than the CLI; one copy of the SDK and of React (none installed inside another); the scripts — gone, behind the CLI, or the project's own — the file each Node script starts, every folder `start:dev` watches, and a server's scripts reading `.env` (`--env-file-if-exists`; a watched one by the preload, never Node's flag); one lockfile |
| `machinery` | the CLI's files (`MACHINERY`), as `upgrade` sees them: gone, behind, or the project's own (said, never failed); one it no longer writes, left over (`src/env.ts`); the scaffold record |
| `config` | `tsconfig.json` reads `src/` and `plitzi/` and sets what Node's type stripping needs; `tsconfig.build.json` writes the file `start:prod` runs; `.gitignore` keeps `.env` out (and `node_modules`, `tmp`, `dist`, `state`) and `.plitzi/` in; `.env` not in git; the signing secret, as long as the project's own server wants it; a cloud project's key |
| `sources` | what Node runs as written — `src/main.ts`, `src/config/`, `src/actions/`, `src/space/`, `src/runtime/`, `plitzi/author.ts`, the plugins' declarations, and all they import: every relative import a file that is there, with its extension; JSON imported `with { type: 'json' }`; no JSX; every package declared (a devDependency, in what production runs, is said); what the server loads by name exported (`space`, `actions`, the runtime's default) |
| `plugins` | each folder of `src/plugins/` the server can build: its entry builds and exports its component, its packages declared; its `declaration.ts` loads and its `type` is the folder's (`StatCard` → `statCard`) |
| `data` | every JSON file of `src/data/` and `public/data/` parses — what the server answers with and `push` sends |
| `functions` | `src/functions/` built by the project's own `@plitzi/sdk-server` (`buildFunctions`), as every runner builds them |
| `records` | `.plitzi/space.json`, `scaffold.json` and `functions.json` readable, and of the same space |
| `skills` | `.claude/skills/plitzi-*` as the packages installed write them |

It loads the plugins' declarations and the project's own `@plitzi/sdk-server` to ask them — as the server does — and
never starts the server or the runtime. A check that cannot finish is said as an error
of its area, never a crash.

## `upgrade`

```bash
plitzi upgrade                       # what this CLI would change in the project — shown, nothing written
plitzi upgrade skills --write        # only the skills, each replaced whole from the packages installed
plitzi upgrade --write --take plitzi/author.ts
```

A project brought up to the CLI it has now, part by part: `files` (the machinery — `author.ts`, `main.ts`, the
Playwright and lint configs, `AGENTS.md`), `packages` (`package.json` merged, `@plitzi/*` raised to this version, then
the install), `skills` (`.claude/skills/plitzi-*`, whole, so a reference a skill no longer has goes with it) and
`renames` (a name a version renamed, at its file and line). A file nobody changed since the CLI wrote it is replaced;
one the project made its own is a diff, left unless `--take` names it (`all` for every one). The generated
`.prettierignore` names them, so the project's `format` never turns one into a file `upgrade` believes was changed. A file of the project's own
that the machinery reads (`src/config/serverOptions.ts`, `src/actions/index.ts`) is written when the project has none and the
`main.ts` reading it is the CLI's, and never replaced. A script is the same: one the CLI wrote and nobody changed takes
today's command, one the project changed is left and said. A file the CLI no longer writes — `src/env.ts`, now that
Node reads `.env` — is removed the same way once the `main.ts` that read it is the CLI's; one the project changed is
said and left, unless `--take` names it (`.plitzi/scaffold.json` records the files and the scripts, and the package
manager the files were written for — what a project not installed yet has no lockfile to say). In a project made from
a space, a file the space gave over one of the CLI's would be the space's, and `upgrade` would leave it to `plitzi pull` —
none does: `serveProject` runs whatever the space brought, from where it lands. `update` is the same
command, and `plitzi skills update` is `upgrade skills --write`. `npm run author` says when the authoring skill is
older than the `@plitzi/sdk-authoring` installed.

## `data describe`

```bash
plitzi data describe src/data/products.json          # its shape, and one row of its longest list
plitzi data describe src/data/products.json --json   # { shape, example }
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
plitzi push space functions                    # only these: space, functions, data, runtime, plugins, files
plitzi push space --force                      # replace the draft even though it was edited in the builder since
```

The way back of `pull`: the project put on the space it works with, as its **draft**. With nobody at the terminal it
sends what changed since the project last had the space. Each part goes up as its own command sends it, in the order
that names come before what names them:

1. `plugins` — every plugin whose source changed, packed and uploaded to the space's CDN (`--cdn`/`--bucket` when it
   has several public buckets);
2. `files` — each changed file of `public/assets/`, put at the same path under the space's `assets/` on its CDN
   (images, sounds, videos and JSON; any other type is named and stays here);
3. `functions` — `src/functions/`, as `functions push`;
4. `data` — `src/data/` whole, as the space's own data: kept privately, read by its server providers, frozen with each
   publish — refused when the space's copy changed since the project last had it, unless `--force`;
5. `runtime` — the runtime module, as `runtime push`;
6. `space` — `src/space/` authored, with the actions `src/actions/index.ts` serves and the connectors in `src/connectors/`.

The draft is never replaced unseen: when it was edited in the builder since the project's last pull or push, the push
is refused — pull first, or `--force`. A project that never had the space (one not made with `create --from`) may take a
space nobody has worked on yet; one that holds work asks for `--force` too. Always the space the CLI is connected to,
which must be the one the project came from, and never a published environment: publish in the builder. Afterwards
`.plitzi/space.json` records what was sent, so `pull` keeps working — on a project that started on its own too.

The space goes back with its files where Plitzi serves them: a path to a file of `public/assets/` (`/assets/a.png`) —
one `create --from` or `pull` wrote, or one the `files` part put on the CDN — is sent as that file's CDN address. Only
`public/assets/` goes to the CDN: the rest of `public/` is the project's own server's. What would not reach Plitzi is
said before anything is sent, with what to do: a provider reading a file `src/data/` does not hold, a file of
`public/assets/` the space names that is not on its CDN yet, and one of `public/` outside `assets/`.

## `add plugin`

Adds elements of your own to the project you are in — one, several at once (`add plugin seat-picker legend`), or one at
a time as the need comes. Each is a folder, written the way Plitzi's own elements are (`@plitzi/sdk-elements`): the
component, its `declaration.ts` (its `type`, the events it fires, the actions it answers to, and the element the builder
adds), its `Settings.tsx` panel for the builder, and the `index.ts` that puts them together — what the folder is built
from: `index.ts`, or `index.tsx` for one that writes its JSX there, never both. It asks what to call each, what the
builder shows, and what it is for, and checks every folder is free before writing any.

- **In a project `plitzi create` wrote**, it goes in `src/plugins`, where the project already looks: nothing to
  register, and a running `start:dev` picks it up without a restart. Host it with `custom({ renderType: 'seatPicker' })` in `src/space/`
  — or, when the space lives in Plitzi, with a Custom element in the builder.
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
plitzi pack source src/runtime/index.ts --kind runtime --name runtime -o runtime.source.json.gz
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
plitzi runtime push                                   # pack src/runtime/index.ts and keep it as the space's draft runtime
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
`src/runtime/index.ts` (or `--entry`), whose default export is `defineRuntime(…)`, and `@plitzi/sdk-server` installed:
`plitzi add runtime` writes it in a project from `plitzi create` in server mode, whose `src/main.ts` runs it too —
`/hello` answers on `npm start` — and whose `start:dev` restarts on it; `examples/self-hosting/10-runtime` is the smallest one to start
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
plitzi functions pull                                              # the space's functions into src/functions/
plitzi functions push                                              # src/functions/ saved as the space's draft, built and checked
plitzi functions try seismic.feed --params '{"minMagnitude":"4"}'  # one task of the saved draft, in the sandbox
plitzi functions dev seismic.feed --params '{}' --watch            # on this machine, as the platform runs it
```

A space's own server code — tasks its actions run as steps, routes under `/fn/` — and `src/functions/` is a working copy
of it: `.plitzi/functions.json` keeps what was pulled, so `pull` refuses to overwrite what is not pushed (`--force`
throws it away) and `push` refuses when the space moved on since. A problem comes back as
`src/functions/<file>:<line> <message>`. `dev` runs with the project's own `@plitzi/sdk-server` (`isolated-vm` and
`core-js` beside it); credentials come from `PLITZI_FUNCTIONS_CREDENTIALS`. See `docs/en/functions.md`.

## Credentials

`create` never mints a key to Plitzi. A cloud project's key comes from Credentials in the builder, is written to
`.env`, and `.gitignore` is written in the same breath. Server and browser take **different** keys and the scaffold
names them differently on purpose: a server gets the secret self-hosting key, a browser gets the public render key,
whose protection is the origin it is presenting from.

Every project has a `.env`, never committed, and a `.env.example`, committed: the same settings with no secret in them,
for a clone to copy and fill in. A server project's `.env` is read as each script starts —
`node --env-file-if-exists=.env` in `start`, `start:prod` and `author`, and in `start:dev`, which Node watches,
`node --import @plitzi/sdk-server/env` (Node's flag there has its watcher restart on every write in the project) —
before any of its modules is evaluated, so `src/config/serverOptions.ts` and the actions find their settings in
`process.env` as they load. A change to it is read on the next start, and a deployment that sets its environment needs
no file. A browser
project's is Vite's: only `VITE_*` reaches the page, and ships in it.
`create` gives each one a signing key there, made for it: `PLITZI_SIGNING_SECRET`, what `ctx.sign` and `ctx.verify`
sign with — at least 32 characters (`doctor --fix` writes one where it is missing). `PORT` is left commented out: 8080,
or the next free port while developing.
