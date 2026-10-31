# Projects

## `create`

|  | `--source local` | `--source cloud` |
| --- | --- | --- |
| `--mode server` | A page server of your own, rendering the space in `src/space/`. No account | Your page server, rendering the live space from Plitzi (secret self-hosting key in `.env`) |
| `--mode client` | Vite + the SDK in the browser, no server, no account | The SDK fetches the space with the public render key |

What a project gives you, so you use it rather than rebuild it:

| Script | What it is for |
| --- | --- |
| `start` | serve it — in client mode Vite, which hot-replaces on save. The server prints only what goes wrong; `-- --verbose` adds every request |
| `start:dev` | server mode: restarted on a save to its code; a plugin is swapped in the open page. Options in `src/config/serverOptions.ts`, actions in `src/actions/`, a file per domain, read by what each exports; `.plitzi/` is the CLI's, never edit it |
| `start:dev-inspect` | `start:dev` with Node's inspector on 127.0.0.1:9229, for a debugger to attach to the server |
| `start:preview` | while a run of agents is open (`plitzi run`): its approved work served on 8300, as each task is approved — `start:dev` serves the project untouched until the run's finish |
| `author` | author `src/space/`: every problem at once (file:line, what to change), then the suggestions (`[suggest]`: a shorter way to the same page, the most elements saved first); `-- --json` for a tool |
| `lint:space` | how `src/space/` is written, at file:line, and authoring's suggestions; `-- --max-warnings 0`. On purpose: `// plitzi-lint-disable-next-line <code> -- why` (a suggestion: `quiet` on its element) |
| `npx plitzi space fix` | what `author` reports that has one fix, as a diff of your source; `--write` writes it, formatted, and keeps it only if the space then authors with it gone and nothing new |
| `npx plitzi element where <id\|class\|words>` | where the code writes an element: file:line and the call — edit it there, not the files around it. `npx plitzi element edit <id> --set content="…"` writes an attribute in it, `remove <id>` takes it out, `element move <id> --before <id>` reorders it — each checked |
| `check -- /path --width 1440,390` | whether a page is whole, in text: elements on screen, overflow, headings in order and every control named, console, refused requests, failed flows, a binding its data lacks; `--hover <id>` what a pointer over it changes, `--state [names]` (each source's keys and what they hold; a source by its element's id too), `--element <id>` (once each): what it holds; `--expect "[/path] id~text"` (any row of a list a visitor sees; `id=text`: that text whole, "1 contact" not "1 contacts"; `!id`: none shown; `Text` in mixed case: as the space wrote it, whatever the stylesheet's capitals) — the check then holds what it expects, the page's other findings said beside; `--sight a,b`: where a visitor sees each (clipped, under another, once a box is scrolled; `taken`: another control drawn over it takes its press); `--height 800`: a shorter screen; `--status 404`: the page meant to answer so; `--redirects-to /sign-in`: meant to send this visitor there, and what lands is checked; `--then /other`: on by the page's own link, no reload (what a session keeps); `--steps "click open; type q hi"`: what only a visitor's steps make, checked; `--ssr`: SSR misses; `--json` |
| `npx plitzi page import <url>` | a page the user owns, as a start: tokens, its blocks' layout, lists as `data/*.json` — never the words. **Only when the user asks**; a site not on this machine needs `--account`: ask first |
| `shot -- /path --width 390 --scheme dark` | a picture of one page — `--within <element>` one element, `--frames 4` what moves (`--from load`: as the page arrives), `--steps "click a; wait 300; frames 6 150; shot"` a whole interaction (`wait 3s`; `action <id> '{…}'` runs an action as the page's visitor, `as <user> <step>` plays a step as another account), `--fill search=kibble` what typing in a field shows (as page check's `--fill`), `--compare <url>` what differs from another site; signed in as `check` is |
| `npx plitzi test [id…]` | the space's own tests, as its document keeps them (`tests` in its spec): those written wrong said first, the element checks (unit tests: no browser; `--unit`), then the journeys (e2e tests) played on its pages (`--e2e`) — what a snapshot and a publish hold; `--json`. `plitzi verify` runs them too, as one of its checks (the element checks alone with `--no-pages`) |
| `npx plitzi page measure /path <el>` | an element's computed styles — a `::before`/`::after`'s too, with its x and y — and what differs from another page's (`--compare <url> --there <selector>`); `--only box,font` just those, `--only drawn` what it paints (a canvas's globe: the bounds of its pixels), `--all` every one; `--expect width>=44px`, or where two stand at every width: `--expect "activity.bottom + 8 <= legend-area.top"` (left, right, top, bottom, width, height) — never jq over `--json` |
| `visual` | a browser asserts every element the space names is visible |
| `typecheck`, `lint`, `test`, `format` | before calling a change done — `test`: the modules' own `*.test.ts` (`node --test`) |

