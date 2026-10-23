# @plitzi/cli

The command line for Plitzi. To learn Plitzi from the start, or look something up, the docs are at
[docs.plitzi.com](https://docs.plitzi.com): the guides, the reference and the Academy.

```bash
npx @plitzi/cli create my-site                 # a project that renders a space
npx @plitzi/cli plugin add seat-picker legend  # elements of your own, in the project you are in
npx @plitzi/cli create seat-picker --plugin    # a plugin package any space can load
npx @plitzi/cli plugin pack                    # a plugin built, and zipped the way the builder takes it
npx @plitzi/cli plugin upload                  # that zip, on the space you work in, and installed there
```

## Alone, or a team of agents

Everything here is for one agent — or you — working a project: ask your agent for what you want, and it uses these
commands itself. A **team of agents** — multi-agent mode: several agents, or subagents, working in parallel — is for a
job big enough to split, and only when someone asks for one: the `run` and `task` commands are the team's alone, grouped apart in `plitzi --help`.

```bash
npx @plitzi/cli create my-site                 # first: a project — then ask your agent for what you want
plitzi run start "Translate the site into Catalan"   # a team: the project checked, the run opened on its scope
plitzi run agent dev-1 --launch --harness claude     # each agent started — or its prompt alone, for a subagent
plitzi run monitor                             # follow it, in a terminal of yours
plitzi run finish --apply                      # yours: the team's work into the project, once you read its report
```

## What every command does the same way

- **The answer goes to stdout; everything else to stderr** — errors, and the prompts on the way (sign in, open this
  address). So `--json`, where a command has it, prints one object on one line and nothing more — or, for one that
  stays (`space watch`, `space activity --follow`), one object a line as each happens.
- **It exits 1 when it did not do what it was asked**, with why in red; a check that found something wrong exits 1 too.
  A page command (`page check`, `page measure`, `page same`) that could not read what it was asked — nothing served, a
  browser that did not start, the element of the page it compares to not there — exits 2: no page was found wrong, and
  a run takes such an acceptance line as the lead's to amend, not the agent's work.
- **A value that is not one is refused**, saying what the flag takes — a width out of range, a scheme that is not
  `light` or `dark`, a count of 0 — never quietly turned into the default.
- **The same flag means the same thing everywhere:** `-o, --out` where it writes, `-f, --force` to write over what is
  there, `-e, --environment` for which version of the space, `--width` for the widths a page is looked at (one, or
  several separated by commas), `--api` for the platform, `--json` for a tool or an agent.
- **`--dry-run` says what it would do, and does none of it** — on every command that writes or sends: `create`,
  `plugin add`, `runtime add`, `space pull`, `space push`, `plugin pack`, `source pack`, `page import`, `plugin upload`, `functions pull`/
  `functions push`/`functions add`, `runtime push`/`start`/`stop`/`size`/`vars`, `skills update`, `doctor --fix`. Each file it would write (`+` new, `~` replaced, `-`
  removed), what it would install or run, what it would send and where. It still reads what it needs to say so — the
  project, the files it would send, the space it would pull, signing in for that. `upgrade` and `space fix` only show until
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
plitzi create my-board --from team-board                                     # the draft, as code
plitzi create my-board --from team-board --environment production --revision 3  # a snapshot, as it was frozen
plitzi create my-board --from team-board --source cloud                      # the pages stay on Plitzi
```

A server project holding everything the space is made of — its pages as authoring code, its actions as `defineAction`
code (JSON, with the reason said, where one would not read back exactly), its functions, the source of its plugins and
runtime, and its files downloaded into `public/` with every CDN address rewritten — served by the project with nothing
of Plitzi's. `.env` gets a signing key made for it and the names of the variables and credentials the space had, never
their values. It signs in as you and needs a space you may change; the end of `create` says what came across
differently. What the project was given is recorded in `.plitzi/space.json` — commit it — for [`space pull`](#space-pull) and
[`space push`](#space-push). See `docs/en/projects-from-spaces.md`.

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

Every script that runs TypeScript — `start`, `author`, `page shot` — is plain `node`: Node 24 strips the types
itself, so nothing transpiles beside the server. (`tsx` did, and its loader thread cost a page server more memory
than the server: ~270 MB to start where the same server starts in ~90.) The project's `tsconfig` holds it to what
that needs — relative imports name their `.ts` file (`allowImportingTsExtensions`), type-only imports say so
(`verbatimModuleSyntax`), nothing is written that stripping would leave broken (`erasableSyntaxOnly`) — so a
mistake is a `typecheck` error, not a crash at `npm start`. `engines` says `^24.22.1 || >=26.12.1`: Node 24 at
least — the LTS the platform runs — each line from its last security release (October 2026), raised with each one;
`plitzi doctor` refuses a Node before 24 (`node-too-old`) and warns of one behind its line's security release
(`node-unpatched`), saying the patch to install.

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
  `src/plugins` is registered by itself, under its name in camelCase, so `plitzi plugin add` is all a new one takes. Its props ARE the
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
- **`AGENTS.md`**: the commands, the port, where data goes, how to look at a page, and what not to read. The CLI's,
  like `CLAUDE.md`, which imports it: `upgrade` replaces both. What the project's own sessions have to know goes in
  **`NOTES.md`**, which both point at and nothing the CLI does touches.
- **Quiet output.** `author` prints one line when the space is fine (every problem with its code when it is not), the
  server only what goes wrong (`npm start -- --verbose` for every request), `typecheck` one line per error. Under the
  warnings, `author` prints the space's **suggestions**
  (`[suggest] repeated-on-pages · … (saves 57) · src/pages/docs.ts:291`): a shorter way to the same page — a layout
  for a header on every page, a component for a card copied with other words, a link's own `content` — the ones that
  save the most first. Not problems: the space authors either way. `npm run author -- --json` carries them in
  `suggestions`.

## The folders that are not the source

| Folder            | What it is                                                                                                                                                                                                                                                                                                                                                                                                                             | In git |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| `public/`         | Served to anyone who asks, as it is — pictures, a favicon, and in client mode the data the browser fetches (`public/data/`). **It is on the internet**: never a secret, a key, a private document or data only some visitors may read                                                                                                                                                                                                  | yes    |
| `src/data/`       | Server mode: the project's own data — JSON its server reads for a provider (`query: '/data/<file>'`, `runtime: 'server'`) and never serves (`dataDir`). What a provider reads is in the page it renders: data a page must not carry is a server action's to read                                                                                                                                                                       | yes    |
| `src/functions/`  | Server mode: the project's own server code — tasks and `/fn/` routes (`defineFunctions`), built at boot                                                                                                                                                                                                                                                                                                                                | yes    |
| `vendor/plugins/` | The plugins the project runs as they were built, with no source (a project made from a space gets them), each folder with its `plugin-manifest.json`. The server runs them, and `author`, `page check`, `space fix` and `space push` know every element type each provides                                                                                                                                                             | yes    |
| `tmp/`            | What the project writes for itself while it runs: the plugins the server builds (`tmp/.sdk-plugins`), resized pictures, the port it took (`tmp/dev-server.json`), screenshots and test output. Rebuilt when missing — but `tmp/plitzi-runs/`, the run of agents going (`plitzi run`): its backups and approved work, never rebuilt; removing it loses them, never the project. A run's report is left in `tmp/plitzi-reports/`         | no     |
| `state/`          | Server mode: what the server keeps for the space — its `kv` in `state/kv.json` (`createFileKv`): saved layouts, counters, cached answers. The deployment's state: kept across restarts, never rebuilt. `action.kv` in `src/config/serverOptions.ts` keeps it elsewhere (`createSqliteKv` for several processes, or a database)                                                                                                         | no     |
| `.plitzi/`        | The CLI's part of the project, in one folder: what authors the space and the compiler options (below), and what it records — the space it came from (`space.json`), the functions' working copy, the files `create` wrote (`scaffold.json`), the team of its runs (`team.json`) — what `space pull`, `space push` and `upgrade` stand on. A project an older CLI laid out has a `plitzi/` beside it: `plitzi doctor --fix` moves it in | yes    |

**`.plitzi/` is the CLI's; `src/` is yours — but `src/main.ts`.** `.plitzi/` holds `author.ts`, the types plugins import
(`assets.d.ts`, server mode) or the page's base styles (`preflight.css`, client mode), the compiler options
(`tsconfig.base.json`, which the project's own `tsconfig.json` extends — a folder of yours, `scripts/` or `tools/`, goes
in its `include`), and a `README.md` saying what each folder of `src/` is. `src/main.ts`, the entry point, is the CLI's too, kept in `src/` where an entry point is
looked for; `upgrade` keeps all of them current, and the build compiles `src/` into `dist/main.js`. In server mode it is a few lines: it authors the space
(`authorProjectSpace` from `@plitzi/sdk-authoring/node`, which reads `src/space/` as `author` reads it) and hands
it, the actions and the options to `serveProject` from `@plitzi/sdk-server/project`, which wires the rest from where the
project keeps it — so a fix to the server arrives with `npm update`, not as a file to upgrade. Neither is told where the
project is: it is the folder every script runs in, and both refuse to start anywhere else, naming what is missing
(`package.json`, `src/`) — run them from the project's root. Nor do they start on a part where nothing reads it — a
plugin folder with no `index.ts`, code in `src/plugin/`, `.env` in `src/` — naming every one at once (`doctor` says each
with its fix). A plugin is declared by its folder: the server, `author` and `page check` find every
`src/plugins/<Name>/declaration.ts` (`pluginDeclarations` from `@plitzi/sdk-authoring/node`). What the server does
besides serving the space is the project's own, in files it reads: `src/config/serverOptions.ts` (handed to `serveProject` —
`images`, `action.limits`, `action.kv`, `rsc`) and, with `--source local`, `src/actions/index.ts` (the space's server
actions, one `defineAction` each — `taskAction(task, { trigger })` for one that only runs a task — a file each as they
grow).
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

## `page check` and `page shot`

```bash
plitzi page check / --width 1440,390            # is the page whole? in text, per width; --json for a tool
plitzi page check /about /writers               # several pages, in one browser
plitzi page check /products --state --element catalog-count --element catalog-grid   # and what it holds: state, sources, elements
plitzi page check / --ssr                       # and what the server's HTML lacks that the hydrated page has
plitzi page check /enterprise --click site-footer-top   # click one element: what it changed, or that nothing did
plitzi page check / --click news-send --fill news-email=ana@example.com   # a form sent as a visitor fills it
plitzi page check / --hover home-cta             # the pointer over one element: how it and its elements look, what appears
plitzi page check /expenses --fill expenses-search=kibble --element expenses-lede   # what typing changed, and what it shows
plitzi page check /studio --as maya             # a page for signed-in visitors, signed in through /auth first
plitzi page check / --url https://staging.example.com   # the project served elsewhere: a second server, staging, a deploy
plitzi page check "/?__pt=weather" --url https://localhost:8091 --space tmp/pages/weather.ts   # a page not the project's
plitzi page shot /about --width 390 --scheme dark
plitzi page shot / --width 1440,390                # a picture at each width, each named by it
plitzi page shot / --frames 4 --every 500       # what moves: a marquee, an autoplay
plitzi page shot / --viewport --click .knob open-button --frames 4 --every 250 --sheet   # an interaction, on one sheet
plitzi page shot / --compare https://example.com --width 1440   # beside another site: what differs, and how
plitzi page outline /pricing --compare https://example.com --within .plans --width 390   # what to measure there
plitzi page shot /pricing --compare https://example.com --click "menu-toggle => .menu-button" --width 390   # both screens once clicked
plitzi page shot /studio --width 390 --as maya   # a page for signed-in visitors: the picture is of it, not of the sign-in
plitzi page shot / --viewport --frames 6 --every 200 --from load --sheet   # what plays as the page arrives
plitzi page shot / --clip machine --sheet --steps "click .gm__knob; wait 300; frames 6 150; wait-for .gm__capsule; shot opened"   # an interaction, step by step
plitzi page shot /expenses --fill expenses-search=kibble   # a picture before and after typing in a field
plitzi page shot / --steps "hover home-cta; wait 400; shot hovered"   # a hover, pictured
plitzi page shot /settings --steps 'type [aria-label="Search the site"] lamps; drag volume-handle -80; shot'   # a field, a range's handle
```

Both run on the project's own Playwright against its running server (`npm start`), and refuse a port that answers as
another project — or as this one served from another folder (a run's copies share a name; `/health` says which copy
answers by a mark of its folder, `Instance`). `--url` points them at the project served anywhere else — a second server of it, staging, a deploy —
and `page check --space <module>` holds the pages to that space instead of the project's: what that other server
serves, a page an agent wrote (authored in a process of its own, `authorIsolated` of `@plitzi/sdk-authoring/node`). They wait for the page to settle — loaded, then half a second with nothing asked for — counting no
stream that stays open, so a page with a realtime `channel` is checked like any other (`openPage` of
`@plitzi/sdk-authoring`, which the generated `npm run visual` uses too). `page check` reports every element the space owes the page that is missing or hidden (with why) — and, under a plugin
that chooses its children (`choosesChildren`), each it draws and what is named inside it — broken
images, sideways scroll, a link or words cut off at the screen's edge (an ancestor hiding them, nothing scrolling to
them), words that cannot be told from what is behind them (under 2:1 — the space's elements and what a plugin draws
inside one; `aria-hidden` words are a decoration), headings that do not start at an `h1` or skip a level and a link,
button or field with no name a screen reader can read (as the page is drawn, layouts included), an address no page
of the space answers (its not-found page came: `no-page`), console errors, refused requests and failed flows — a page whose
requests the server failed (`5xx`) is looked at once more, and the report is that second look, naming what failed the
first time (`--json`: `retriedAfter`); a `4xx` is not retried — and the
page's data: a binding that reads a path its provider's answer lacks (with the keys it has) — none inside an element
the page is not showing, which is not mounted — a provider that failed, and each list's rows, drawn and in its source
(`feed 4 of 8 rows`, `hits not rendered (16 in its source)`; `--json`: `lists: { id: { rendered, source } }`). A page's state in a few hundred tokens, where a screenshot costs thousands.
`--element` (once for each element) adds, at rest, each property more than one of the element's classes sets: the value shown, the class it
comes from and what the others say — `border-radius: 999px, from ent-cta-pill (button-primary says 12px)` — or that
they all set it alike, so it stays without any one of them. That is said of the property alone: a class that shares
one may set others. A class is said to change nothing on the element only when every property it sets stays without
it, at rest at that width — and then with the other elements it is on: taking it off this element's `class` touches
none of them, changing the class itself changes them all (`--json`: `styles: { contested, inert, wornBy }`). Which
class wins is asked of the page (each taken off for a moment), so specificity, order and media are answered without a
picture.

`--click <id>` clicks one element once the page has settled, as a visitor does — brought into view first, which is
not the click's doing — and says what changed: the flows it ran and how each step ended, where the page went, what
scrolled, what is shown now and what no longer is, what the page said (a toast, an alert: `said: "Link copied"`), the
state. A form the browser held back is said with the field and the browser's reason (`the browser held the form back:
email — Please fill out this field.`), not as a click that ran nothing. A click that changed nothing says so in those
words, and a flow that ran and succeeded with nothing on the page changed is said as that too: a button whose flow
does nothing looks like one that works until it is clicked. A click that could not be made, or a flow that failed,
fails the check (`--json`: `clicked: { element, filled?, changes, failed, problem? }`).

`--hover <id>` puts the pointer over one element instead, and says the same of it, with what a hover changes most: how
the element, each element inside it and up to three marked elements around it look — colours, shadow, transform,
opacity, size, `background-size`, `stroke-width`, one line a property, said where it changed and not again by a child
that inherits it (`home-cta background-color: rgb(…) → rgb(…)`), what their `::before`/`::after` draw and the custom
properties they hold (`vs before:opacity: 0.6 → 1`, `vs --fill: 0.6 → 1`); a rule written on a parent (`.card:hover
.photo`) shows. A hover that changed nothing says so; under 1024 px it is skipped and said so — a phone has no pointer. One
interaction a check: `--click` or `--hover` (`--json`: `clicked: { hovered: true, skipped?, … }`).

`--fill <id>=<value>`, once per field, fills a field before the click as a visitor does — typed in, an option chosen, a
box ticked with `true` or `false` — so a form's flow is run with what it is for, not only refused empty. The id is the
field's element, or one that holds that one field (a `formControl`'s wrapper); one that holds several is refused with
their ids, and a field filled inside another element says whose it is. Without `--click` the filling is the
interaction — a search box, a filter that answers to typing — and what it changed is said; with one, what the filling
changed by itself is said apart from the click. `--element` and `--state` read the page as the interaction left it, and
the element's report says the text it shows.

`--scheme` is the space's own theme, set as a visitor's toggle sets it (the `theme` cookie); left out, the space's
default, and `page shot` names the file by the theme it was painted in. The dev tools' badge is hidden from both. A
full-page `page shot` is the whole page — the pane the SDK scrolls in unrolled, every lazy picture loaded, every arrival
waiting for the scroll shown as it ends — in `tmp/shots/` unless `--out` says where. Any one picture (a part with
`--clip`, the screen with `--scroll-to` or `--viewport`) shows its arrivals as they end too; `--frames`, `--click` and
`--steps` take the page as it plays, and each picture after the first is written beside it (`<name>-1.png`, …).

Both load a page as one that watches its realtime channels: it hears them — a topic the server refuses is still
reported — and says nothing on them, so nobody on the page sees it arrive, join their members or send. `--presence`
makes it take part as a visitor does. `--click` in `page shot` takes an element's name, a tag no element is named by
(`textarea`) or any selector, CSS or Playwright's own (`button:has-text("Orbit")`). In `--steps`, an element is read up to a
space outside its quotes and brackets (`[aria-label="Search the site"]` is one), or quoted whole — `type ".panel textarea" hola`;
`type` replaces what the field held, and fails when the click leaves no field focused. `hover <element>` puts the
pointer over it and leaves it there, for the next `shot`; `drag <element> <dx> [dy]` presses it — a range at its thumb —
moves it that many pixels and lets go. A step acts on the element shown: a page drawing one per width hides the other.
With `--compare`, `--click "ours => theirs"` clicks each page in turn and sets their screens side by side once clicked —
an open drawer, a panel in it — with no sections or words read.

`page shot --compare` writes the two pictures side by side and the differences in red. It compares each section where it
is on the other page, so a page 400 px longer is said once, with the section the drift starts at; then it pairs the
texts both pages have and says what each does differently there — `h1 "Learn CSS" — font-size 68px → 60px · y +19px`.
With `--clip <section>` the report keeps that one section's difference (both pages are still compared whole), and the
picture `-o` writes is that section — the section by its id (`pricing`), its element's (`home-pricing`) or as the
report names it (`section#home-pricing`); a section that lined up with a part of the other page that is not it (90% or
more differs, or farther than a screen) is said, never read as its figure. Beside a page of this machine — the run
before a task — both sides are held to what the project changed: motion reduced, and another site's pictures stood in
for by a colour their address gives them.
`--timezone <IANA>` (both) opens the page as a visitor in that zone: its clock and `Intl` read there.

