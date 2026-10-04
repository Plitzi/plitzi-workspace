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
| Upgrade | `npx plitzi upgrade [files\|packages\|skills\|renames]` | The project brought up to the CLI it has: the CLI's files (replaced where nobody changed them, a diff where somebody did), `package.json` merged, the skills, every renamed name at its line; `--write` makes it |
| Repair | `npx plitzi fix` | The problems — and the suggestions — with a single reading, as a diff of the author's own source; `--write` applies and re-checks |
| Check | `npm run check` (`plitzi check`) | Whether a page of the running server is whole, in text: elements on screen, overflow, contrast, console, refused requests, failed flows |
| Inspect | `plitzi check --state --element <id>` | What the page holds: its state, every source by name and shape, one element's own state and bindings |
| Look | `plitzi shot` | A picture — `--compare <url>` against another site by section, `--frames` for what moves |
| Explain | `plitzi explain <name>` | What an element, a step or a problem code means, from the catalogues the checks read |
| Start from | `plitzi import <url>` | A page the user already has, measured as tokens, an outline and lists to write from |

Text first, pictures second. A screenshot costs thousands of tokens and still has to be looked at; `check` says what is
wrong in a few hundred, and a picture is for when it has said something is.

## Why each tool is the way it is

**The dev server's port.** A server that silently moves to another port breaks `PUBLIC_URL` and every link built from
it, so a busy port is moved only while developing and only when `PORT` was not set — printed, and written to
`tmp/dev-server.json`, which `check`, `shot` and `visual` read. Which server answers is told by `/health`, named
after the space; a port held by another project is refused rather than photographed.

**`plitzi check` reads the dev tools, it is not a second one.** The panel already shows state, sources and flow runs to
a person. The same data in text is what an agent needs, so the page's dev tools publish it as `window.__plitzi` and
`check` reads it: the flows that failed while the page loaded are problems on every check, and `--state` / `--element`
print what the page holds. `window.__plitzi.element()`, the panel's **Runtime** tab and `check --element` are one report
(`sdk-dev-tools/src/agentInspector/report.ts`).

**`plitzi fix` edits the author's source, not a copy.** Every fix `fixSpace` makes says its change in the spec's own
words (`FixChange`); `planFixes` places it at the line and column of the call that wrote the element; the CLI edits only
literals there, with the project's own TypeScript and formatted with its own Prettier. It shows a diff by default.
`--write` keeps the edits only if the space, authored again in a fresh process, has every fix gone and no problem added
— a fix that would add one is put back and said. Anything that needs a decision stays a message with where it is.
A suggestion is planned the same way where it has one reading: `content-attribute` moves a button's or a link's
children — its words and an icon, written as plain `text(…)` and `fontAwesome({ icon })` — to its own `content` and
`icon`, keeping the words as written (`entry.label` stays an expression) and taking out an import it left unused; a
child with an id, options or a class of the space's own stays, said.

**`plitzi import` reads only a site that is the user's.** Its risk is reuse of somebody else's site, so it carries no
words — tokens, the outline of the blocks with their layout per breakpoint, the repeated lists as JSON rows to replace,
screenshots, and `IMPORT.md` saying what was not carried over — and it opens a page only when the user has shown the
site is theirs: a verified domain of one of their spaces that covers the host (the `_plitzi` TXT record, asked of the
platform with `GET /account/domains/covering`), or a host that resolves to this machine. A domain of the platform's own
(`*.plitzi.app`) proves nothing and is never proof. The dark values of the colours are read where each light colour
was seen, not paired by rank.

**The image proxy serves only declared hosts.** `/_plitzi/img` resizes and converts pictures of the domains a deployment
lists in `createServer({ images: { domains } })`, with the same guards as every other outbound request of the server,
and keeps the originals and the variants on disk — a picture is never resized twice for the same width and format.

**Shorter authoring changes nothing in the documents.** Breakpoints per property, camelCase CSS keys, `tw()`, `tokens()`,
typed sources (`source()`), `scope()` for helpers that run more than once — each is accepted beside the form it
shortens and writes the same document. A compound element is written with its parts (`carousel()` writes its own
track); one written without them is refused (`part-missing`).

## Left open

- `plitzi import` measures one page. A site of many pages is many imports, each into its own `--out`.
- What `import` cannot read stays in `IMPORT.md` for the author: text, states, scripts, fonts not on Google Fonts.
