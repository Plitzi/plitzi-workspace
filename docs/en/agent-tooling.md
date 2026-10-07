# Tools for building a site with an agent

An agent once rebuilt a real shop — home, a filterable catalogue of 879 products, a product page — from an empty folder
with `npx @plitzi/cli create --mode server --source local`, no account and no MCP, and wrote down everything that got
in its way. About 40 % of its effort went into friction the product could remove. This guide is what came of it: the
tools a project gives an agent (and a person) for building a site in code, what each is for, and why each is shaped
the way it is.

How to write a space is the `plitzi-authoring` skill (`packages/sdk-authoring/skills`); every command is in
[`apps/cli/README.md`](../../apps/cli/README.md). This page is the reasoning behind them.

## The loop: author, check, fix, look

| Step | Tool | Answers |
| --- | --- | --- |
| Write | `npm run author` | Whether the space authors: one line when it does, every problem at once (file, line, what to change) when not — and, under the warnings, the suggestions: a shorter way to the same page, with the elements it saves |
| Lint | `npm run lint:space` (`plitzi space lint`) | How the space's source is written, eslint's way, at file:line: files too long, pages in one file, rows of data written in code, colours that are not tokens, CSS copied, a row singled out in a `map`, minted ids, files nothing imports — beside authoring's suggestions at the line that wrote them. `--max-warnings 0` for CI |
| Upgrade | `npx plitzi upgrade [files\|packages\|skills\|renames]` | The project brought up to the CLI it has: the CLI's files (replaced where nobody changed them, a diff where somebody did), `package.json` merged, the skills, every renamed name at its line; `--write` makes it |
| Project | `npx plitzi doctor` | Whether the project the CLI set up is whole, after moving or rewiring files and before a push: where each part lives, packages, the CLI's files and scripts, configs, what Node runs, plugin folders, data files, functions — each problem with its file and fix. Never the space: that is `author`'s. `--fix` repairs the simple ones |
| Repair | `npx plitzi space fix` | The problems — and the suggestions — with a single reading, as a diff of the author's own source; `--write` applies and re-checks |
| Check | `npm run check` (`plitzi page check`) | Whether a page of the running server is whole, in text: elements on screen, overflow, contrast, console, refused requests, failed flows, bindings reading a path their provider's answer lacks, failed providers, rows per list; `--ssr` names what the server's HTML lacks that the hydrated page has |
| Inspect | `plitzi page check --state --element <id>` | What the page holds: its state, every source by name and shape, one element's own state and bindings |
| Look | `plitzi page shot` | A picture (in `tmp/shots/`) — `--compare <url>` against another site: each section where it is there, and the texts both have with what each does differently, measured; `--frames` for what moves; a full page has its lazy pictures loaded and its arrivals shown as they end |
| Explain | `plitzi explain <name>` | What an element, a step, a problem code or a helper (`bindTemplate`, `motion`…) means, from the catalogues the checks read |
| Start from | `plitzi page import <url>` | A page the user already has, measured as tokens, an outline and lists to write from |

Text first, pictures second. A screenshot costs thousands of tokens and still has to be looked at; `page check` says what is
wrong in a few hundred, and a picture is for when it has said something is.

## Why each tool is the way it is

**The dev server's port.** A server that silently moves to another port breaks `PUBLIC_URL` and every link built from
it, so a busy port is moved only while developing and only when `PORT` was not set — printed, and written to
`tmp/dev-server.json`, which `check`, `shot` and `visual` read. Which server answers is told by `/health`, named
after the space; a port held by another project is refused rather than photographed.

**`plitzi page check` reads the dev tools, it is not a second one.** The panel already shows state, sources and flow runs to
a person. The same data in text is what an agent needs, so the page's dev tools publish it as `window.__plitzi` and
`page check` reads it: the flows that failed while the page loaded are problems on every check, and `--state` / `--element`
print what the page holds. `window.__plitzi.element()`, the panel's **Runtime** tab and `check --element` are one report
(`sdk-dev-tools/src/agentInspector/report.ts`).
The sources it reads are also held to the page: `dataIssues` (`@plitzi/sdk-authoring`) walks every binding of
the page against the answer its provider gave, so a path that answer lacks is said with the keys it has, and a provider
that failed is said once rather than as every element it left empty. What is inside an element the page is not showing
— a `visible` of its own that says no — is not mounted, so `page check` hands those to `dataIssues` (`hidden`) and only their
own condition is read. A list's rows are counted twice: what its source holds (`dataIssues`, before the binding's
transformers) and the copies of its row the page draws, so a filtered list reads `4 of 8 rows`. `sources()` cuts only a
true cycle — a list republishes the array its provider answered — and a row's `{ item, index }`, published under its
list's name, never stands in for the list's `{ items }`. The dev tools' own badge and panel carry
`data-plitzi-devtools` and are hidden while `page check` and `page shot` look — what they report is the page a visitor gets.