`page same … --except <elements>` leaves those out — a task's own parts — and reads positions from each element's parent,
so a part that grew does not move what follows it: what is read is that nothing else moved.

`page check --stand-ins` answers every picture of another site with a colour of its own: a check of what the project
changed, not of a third party's CDN (a look's check uses it).

What every page the CLI opens asks other sites for — pictures, fonts, styles, media, never a page or an API's answer —
is kept on disk for 6 h (`tmp/plitzi-cache/http`, the project's, from a task's copy too), and the space a check is held
to is kept by the files it is authored from (`tmp/plitzi-cache/authored`): each command opens a browser of its own with
no cache, and a home page that asks a CDN, a video host and a font service for dozens of files would ask on every load. A check reads two
pages at a time, each at its widths at once, and waits 250 ms of quiet on the project's own pages (500 on another
site's) — four pages at two widths went from 8.4 s to 3.1 s. A project's `typecheck`, `lint` and `format`
keep what they read in `tmp/plitzi-cache/checks` (`--incremental`, `--cache`) and read again only what changed: a
check run again in the same copy (lint 3.7 s → 0.5 s). A project whose scripts an older CLI wrote is told so by
`plitzi doctor` (`script-outdated`), and `plitzi upgrade packages --write` brings them up to these.

`page check --themes` reads each page in light and in dark too, and fails a ground the same in both under a text whose
colour follows the theme and, in one of them, reads under 3:1 on it (`fixed-ground`): a fixed colour where a theme
token belongs. A look at a task checks with it. Every check fails a link or a button drawn on its section's bottom
edge where the section keeps no space below it (`flush-edge`): a "See all" link sitting against the next section, its
section's class without a bottom padding, which nothing else says.