`npx plitzi page play /path --steps "…" --read <el>`: `shot`'s steps, and after each how far each element moved, what
it shows, whether it takes a press, what its bindings gave it (a plugin's attribute) — where a step took the page
(`→ <path>`), what an action answered (`←`; whole in `--json`), a flow a step set off that failed (`✗`, failing the
play), a list's row by `<el>:2` or `<el>:last`. An action runs once, at the first `--width`; a public page plays signed out (`--as`). `check`, `measure` and `page outline` play `--steps` before they read. `--journey <id>` plays one of the space's journeys first, its checks held, and reads from where it leaves the page — never its steps written again.

Every page command reads as one visitor: a page that sends a guest away as the project's account (`PLITZI_CHECK_USER`), said — `--as <user>` another, `--guest` a guest; `--timezone <IANA>` (its hours there), `--presence` (takes part in its channels), and a browser that refuses: `--clock <instant>`, `--block <text>` (fails), `--hold <text>` (never answered: a loading state, a held load), `--autoplay refused`, `--storage refused`; `--fresh` reads anew whatever an earlier call kept (the other site's page, the space authored).

**Which port.** `start` takes 8080, or the next free one — printed, and written to `tmp/dev-server.json` for `check`,
`shot` and `verify`, with the scheme it answers on (`https` once it serves a certificate; the local one is accepted on
this machine only). `PORT` chooses one (a taken one is then an error). `/health` answers with the space's name and which copy of the
project serves it (`Instance`): `check` and `shot` refuse a port another copy holds. A save that did not author leaves the
last space that did served: `/health` says why (`spaceStale`), and every page command says it.
`visual` starts a server of its own on its folder's port from 8400 (5273 for a client project; a run's copy takes another), plain HTTP, its record in `tmp/visual/`: never
the server you have open. `start:preview` is 8300.

**On a phone.** `HOST=0.0.0.0` in `.env` opens it to the network, and `plitzi cert` serves it over HTTPS (mkcert;
`TLS_CERT`, `TLS_KEY`) — over http a phone's browser gives the page no microphone, camera or clipboard. Ask before
either: the first lets anyone on that network open it, the second trusts an authority on the machine (its password).

Data with no backend, server mode: `src/data/*.json`, never served — a provider with `runtime: 'server'` and `query:
'/data/x.json'` reads it on the server. Client mode: `public/data/`, fetched — public. Learn a file's fields with
`data describe`, never by reading it.

**`public/` is on the internet**: never a secret there. `tmp/`, `state/` (its `kv`) ignored; `.plitzi/` committed.
`--dry-run` on a command that writes or sends says what it would do, and does none of it.

A local space starts as a tour of the platform with a plugin of the project's own; **`--template blank`** as tokens, a
layout and one empty page — for a project about to be a specific site; **`--template catalog`** as a small shop
(layout, card component, data in `src/data`, a filtered list, a page per product), a file per part — the one to read
when unsure how a whole site is put together.

The space itself is written with `@plitzi/sdk-authoring` — see the `plitzi-authoring` skill, which `create` copies into
`.claude/skills/` beside this one.