**`plitzi space fix` edits the author's source, not a copy.** Every fix `fixSpace` makes says its change in the spec's own
words (`FixChange`); `planFixes` places it at the line and column of the call that wrote the element; the CLI edits only
literals there, with the project's own TypeScript and formatted with its own Prettier. It shows a diff by default.
`--write` keeps the edits only if the space, authored again in a fresh process, has every fix gone and no problem added
— a fix that would add one is put back and said. Anything that needs a decision stays a message with where it is.
A suggestion is planned the same way where it has one reading: `content-attribute` moves a button's or a link's
children — its words and an icon, written as plain `text(…)` and `fontAwesome({ icon })` — to its own `content` and
`icon`, keeping the words as written (`entry.label` stays an expression) and taking out an import it left unused; a
child with an id, options or a class of the space's own stays, said.

**`plitzi page import` reads only a site that is the user's.** Its risk is reuse of somebody else's site, so it carries no
words — tokens, the outline of the blocks with their layout per breakpoint, the repeated lists as JSON rows to replace,
screenshots, and `IMPORT.md` saying what was not carried over — and it opens a page only when the user has shown the
site is theirs: a host that resolves to this machine, asking nobody; or, with `--account`, a verified domain of one of
their spaces that covers the host (the `_plitzi` TXT record, asked of the platform with `GET /account/domains/covering`,
signed in). The account is reached only when that flag asks for it — a local project otherwise reaches none — and the
skill tells an agent to run `page import` only when the user asks, and to ask before `--account`. A domain of the platform's own
(`*.plitzi.app`) proves nothing and is never proof. The dark values of the colours are read where each light colour
was seen, not paired by rank.

**`shot --compare` says why, not only how much.** A percentage alone sent an agent measuring both pages by hand with
scripts of its own. So the comparison loads every lazy picture on both sides before taking them (`loadImages`: eager,
the page walked once for loaders that react to the scroll), unrolls the pane the SDK scrolls in so the whole page is
in the picture (`unrollPage`, the viewport untouched so `100vh` stays one screen), aligns each section of this page with where the same rows
are on the other (`alignPictures`, over row profiles — a page 400 px longer is said once, with the section where the
drift starts, instead of every section under it differing), and pairs the texts both pages have (`pageTexts`,
`compareTexts`): font size, weight, line height, colour, padding, radius, box, and position less the drift of the
section around it. All of it is `@plitzi/sdk-authoring`, for a suite to use as well.

**`--scheme` is the space's theme.** The machine's preference loses to a space whose default is dark, as it would for
any visitor. So `page check` and `page shot` set the `theme` cookie a visitor's toggle writes (`openProjectPage`) when a scheme is
asked for, and otherwise picture the space's default and name the file by the theme the page was painted in.

**The image proxy serves only declared hosts.** `/_plitzi/img` resizes and converts pictures of the domains a deployment
lists in `createServer({ images: { domains } })`, with the same guards as every other outbound request of the server,
and keeps the originals and the variants on disk — a picture is never resized twice for the same width and format.

**Shorter authoring changes nothing in the documents.** Breakpoints per property, camelCase CSS keys, `tw()`, `tokens()`,
typed sources (`source()`), `scope()` for helpers that run more than once — each is accepted beside the form it
shortens and writes the same document. A compound element is written with its parts (`carousel()` writes its own
track); one written without them is refused (`part-missing`).

**Where each part lives is checked once, and said by three.** Nobody reads `plitzi/README.md` before writing a plugin
folder: they make `src/plugin/Card/`, put the component in `Card.tsx` and no `index.ts`, drop `.env` into `src/`. Each
of those used to be silent — the server registered a folder it could not build and failed later in esbuild's words, or
read no folder at all — so the project half-worked. `checkProjectLayout` (`@plitzi/sdk-shared/project/layout`, pure file
system, no import of the project) is the one place that knows where the CLI puts everything; the server runs it at
boot, `projectAuthoring()` before authoring, and `doctor` in its `layout` area, so the three say the same sentence and
nothing reads what the others refuse. Every error is listed at once, never the first; each names the file, what is
wrong, what to do and the command, and asks about a near miss (`src/Plugins/` works on a macOS disk and not on the
Linux it is deployed to, so names are read as they are written, never looked up). The fixes with one reading are data
(`autofix`: a move, a copy, a file written), made only by `doctor --fix` with the move machinery the older layouts use.
`space lint` does not repeat them — one line that there are some, pointing at `doctor`. While `start:dev` runs, a plugin
folder added broken is said in the terminal and the server goes on: a project half-written is the normal state while
writing it.

## Left open

- `plitzi page import` measures one page. A site of many pages is many imports, each into its own `--out`.
- What `page import` cannot read stays in `IMPORT.md` for the author: text, states, scripts, fonts not on Google Fonts.