`page outline <path> [--compare <url>] [--within <part>] [--depth <n>] [--click <el…>] [--width <px>]` lists what a
page is made of as a visitor sees it — each shown element by a selector that finds it alone (its name on the project's
page; its id, its tag and classes, or its place under an ancestor on another site), its box and its first words,
indented by depth — the project's page, or with `--compare` the other site's: what to name after `=>` in `page measure`,
an open drawer's too (`--click`), with no HTML fetched and searched.

`page same [paths…] --url <origin> --than <origin>` says whether pages draw the same on two servers of the project —
every element on screen, its box, the style a reader sees and what its `::before`/`::after` draw, read, not pictured —
and, where not, the first element that differs; exit 1 then. A look at a task reads with it the pages only a shared
file of the task reaches, against the run before it, and pictures only those that differ; a local address reads alike
whatever port each server was on. Beside the project's other server, `page shot --compare <local> --clip a,b,c`
compares several parts on pages loaded once a side — a look compares a task's parts so, one call a page and a view (six
sections of a home: 15.3 s a part at a time, 4 s together).

`page measure <path> <element…> [--compare <url>]` reads elements' computed styles — type (family, size, weight, line
height, tracking, case), colours, background, each border, radius, shadows, opacity, padding, margin, gap, size,
transform, transition, and what `::before`/`::after` draw — and, beside another page, the other's elements (each
`"ours => theirs"`, by any selector, `#an-element-id` too; the same name when left out; `--there` for one): each property
that differs, here → there, what both inherit from their parent said apart, then the ones they share in a line. Every
element at every width (`--width 390,1440`) is one call in one browser; the other page is read without a picture and
kept 6 h (`--fresh` reads it again). `--same font-size,border,before:opacity` (shorthands `border`, `font`, `size`;
a side alone, `margin-bottom`, `padding-top`) fails unless those are as the other page's — lengths to the pixel, half a
pixel either way the same: an acceptance's line that holds a copy to its reference. `x` is where the box starts in the
viewport — a column against the other's at 1920. `--hover` or
`--focus "<ours> => <theirs>"` puts both pages in that state first, its transitions finished: what a hover changes,
held by `--same` as the rest is; `--click "<ours> => <theirs>" …` clicks each in turn on both — a drawer, then a panel
in it — and measures the open state they leave. A line height and a tracking are said as their `em` of the font beside the pixels
(`22.13px (1.5em)`: the rule to write, not the size's result); a difference both inherit from their parent is left out
of `--same`, said beside it; the transform compared is the one that applies (`rotate`, `scale`, `translate` and
`transform`, as CSS composes them); a component's instance is found by its name; an address nobody answers on is
said as such. `--scheme`,
`--timezone`, `--url`, `--json`, as `page shot`; the page is read once the space has hydrated.
`--frames` compares pictures taken one after another and names what moved. A project `create` writes has them as
`npm run check` and `npm run shot`.

## `space fix`

```bash
plitzi space fix            # what authoring would fix, as a diff of your own source
plitzi space fix --write    # written, formatted as the project formats, and checked
```

The fixes are the ones with a single reading (`fixSpace`'s: a key the element never reads, `'true'` where a boolean
goes, a URL in page mode, a `state.` prefix on a state key…). Each is made in the call that wrote the element — found
by the line and column the element remembers — and only where the value is written as a literal; anything else is
listed with where it is and why it was left. `--write` authors the space again in a fresh process and keeps the edits
only if every fix is gone and no problem was added; a fix that would add one is put back and said.

## `element where` and `element edit`

```bash
plitzi element where hero-cta                            # by id: the file, the line and the call that writes it
plitzi element where navLink                             # every element wearing the class (`nav-link` or `navLink`)
plitzi element where "Get started"                       # every element showing the words
plitzi element where cta --by text                       # one reading only: id, class or text
plitzi element edit hero-cta --set content="Start free"  # an attribute written in that call
plitzi element edit signup --set required=true --remove placeholder
plitzi element edit site-brand --every --set label="Home"  # a helper's call that writes several elements: every one
```

`element where` answers where the project's code writes an element — `src/space/pages/home.ts:42` and the call itself, or the
object a page or a layout is declared as — so
the call is edited instead of the files around it being read. It is asked of the code as it is now: the space is
authored again and each element's call read back, the way `space fix` finds it, so it follows an element wherever somebody
moved it, with nothing kept that could fall out of step. Ten matches at most, the call shown for the first three;
`--json` adds the element's attributes when it was asked for by id. A query is read as an id, then a class, then words —
the first that matches is answered, and any other that matched too is said with its count and the command for it
(`--by text`); `--by` reads it one way only. Words are every word an element says: its content, a `label`, `title`,
`alt` or `placeholder`, a binding's template, the words an instance hands its component. Asked for a class, it says
where the class is declared too — the `styles()` call — before who wears it; and an element written inside a
`LIST.map(item => …)` says which list it is repeated for and the file it is in. A space that does not author is said, with the
lines of `src/` holding the words instead.

`element edit` writes attributes in that call — `content` given as the factory's first argument (`text('Hi', { … })`) where it
is — keeping the kind each one has (a number stays a number; a new one is `true`/`false` or words), formats the file as
the project formats it, and authors the space again in a fresh process, read against the space before it: unless every
value asked for is there and nothing else in the space changed, the files go back to what they were, and what would
have changed besides is named. What it changed is printed, every line of it (`--json`: `effects`). An attribute a
binding computes is refused — the page shows the binding's value, never one written — and `element where` marks it `Bound`. A value that is a parameter of the helper the call is in (`heading(title, { … })` inside
`pageHead(id, title)`) is changed where the helper is handed it — `pageHead('about-head', 'About us')` — followed up
as far as the project's code hands it on, and only when the helper reads it once. A value read off a list the call is
repeated for (`QUESTIONS.map(item => button({ content: item.question }))`) is changed in the one entry of the list
that holds it, in whichever file the list is written. A component's instance is edited like any element: its
attributes are the props it hands the component, and `element where` finds the words it hands too. A page is edited by its
attributes as `element where` shows them — `seoPageTitle` is written as the page's `seoTitle`. A value read in more than one
place — a list entry a nav and a menu both draw — changes them all only with `--every`, every one named. A call that writes more than one
element — a helper called for each — is never changed unasked: `element where` says which elements it writes and the call that
leads to this one alone, and `element edit` refuses, naming them, unless `--every` says the change is for all of them. Any other
value written as anything but a literal — a variable, a template, props spread from elsewhere — is left to the author,
said with where it is. The same `element edit` refused again within a few minutes says so,
and that running it once more will not change the answer (kept in `tmp/refusals.json`).

