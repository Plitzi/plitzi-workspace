# Projects

## `create`

| | `--source local` | `--source cloud` |
| --- | --- | --- |
| `--mode server` | A page server of your own, rendering the space in `src/space/`. No account | Your page server, rendering the live space from Plitzi (secret self-hosting key in `.env`) |
| `--mode client` | Vite + the SDK in the browser, no server, no account | The SDK fetches the space with the public render key |

What a project gives you, so you use it rather than rebuild it:

| Script | What it is for |
| --- | --- |
| `start` | serve it — in client mode Vite, which hot-replaces on save. The server prints only what goes wrong; `-- --verbose` adds every request |
| `start:dev` | server mode: restarted on a save to its code; a plugin is swapped in the open page. Options in `src/config/serverOptions.ts`, actions in `src/actions/`; `plitzi/` is the CLI's, never edit it |
| `author` | author `src/space/`: every problem at once (file:line, what to change), then the suggestions (`[suggest]`: a shorter way to the same page, the most elements saved first); `-- --json` for a tool |
| `lint:space` | how `src/space/` is written, at file:line, and authoring's suggestions; `-- --max-warnings 0`. On purpose: `// plitzi-lint-disable-next-line <code> -- why` (a suggestion: `quiet` on its element) |
| `npx plitzi space fix` | what `author` reports that has one fix, as a diff of your source; `--write` writes it, formatted, and keeps it only if the space then authors with it gone and nothing new |
| `npx plitzi element where <id\|class\|words>` | where the code writes an element: file:line and the call — edit it there, not the files around it. `npx plitzi element edit <id> --set content="…"` writes an attribute in it, `remove <id>` takes it out, `move <id> --before <id>` reorders it — each checked |
| `check -- /path --width 1440,390` | whether a page is whole, in text: elements on screen, overflow, console, refused requests, failed flows, a binding its data lacks; `--state`, `--element <id>`: what it holds; `--ssr`: SSR misses; `--as <user>`; `--json` |
| `npx plitzi page import <url>` | a page the user owns, as a start: tokens, its blocks' layout, lists as `data/*.json` — never the words. **Only when the user asks**; a site not on this machine needs `--account`: ask first |
| `shot -- /path --width 390 --scheme dark` | a picture of one page — `--clip <element>` one element, `--frames 4` what moves (`--from load`: as the page arrives), `--steps "click a; wait 300; frames 6 150; shot"` a whole interaction, `--compare <url>` what differs from another site, `--as <user>` signed in (said, when the page sent it elsewhere) |
| `visual` | a browser asserts every element the space names is visible |
| `typecheck`, `lint`, `format` | before calling a change done |

**Which port.** `start` takes 8080, or the next free one — printed, and written to `tmp/dev-server.json` for `check`,
`shot`, `verify` and `visual`, with the scheme it answers on (`https` once it serves a certificate; the local one is
accepted on this machine only). `PORT` chooses one (a taken one is then an error). `/health` answers with the space's
name.

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