## `element remove`, `element move` and `verify`

```bash
plitzi element remove ent-trust                     # the element's call taken out, with the styles and imports only it used
plitzi element move ent-faq --before ent-pricing    # put before (or --after) a sibling of the same list of children
plitzi verify                               # author, lint:space, typecheck, lint, test, format and every page: what fails
plitzi verify --no-pages                    # the pages left out, said as such
```

`element remove` and `element move` act on the call that writes the element — or, a section a helper builds and returns
(`body: [enterpriseFaq()]`), on the helper's call — and are checked as `element edit` is: the space authored again in a fresh
process and read against the one before. A removal may take the element and what it holds and nothing else; a move
may change only its parent's order, with the element beside the one it was moved by. Anything more and the file goes
back, what it would have changed named — and the space read again goes through the same gate `npm run author` does, so
a change that leaves it refused is never kept. A removal is refused before anything is written when another element's
flow acts on what it would take away (`site-search openModal → search-modal`), each said with where it is. What it took
is said once, by the outermost element, with how many it held. A `styles()` declared for the removed element alone goes with it, and its
factories' imports, named; a helper left with no caller is said, not deleted. A call written once for several
elements (a `map`), a page or a layout, and a move between two files are left to the author, said.

An element's own selector and its bindings are named after its place under its nearest id — not after its position
among its siblings — so a move renames nothing.

`verify` runs each check the project has a script for, as its package manager runs one, then opens every page with
no parameter in its path at 1440 and 390 px, in every theme the space can be painted in — light and dark, unless
it says light only — (the server must be up: `npm start`). Only what fails is printed, with the
last lines it said, and the first failure ends the run — one broken file fails every step after it the same way — the
rest said as not run until it passes (`--keep-going` runs them anyway). A page the browser was sent away from — one
for signed-in visitors — is checked again signed in as the project's account, when `.env` names one:
`PLITZI_CHECK_USER` and `PLITZI_CHECK_PASSWORD`, the password `page check --as` and `page shot --as` read too (the environment wins over
`.env`, as it does for the project's scripts; never on the command line, which a shell keeps). One that even that
account is sent away from, or with no account named, is said as not checked, never as passing — on its own line, with
what checks it, without failing the run. Exit 1 when anything failed.

## `space lint`

```bash
plitzi space lint                    # the space's source, eslint's way: each practice to change at its file and line
plitzi space lint --json             # one object: { scope, notChecked, counts, findings }
plitzi space lint --max-warnings 0   # more warnings than that fail (exit 1); --strict: any warning does
```

How the space in `src/space/` is written — what only its source can say, and what grows hard to read and to change as
a space reaches thousands of lines. Each finding has a stable `code`, a severity, the file, line and column, what to
write instead, and `docs`: the reference of the project's skills that explains the practice. A project `create` writes
has it as `npm run lint:space`.

| Code                       | What it finds                                                                                                                                                                                               |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `unused-file`              | a file of `src/space/` nothing `src/space/index.ts` imports reaches                                                                                                                                         |
| `file-too-long`            | a file of more than 400 non-blank lines: split it by what changes together                                                                                                                                  |
| `pages-in-one-file`        | two pages or more (past 40 lines) written in `index.ts`, which only assembles the space; three or more (past 150 lines) in any other file — one file per page, or per page family, under `src/space/pages/` |
| `inline-records`           | ten or more records written inline that a page renders (`.map`ped, or a list's `items`): rows of data for `src/data/` (`public/data/` without a server), read by a provider into one `list`                 |
| `repeated-css`             | the same CSS — three declarations or more, in any order or spelling — written three times: one class                                                                                                        |
| `special-case-in-map`      | a `map` that singles out a row by its `id`, `key`, `slug`, `name`, `title` or `label`: the difference belongs in the row's data                                                                             |
| `colour-not-token`         | a hex, `rgb()`/`hsl()`/`oklch()`… or a named colour where a colour is all a property takes — outside the declared tokens (`variables`, `light`/`dark`), anchors, masks, markup and URLs                     |
| `positional-id`            | an id minted for an element nobody named — `container-45`, `heading-a7k2`                                                                                                                                   |
| `disable-names-suggestion` | a `plitzi-lint-disable` comment naming a suggestion of authoring's, which a comment does not silence: `quiet: ['<code>']` on its element                                                                    |
| `space-does-not-author`    | error: the space does not author, so authoring's suggestions could not be read — `npm run author` says why                                                                                                  |
| `project-layout`           | error: the project is laid out where its server and `npm run author` refuse to start — one line, each error `doctor`'s to say; authoring's suggestions are read once they are fixed                         |
| `source-unreadable`        | error: the source could not be read (no TypeScript installed, a rule that could not finish)                                                                                                                 |

Beside them, every suggestion authoring makes about the space it authors to (`authorSpace(…).suggestions`) — whatever
its code, the day authoring adds it — as a warning at the line that wrote its element; `plitzi explain <code>` says what
each means. They are quieted on the element (`quiet: ['repeated-shape']`), where the builder and the MCP read it too —
the report says so under them. A practice the source departs from on purpose is said where it is, eslint's way, for
lint's own codes:
`// plitzi-lint-disable-next-line colour-not-token -- the partner's own red`, `-line` for its own line, and
`// plitzi-lint-disable <codes>` for the whole file.

It is not whether the space authors — what it refuses and warns of is `npm run author`'s — nor a page as it renders
(`page check`), nor the project around the space (`doctor`); every report says so (`notChecked`). Exit code 1 while anything
is an error; with `--strict` a warning too, with `--max-warnings <n>` more than n of them.

## `space watch`

```bash
plitzi space watch          # the space read again on every save, and only what changed said
plitzi space watch --json   # one event a line: ready, pass, refused — for an agent to run in the background
```

The space read again every time a file of `src/space/`, `src/plugins/`, `src/data/` or `public/data/` is saved — each
pass in a process of its own, as `npm run author` reads it — and only what changed said:

| Event     | When                                         | What it carries                                                                                                                                                                                                                                    |
| --------- | -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ready`   | once, when it starts                         | whether the space authors (or why not), how many elements, every warning and finding, the folders watched                                                                                                                                          |
| `pass`    | a save after which the space authors         | the files saved, what the save did to the space element by element (`hero.content: "Hi" → "Hello"`, `cta (button) added`), the findings and warnings it brought and fixed, how many are left — and `unchanged: true` when the save changed nothing |
| `refused` | a save after which the space does not author | why, as `npm run author` says it (`[id-taken] … src/space/pages/home.ts:64`), and the findings it brought and fixed                                                                                                                                |
| `error`   | a pass that could not run                    | why                                                                                                                                                                                                                                                |

The findings are `space lint`'s, authoring's suggestions among them; a finding that only moved down its file is the
same one, not one fixed and one new. After a refusal, the save that fixes it is said against the space before it broke.
Saves 300 ms apart are one pass, and a save made while a pass reads waits for the next. With `--json` an agent runs it
in the background and is told what each edit did, instead of running `author` and `lint` after every one.

Not a page as it renders — the project's server restarts on the same save, and `page check` is what looks at one — nor
the project around the space (`doctor`).

## `space activity`

```bash
plitzi space activity                  # what happened on the space lately, a line each
plitzi space activity --follow         # stay, and say each as it happens
plitzi space activity --follow --json  # one page a line as it arrives: { activity, cursor, more, waitedMs, skippedMine }
plitzi space activity --after <cursor> # from where a previous read left off
```

What happened on the space the CLI works in (`space use`): its draft changed — by a person in the builder, an agent
over the MCP, the autofix — a version went out (published, its flags published, deployed), or a server action failed
or was refused. Each is a line: who, through what, and what it did, as the builder's history says it. Your own pushes
are left out and counted (`--mine` keeps them); a person's edits in the builder are never yours to leave out, even
signed in as the same account.

With `--follow` it stays: each request waits up to 50 seconds for something to happen, asks again when it is answered,
and asks again after a few seconds when the platform does not answer. A cursor the platform did not give out ends it,
saying so. `--limit <n>` caps a page (100 at most).

It is the platform's `GET /spaces/:spaceId/activity?after=&wait=&limit=&mine=`, under `spaceView` — what the MCP's
`plitzi_activity` reads too.

## `run` and `task` — multi-agent

A team of agents on one project, only when one is asked for. `plitzi run start "<the ask>"` is how one starts: it checks
what a run needs — a space in the project's code, the project's Chromium, the harness asked for — opens the run on its
scope (the lead's spike) and says each step after it. `plitzi run agent <name>` writes an agent's prompt in the run's
scratch and prints the command that starts it headless in Claude Code, Codex or opencode; `--launch --harness <it>`
starts it now, its output beside its prompt. `plitzi run --help` and `plitzi task --help` group their commands by who
runs them — you, the lead, every agent.

```bash
plitzi space overview                      # who owns which file, read off the imports; what is shared
plitzi run team                            # who works the runs: .plitzi/team.json, the agents, their roles and models
plitzi run plan plan.json                  # a plan the lead wrote, held to the rules and estimated
plitzi run open plan.json                  # its folder, every file it touches backed up — and the lead's token, printed
plitzi task next --role designer --agent design-1   # an agent's first command names it, and answers its own token
plitzi task take t-home --token <yours> --json      # its files locked, its copy (which says the task, to you alone)
plitzi task propose t-menu --change "…"    # ask another task to agree to a change; task answer accepts or counters
plitzi task check --token …                # what complete holds the copy to, run now: nothing changes (--fix: lint and format first)
plitzi task complete --token …             # its copy compared by fingerprint, the project's checks run in it
plitzi task review t-home --approve --token <lead's>   # the lead's: into the run's work, never into the project
plitzi task review t-home --approve --skip-design lead --token <lead's>   # before its UI review, saying why: lead or no-ui
plitzi run notice "…" --on /pets            # something wrong no task owns: kept, said by the finish — the next stage's
plitzi run reference                       # the plan's reference site kept as it is now: page shot --compare measures against it
plitzi run watch --json                    # how the run goes: a line per task, what needs attention
plitzi run watch --until lead              # ends the moment something needs the lead: run it in the background
plitzi run preview                         # the run's work as it goes, served: each approval shows; its dev tools' Run tab
plitzi run monitor                         # the run, live, in a terminal of your own beside the harness: its flow as a kanban, its tasks, agents and activity, fitted to the terminal — it only reads
plitzi task show t-home                    # a task as its lead reviews it: checks, agreements, each file's diff
plitzi task show t-home src/space/pages/home/hero.ts   # one file whole, as it went to review
plitzi run report --summary summary.md     # the lead closes the run with its report (--tokens agent=count,… the harness's)
plitzi run bench                           # every run measured the same way: minutes a task, rounds, checks failed, cost
plitzi run finish                          # the whole diff and the checks on the result — then --apply, a person's
```

Several agents — subagents of one harness, or harnesses of different kinds — on one project at once, without stepping on
each other and without any way to leave it broken. The harness orchestrates: it splits the job, starts the
subagents and pays for them; the CLI reserves files, isolates each task, checks, merges, keeps backups and shows the
progress. Nothing reaches Plitzi: a space on Plitzi is pulled first and pushed once at the end, by a person. **One plan
and one run at a time** in a project: a second is refused, naming the first.

- **One agent per file**, the owners read off the imports: a page owns the modules only it imports; what several import
  (tokens, classes, a layout, a component) and every entry are shared — taken by turns (`task claim`, `task wait`) or,
  when several tasks want one at once, changed in each copy as a **request** that one integration task, made by the CLI,
  applies together. A plugin's folder is its own whole. A task holds its plan's files until it is done; a file handed on
  by turns arrives with what the run approved since the copy was made, and `task wait --follow` stays until it does.
- **A team:** the lead — team lead and software architect — plans, reviews, answers and closes; past four agents, leads
  that review beside it (`lead-2`…, up to one for every four, `run team set lead --count` another number) — started only
  when the reviews queue up, and stopping once the queue is empty — take each review from one queue (`task next --role
lead`) and do nothing else; tasks name the role that
  works them (`"role": "designer"`, a developer's when left out) and `task next --role` picks by it. The lead and the
  agents talk while they work: `task ask` (an agent's question, on top of `run status`), `task message
<task|all|@agent>` (the lead's word, handed to the agent with its next heartbeat, progress or completion), `task
inbox`. A block lifted carries its answer (`task unblock --answer`), and `task next` hands an agent back the task it
  holds first — and a free agent a task sent back while its own agent is at another (after 3 minutes; that agent is
  told). A round of UI sent back goes to the designer who said the one before, another only after a wait.
- **Connected as it goes:** a shared file a task changed is its by turns at `complete` when nobody holds it, and merged
  line by line when the run moved meanwhile; `run preview` — the project's `npm run start:preview` — serves the run's
  work as each task is approved, and `run preview --task` a task in review, before it is. Your own `start:dev` serves
  the project as it is until the finish, and says so on its console while a run is open.
- **No task ends with failing checks** — lint, types, tests: `complete` refuses. Only for a reason that weighs, said to
  the lead: `--known-failure "why" --fixed-by <task>`; the final merge still needs every check green.
- **As many agents as the team has** (`.plitzi/team.json`: every new project starts with two developers — one with the
  run, the other on demand — and a designer, few agents at once — and what each role does is in it, and in `run team`; one made before it gets the team its
  first plan needs; above 5 a person confirms): past it, `task take` waits for one to finish.
- **Each task in a copy** of the project in `tmp/plitzi-runs/<run>/` — cloned copy-on-write where the disk can; never
  `.env` (its templates, `.env.example`, are), `node_modules` or the binaries of `public/`. Only the task's own files may
  change in it: `task complete` refuses anything else, naming it, and runs the project's checks (what `verify` runs) in
  the copy. A `.lock` per file sits at the file's path under its task's `locks/`, and `run can-write <file>` answers any
  hook or editor.
- **Tasks agree with each other:** `task propose <task> --change "…" [--wait]` asks another task for a change in its
  work; it answers `task answer <proposal> --accept | --reject "why" | --counter "…"` (three rounds, then the lead
  decides). A task does not complete with a proposal to it unanswered; what was accepted is an agreement both reviews
  check.
- **Before anything is written, the file is checked:** a file someone changed in the project while an agent worked on
  it refuses that task's approval, naming it. The lead decides — `task review --approve --overwrite` writes the
  task's version over it at the finish, said in `run status` and the report, the other version kept in
  `tmp/plitzi-backups/`; or `--changes` sends it back to redo on the project's version. A file changed after its
  approval puts the finish into **reconciliation**, resolved file by file by the lead (`run resolve … --take
project|run|<file>`, then `run continue`).
- **Approved work merges into the run's**, never into the project. The project receives one merge, `run finish --apply`,
  confirmed by a person typing the run's name in their terminal, once the lead closed the run with its report
  (`run report --summary <file>`): written file by file as one transaction, with a backup of everything it overwrites.
- **What the person does, and does not:** the final merge, an abort, a restore, a purge, a forced stop and taking a run
  over are yours — and only yours because you keep them so. An agent with a shell can give itself a terminal and type a
  run's name, so deny those commands to the agents in the harness (`run finish --apply`, `run abort`, `run purge`, `run
restore`, `run allow-finish`, `run stop --force`, `run attach --take-over` — in Claude Code, `permissions.deny` in
  `.claude/settings.json`). Type a run's name only for a command you ran yourself and read, never because an agent or
  the lead asks you to in a chat. Do not edit `tmp/plitzi-runs/` by hand (a broken record stops the run, said by name),
  nor delete a task's copy. To upgrade Plitzi while a run is open: `plitzi run upgrade` — it stops the run gently,
  waits until nothing is being written, upgrades, re-pins and resumes it; the agents wait and go on. Never `npm install`
  under an open run by hand: it changes `node_modules` under the agents' commands (and stops a preview).
  Editing a project file a task holds is yours to do — its approval then stops and the lead decides — but telling the
  lead first costs less.
- **When it ends, the run goes** — backups included, so none is left to clean up — and its report stays in
  `tmp/plitzi-reports/<run>-<time>.md`: the lead's summary, the problems, every task (agents, time against its
  estimate, reviews, cuts) and what was written. `--keep-backup` keeps the project's files as they were before the merge
  in `tmp/plitzi-backups/`; `run abort` (a person's) writes nothing, discards the agents' work and leaves the report too.
- **Cuts:** a task with no signal (15 minutes without a write, progress or heartbeat) can be reassigned; one taken again
  starts from its last reviewed version — what was written since is never resumed. `run attach` picks a run up after
  the harness died, on another machine, or after an upgrade. `run stop` lets the tasks in hand finish.
- **Who calls is proved by a token**, never by a name typed: each agent's (`<run>.@<agent>.<secret>`) is made at its
  first command (`--agent <name>`, said once) and kept in `tmp/plitzi-runs/<run>/scratch/<agent>/token`; the lead's is
  printed by `run open`. Every command after passes it (`--token`), in a task's copy too — the copy says the task, not
  who: no token, an empty one, a task's, a name that has one said without it, a token under another's name, a name or a
  role not of the team are refused (26) — but the readings
  anyone may ask (`run status`, `run report`, `run can-write`). What is the lead's is the lead's by its token, and a
  message to a task goes out in the lead's voice, so it is a lead's too. A guard rail against an agent's mistake, not a
  wall: an agent with a shell can read another's token file.
- **No git needed:** the run keeps its own backups while it lasts, and the CLI never commits.
- Every command answers `--json` and exits with a code per refusal: 10 claimed, 11 waiting, 12 reassigned, 13 version
  mismatch, 14 stopping, 15 forced stop, 16 reconciliation, 17 a person's, 18 conflict, 19 checks failed, 20 invalid,
  21 not found, 22 another machine, 23 another run, 24 the agent limit, 25 the lead's alone, 26 not who you said
  (pass your own token).

## `page import`

```bash
plitzi page import https://example.com/pricing                 # into src/imported
plitzi page import https://example.com/ --out src/home --width 1440,390
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
plitzi explain pageFamily       # any other export of a @plitzi package installed — createServer is sdk-server's and sdk-mcp's
plitzi explain --list steps     # every one of a kind: elements, steps, triggers, codes, transformers, helpers, filters
plitzi explain list.put         # a server action's step, as the project's @plitzi/sdk-server declares it (--list tasks)
```

What a name means when authoring, from the catalogues the checks themselves read — the answer to a question that would
otherwise be a search through the SDK's types. A name no catalogue holds — `pageFamily`, `styles`, `SpaceSpec` — is any
export of `@plitzi/sdk-authoring`, answered from the `.d.ts` the project installed, so it is the version the project
runs. An element of the project's own — `src/plugins/<Name>/` — is explained by its type the same way: what it takes
(each attribute at its default), fires and answers, and how it is placed — its declaration imported and
`defineElement(declaration)` called — which `plugin add` prints too. `--json` answers in one object; over MCP it is `plitzi://explain/{name}`.

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
author`'s, how it is written `space lint`'s, and how a page renders `page check`'s. Exit code 1 while anything is an error (with `--strict`, a warning).

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

**Where each part lives** is one check (`checkProjectLayout`, `@plitzi/sdk-shared/project`) said by three: the
server refuses to start on its errors, listing every one (and prints its warnings while developing — a plugin folder
added broken while `start:dev` runs is said there, and the server goes on), `npm run author` and the CLI's checks
(`page check`, `space push`, `space fix`) refuse to author, and `doctor` says each with its fix under `layout`. `space lint` says in one line
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

| Area        | What is held                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `layout`    | where an older CLI kept what this one reads elsewhere (`src/space.ts`, `src/site/`, `src/actions.ts`, `src/author.ts`, `functions/`) and what it left behind (`src/plugins/declarations.ts`, `.sdk-plugins/`, `.plitzi/dev-server.json`, the `tmp/space.json` an older `src/main.ts` re-read the space from); every part where the server, `npm run author` and the CLI's checks read it (`PROJECT_LAYOUT_CODES`, above)                                                                                                             |
| `packages`  | `"type": "module"`, the Node version; every package the project and its scripts need, declared and installed at a version its range allows; the SDK's packages at one version, no older than the CLI; one copy of the SDK and of React (none installed inside another); the scripts — gone, behind the CLI, or the project's own — the file each Node script starts, every folder `start:dev` watches, and a server's scripts reading `.env` (`--env-file-if-exists`; a watched one by the preload, never Node's flag); one lockfile |
| `machinery` | the CLI's files (`MACHINERY`), as `upgrade` sees them: gone, behind, or the project's own (said, never failed); one it no longer writes, left over (`src/env.ts`); the scaffold record                                                                                                                                                                                                                                                                                                                                               |
| `config`    | `tsconfig.json` reads `src/` and `.plitzi/` and sets what Node's type stripping needs; `tsconfig.build.json` writes the file `start:prod` runs; `.gitignore` keeps `.env` out (and `node_modules`, `tmp`, `dist`, `state`) and `.plitzi/` in; `.env` not in git; the signing secret, as long as the project's own server wants it; a cloud project's key                                                                                                                                                                             |
| `sources`   | what Node runs as written — `src/main.ts`, `src/config/`, `src/actions/`, `src/space/`, `src/runtime/`, `.plitzi/author.ts`, the plugins' declarations, and all they import: every relative import a file that is there, with its extension; JSON imported `with { type: 'json' }`; no JSX; every package declared (a devDependency, in what production runs, is said); what the server loads by name exported (`space`, `actions`, the runtime's default)                                                                           |
| `plugins`   | each folder of `src/plugins/` the server can build: its entry builds and exports its component, its packages declared; its `declaration.ts` loads and its `type` is the folder's (`StatCard` → `statCard`); its `Settings.tsx`, the panel the builder edits it with, written and passed as `pluginSettings` — even with nothing to set                                                                                                                                                                                               |
| `data`      | every JSON file of `src/data/` and `public/data/` parses — what the server answers with and `space push` sends                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `functions` | `src/functions/` built by the project's own `@plitzi/sdk-server` (`buildFunctions`), as every runner builds them                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `records`   | `.plitzi/space.json`, `scaffold.json` and `functions.json` readable, and of the same space                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `skills`    | `.claude/skills/plitzi-*` as the packages installed write them                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |

It loads the plugins' declarations and the project's own `@plitzi/sdk-server` to ask them — as the server does — and
never starts the server or the runtime. A check that cannot finish is said as an error
of its area, never a crash.

## `cert`

```bash
plitzi cert                              # HTTPS for a phone or a tablet on your Wi-Fi
plitzi cert --name studio.tailnet.ts.net # a name of the machine's own too
plitzi cert --json                       # one object: { cert, key, names, authority, open, urls }
```

A project opens to its network with `HOST=0.0.0.0` in `.env` — the server, or Vite, prints every address to open. Over
plain http, though, a phone's browser gives the page no microphone, camera, clipboard, geolocation or service worker:
it is not a secure context. `cert` makes a certificate for this machine — loopback, every network address it has, its
mDNS name (`studio.local`) and the names `--name` adds — in `tmp/tls/`, and sets `TLS_CERT` and `TLS_KEY` in `.env`,
which the server and Vite serve HTTPS from with no code of the project's.

It is signed by [mkcert](https://github.com/FiloSottile/mkcert)'s local authority, which `cert` asks you to install when
it is missing (`brew install mkcert`, `apt install mkcert`, `choco install mkcert`). At a terminal it runs
`mkcert -install` — it may ask for your password — so this machine's browsers trust it; with nobody there (an agent,
`--json`) it leaves that step to you. The phone trusts it once you install the authority there: `rootCA.pem`, in
`mkcert -CAROOT` — that file only, never `rootCA-key.pem` beside it — sent by AirDrop or mail and trusted fully in
Settings › General › About › Certificate Trust Settings on an iPhone; installed as a CA certificate under Settings ›
Security on Android.

A certificate names the addresses it was made for: when the router hands the machine a new one, the server says so at
boot, and `cert` makes one again — or open the `.local` name, which stays. A space read from Plitzi by a browser project
answers the address the phone opens once it is among the space's allowed domains.

## `feedback`

```bash
npx @plitzi/cli feedback                                   # a report to Plitzi, started
npx @plitzi/cli feedback --previous https://claude.ai/artifact/…   # continuing an earlier one
```

A report of what broke, misled or cost time, for a developer to send to Plitzi as a link. The CLI reads what a report
must not get wrong — every `@plitzi` package installed and its version, Node and the machine, the project's mode and
source, what `plitzi doctor` finds — and writes the page the report is laid out in, `tmp/feedback/report-<date>.html`:
a tally by severity, what was built, what changed since the earlier reports, where to start, the findings filtered by
severity and area and each copied as an issue, and what worked — in light and dark, on a phone. It prints how to fill
it for the agent the developer works with: one `REPORT` object, each finding reproduced on the installed versions
before it is written, with what happens, the evidence, the impact, the workaround and a fix; no secret, token or
customer's data. The agent then publishes it as a private artifact and gives the developer its URL. `--previous` hands
it the earlier reports: their numbering goes on, and what changed of each finding is said. `--json`: `{ file, facts,
brief }`.

## `upgrade`

```bash
plitzi upgrade                       # what this CLI would change in the project — shown, nothing written
plitzi upgrade skills --write        # only the skills, each replaced whole from the packages installed
plitzi upgrade --write --take .plitzi/author.ts
```

A project brought up to the CLI it has now, part by part: `files` (the machinery — `author.ts`, `main.ts`, the
Playwright and lint configs, `AGENTS.md`), `packages` (`package.json` merged, `@plitzi/*` raised to this version, then
the install), `skills` (`.claude/skills/plitzi-*`, whole, so a reference a skill no longer has goes with it) and
`migrations` (what a version changed that the project's own source may have to follow, at its file and line, with the
version it shipped in — rewritten with `--write` where the change has one right answer, a rename, and said otherwise:
since 0.38.17, an import of one file of a package its install now imports by folder, with the folder to name instead). A
`.gitkeep` is written only in a folder with nothing else in it. A file nobody changed since the CLI wrote it is replaced;
one the project made its own is a diff, left unless `--take` names it (`all` for every one). The generated
`.prettierignore` names them, so the project's `format` never turns one into a file `upgrade` believes was changed. A file of the project's own
that the machinery reads (`src/config/serverOptions.ts`, `src/actions/index.ts`) is written when the project has none and the
`main.ts` reading it is the CLI's, and never replaced. A script is the same: one the CLI wrote and nobody changed takes
today's command, one the project changed is left and said. A file the CLI no longer writes — `src/env.ts`, now that
Node reads `.env` — is removed the same way once the `main.ts` that read it is the CLI's; one the project changed is
said and left, unless `--take` names it (`.plitzi/scaffold.json` records the files and the scripts, and the package
manager the files were written for — what a project not installed yet has no lockfile to say). In a project made from
a space, a file the space gave over one of the CLI's would be the space's, and `upgrade` would leave it to `plitzi space pull` —
none does: `serveProject` runs whatever the space brought, from where it lands. `update` is the same
command, and `plitzi skills update` is `upgrade skills --write`. `npm run author` says when the authoring skill is
older than the `@plitzi/sdk-authoring` installed. With a run of agents open (`plitzi run state`), `--write` waits: the run
pinned the Plitzi its copies were made with. `--with-open-runs` upgrades anyway, and each run then refuses its commands
until a person attaches to it (`plitzi run attach`), which re-pins it: the tasks in hand keep their copies and their
agents, who wait meanwhile and are told to go on. A run's files read by a CLI newer than the one that wrote them are
held to by a test of every released version's; one that cannot be read is said as the other CLI's, with the command
to go on with it.

## `data describe`

```bash
plitzi data describe src/data/products.json          # its shape, and one row of its longest list
plitzi data describe src/data/products.json --json   # { shape, example }
```

The fields of a JSON file, their types and which rows have them — `price?: number  (in 812 of 879)` — so a page can
be bound to half a megabyte of data after reading twenty lines of it. An object keyed by data — slugs, ids — is one
shape, said once: `{ [key]: … }  (500 keys: "first-post", …)`. A file written a letter off is offered the nearest one
beside it.

## `space pull`

```bash
plitzi space pull                                    # the space's changes in, yours kept
plitzi space pull --force                            # where a file changed on both sides, the space's copy wins
plitzi space pull --environment production --revision latest   # follow another version from now on
```

In a project `create --from` wrote: a file the space changed and you did not is written, one you changed and the space
did not is kept, one the space no longer has is removed unless you changed it. A file changed on both makes the pull
write **nothing** and name them. Both sides are compared as the project's Prettier writes them. `.env` is never touched;
`package.json` only gains the packages the space's code now asks for. It follows the version the project was made from —
the draft, an environment's latest, or a pinned revision.

## `space push`

```bash
plitzi space push                                    # at a terminal: tick what goes up — what changed is ticked already
plitzi space push space functions                    # only these: space, functions, data, runtime, plugins, files
plitzi space push space --force                      # replace the draft even though it was edited in the builder since
```

The way back of `space pull`: the project put on the space it works with, as its **draft**. With nobody at the terminal it
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
`.plitzi/space.json` records what was sent, so `space pull` keeps working — on a project that started on its own too.

The space goes back with its files where Plitzi serves them: a path to a file of `public/assets/` (`/assets/a.png`) —
one `create --from` or `space pull` wrote, or one the `files` part put on the CDN — is sent as that file's CDN address. Only
`public/assets/` goes to the CDN: the rest of `public/` is the project's own server's. What would not reach Plitzi is
said before anything is sent, with what to do: a provider reading a file `src/data/` does not hold, a file of
`public/assets/` the space names that is not on its CDN yet, and one of `public/` outside `assets/`.

## `plugin add`

Adds elements of your own to the project you are in — one, several at once (`plugin add seat-picker legend`), or one at
a time as the need comes. Each is a folder, written the way Plitzi's own elements are (`@plitzi/sdk-elements`): the
component, its `declaration.ts` (`definePlugin` from `@plitzi/sdk-authoring/plugin`: its `type`, the events it fires,
the actions it answers to, its defaults — the element the builder adds is derived from them), its `Settings.tsx` panel for the builder, and the `index.ts` that puts them together — what the folder is built
from: `index.ts`, or `index.tsx` for one that writes its JSX there, never both. It asks what to call each, what the
builder shows, and what it is for, and checks every folder is free before writing any.

- **In a project `plitzi create` wrote**, it goes in `src/plugins`, where the project already looks: nothing to
  register, and a running `start:dev` picks it up without a restart. Place it in `src/space/` from its declaration —
  `defineElement(declaration)`, then `seatPicker({ id: 'seats' })` — or, when the space lives in
  Plitzi, pack and upload it and add it in the builder.
- **In a plugin package**, it goes in `src/`, and is added to `src/elements.ts` and `src/declarations.ts`, from which
  the package publishes it.
- **In any other project**, it asks which folder holds the project's components (`--dir` answers it) and prints how
  to register the element — for `render()`, for `<PlitziSdk>` in a React application, and for a page server.

A name that would make a built-in element's type (`button`, `form`) is refused: a space could not tell the two apart.

Told its shape, it writes that shape rather than the counter it writes otherwise — one element at a time:

```bash
plitzi plugin add ticker --prop interval:number=5000 --prop paused:boolean --trigger onTick:count --callback reset --headless
```

`--prop name:type=default` (string, number or boolean) is an attribute: in the props, the declaration's defaults and
`bindingsAllowed`, and a control in `Settings.tsx`; `--prop rows:list` and `--prop meta:json` are data a binding fills
(`unknown[]`, `Record<string, unknown>`, empty until it does). `--trigger onTick:count,at` is an event and what a flow
started by it reads, fired with `usePluginTrigger(declaration)` — `fire('onTick', { count, at })`, typed by the
declaration, and never on the builder's canvas. `--callback reset`
is an action a flow can call. `--headless` is an element with nothing to see: hidden on a page, a badge in the builder,
and `drawsNothing` in its declaration, so a page check does not look for it. The files are written as the project's
Prettier writes them.

`--server` gives the element a server half: `functions/index.ts` in its folder, written like a space's functions — its
routes answer under `/fn/plugins/<type>/` (`usePluginRoute(type)` in the component names them), its tasks are steps
`<type>.<action>`, and it runs with a plugin's own corner of `kv`, none of the space's credentials or channels. In a
server-mode project or a plugin package (which gets `@plitzi/sdk-server` for the types); a project that renders in the
browser alone has nothing to run it, and is refused. `plugin pack` carries it as `functions.source.json`, and the
platform builds and keeps it privately when the plugin is uploaded — see
[functions § a plugin's server half](../../docs/en/functions.md#11-a-plugins-server-half).

## `create --plugin`

A plugin package: elements any space can load, with a Vite preview to write them in. It builds nothing itself —
`plugin pack` does, for every plugin — so it carries no bundler config and no build dependency.

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

## `plugin pack`

The one place a plugin is built — from a plugin package, or from element folders of any project:

```bash
plitzi plugin pack                                    # in a plugin package: every element it holds
plitzi plugin pack src/plugins/SeatPicker             # an element of a self-hosted project
plitzi plugin pack src/plugins/SeatPicker src/plugins/Legend   # several in one plugin, the first its main
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
— followed with the project's own TypeScript, `import type` included — and the packages they need. `plugin upload`
keeps it on the space, which is what `create --from` brings back. `--source-root` names the project those paths are
relative to, when the elements are not a project of their own. A file outside it, a credentials file or a credential
in the code keeps it from being written — said, and never stopping the build.

## `source pack`

```bash
plitzi source pack src/runtime/index.ts --kind runtime --name runtime -o runtime.source.json.gz
```

What `plugin upload` and `runtime push` keep, written to a file to look at: the closure of the entries named, gzipped.

## `login`, `space use` and `plugin upload`

```bash
plitzi login          # sign in, in your browser
plitzi space use          # choose the space to work in, in your browser
plitzi whoami         # who you are signed in as, and the space; --json for a tool
plitzi plugin upload  # the zip pack plugin left, on that space
plitzi logout         # the session revoked on the platform, and forgotten here
```

Signing in happens in the browser, on the platform's own sign-in — the CLI never asks for a password, and MFA or a
social sign-in work without it knowing. What it keeps is the session and a way to renew it, in
`~/.config/plitzi/connection.json` (`%APPDATA%\plitzi` on Windows), readable by you alone. It is renewed on its own,
and it shows among your account's devices, where it can be ended like any other.

**One space at a time.** The space is chosen on the same grant screen an AI connector's is, and the CLI works in that
one until `plitzi space use` chooses another — which replaces the connection, and revokes the one before. No command takes a
space of its own: an upload goes to the space `plitzi whoami` names, so a plugin meant for a staging space cannot end
up in the live one because of a flag.

`plugin upload` takes the zip named, or the one `plugin pack` left in the project (the newest, when there are several —
asked at a terminal). It is checked for its `plugin-manifest.json` before anything is sent. Without a connection, or
without a space, the browser opens for what is missing, so the first upload is one command too. It goes on one of the
space's public buckets — `--bucket <identifier>` (narrowed to one CDN with `--cdn <identifier>`), or asked when there
are several; a private bucket is refused, since no page could load from it — and is installed, as the builder does when
a zip is dropped under Resources: added, or the plugin already there moved to the new version with its settings kept. The
source `plugin pack` wrote beside the zip goes up after it, into the space's private bucket.

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
`plitzi runtime add` writes it in a project from `plitzi create` in server mode, whose `src/main.ts` runs it too —
`/hello` answers on `npm start` — and whose `start:dev` restarts on it; `examples/self-hosting/10-runtime` is the smallest one to start
from, and it runs as a server of its own too.

`runtime push` packs the module with the project's own `@plitzi/sdk-server` — the module and every package it imports, bar
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
plitzi functions add ical.js                                       # an installed package bundled into src/functions/vendor/
```

A space's own server code — tasks its actions run as steps, routes under `/fn/` — and `src/functions/` is a working copy
of it: `.plitzi/functions.json` keeps what was pulled, so `functions pull` refuses to overwrite what is not pushed (`--force`
throws it away) and `functions push` refuses when the space moved on since. A problem comes back as
`src/functions/<file>:<line> <message>`. `dev` runs with the project's own `@plitzi/sdk-server` (`isolated-vm` and
`core-js` beside it); credentials come from `PLITZI_CREDENTIALS` (`.env`), as they do for the project's server. See `docs/en/functions.md`.

## Credentials

`create` never mints a key to Plitzi. A cloud project's key comes from Credentials in the builder, is written to
`.env`, and `.gitignore` is written in the same breath. Server and browser take **different** keys and the scaffold
names them differently on purpose: a server gets the secret self-hosting key, a browser gets the public render key,
whose protection is the origin it is presenting from.

Every project has a `.env`, never committed, and a `.env.example`, committed: the same settings with no secret in them,
for a clone to copy and fill in. A server project's `.env` is read as each script starts —
`node --env-file-if-exists=.env` in `start`, `start:prod` and `author`, and in `start:dev`, which Node watches,
`node --import @plitzi/sdk-server/env` (Node's flag there has its watcher restart on every write in the project) —
`start:dev-inspect` is the same with Node's inspector open on 127.0.0.1:9229, for a debugger to attach —
before any of its modules is evaluated, so `src/config/serverOptions.ts` and the actions find their settings in
`process.env` as they load. A change to it is read on the next start, and a deployment that sets its environment needs
no file. `start:prod` also sets `NODE_ENV=production` itself — without it a deployed server is a development one, its
dev tools on and every action's trace in what a visitor is answered (`doctor` says a `start:prod` that does not). A
deployment started some other way says `devMode: false` in `src/config/serverOptions.ts`, which wins over `NODE_ENV`. A browser
project's is Vite's: only `VITE_*` reaches the page, and ships in it.
`create` gives each one a signing key there, made for it: `PLITZI_SIGNING_SECRET`, what `ctx.sign` and `ctx.verify`
sign with — at least 32 characters (`doctor --fix` writes one where it is missing). `PORT` is left commented out: 8080,
or the next free port while developing; so are `HOST`, loopback until it opens the project to the network, and
`TLS_CERT` and `TLS_KEY`, which `cert` sets.
