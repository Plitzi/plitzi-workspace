---
'@plitzi/plitzi-builder': patch
'@plitzi/cli': patch
'@plitzi/sdk-mcp': patch
'@plitzi/plitzi-sdk': patch
'@plitzi/sdk-server': patch
'@plitzi/sdk-auth': patch
'@plitzi/sdk-authoring': patch
'@plitzi/sdk-dev-tools': patch
'@plitzi/sdk-elements': patch
'@plitzi/sdk-event-bridge': patch
'@plitzi/sdk-interactions': patch
'@plitzi/sdk-navigation': patch
'@plitzi/sdk-plugins': patch
'@plitzi/sdk-schema': patch
'@plitzi/sdk-shared': patch
'@plitzi/sdk-style': patch
'@plitzi/sdk-variables': patch
---

## SDK

- **An embedded space leaves the page's theme alone** (`@plitzi/plitzi-sdk`, `@plitzi/plitzi-builder`): plitzi-ui's
  `Provider` stamps `dark` on `<html>` by default — and, being `light`, takes it off — so every space mounted with
  `themeScope: 'container'` turned the page around it light, and nothing put it back. The SDK and the builder now leave
  the class to their own theme provider (`applyColorModeClass={false}`).
- **A space inside a space** (`@plitzi/plitzi-sdk`, `@plitzi/sdk-shared`): one drawn inside another — the `plitziSdk`
  element, a plugin rendering one, the builder's canvas — knows it (`render.enclosed`). It is `container` unless it
  says otherwise, wears its theme on its own root and starts from the page's when its own is `system`, keeps its
  stylesheet to its own root (`@scope` — its `:root` palette and `.dark` rules repainted the outer page, its
  `.plitzi-sdk` rule restyled the outer root), writes no `<title>` (`ownsHead`) and no `theme` cookie.
- **The `plitziSdk` element draws** (`@plitzi/plitzi-sdk`): it rendered in `widget` mode with no page to show, so it
  drew nothing. A widget with no `currentPageId` now shows the page its home address would. And it takes a space's
  documents as well as a key: `offlineData`, bound whole (an `apiContainer`'s answer, a runtime's route, what
  `plitzi_render` returns) or as `offlineData.schema` and `offlineData.style` from two elements — waiting, without an
  error, for the half that has not answered; one that cannot be drawn is said why, in the console and on the canvas.
- **`<PlitziSdk>` inside a plugin draws** (`@plitzi/plitzi-sdk`): it mounted a router of its own inside the page's, and
  React Router refused it — `routing: 'memory'` or not. A space inside another is a widget: `raw` becomes `widget`
  there, one page and no router (a frame of its own, `iframe` or `shadow`, is left as asked).
- **A space inside another is as tall as what it holds** (`@plitzi/plitzi-sdk`): its root was `min-h-screen`, as a
  space that IS the page is, so a card of three lines drawn in a panel took the window's height.
- **`<PlitziSdk.Plugin component>` takes a component with its own props** (`@plitzi/plitzi-sdk`), as `render()`'s
  plugins do: typed `ComponentPluginFC`, it refused any component that read its attributes.
- **A copy button says when it could not copy** (`@plitzi/sdk-elements`, `@plitzi/sdk-shared`,
  `@plitzi/sdk-interactions`, `@plitzi/sdk-variables`, `@plitzi/sdk-dev-tools`): a page not served over https has no
  clipboard — a phone opening a development server by its address — and a code block's "Copy" threw there. It reads
  "Not copied", and says why. `clipboardWriter` and `copyText` (`@plitzi/sdk-shared/helpers/clipboard`) are the one
  check, the `copyToClipboard` step's too.

## Authoring

- **`plitziSdk` is authored like any element** (`@plitzi/sdk-authoring`, `@plitzi/sdk-elements`): its declaration moved
  to `@plitzi/sdk-elements` beside the others, so it has a factory — `plitziSdk({ id, bind: { offlineData: 'view.data'
} })` —, its attributes typed, and `plitzi explain` knows it.
- **A binding may write part of an attribute** (`@plitzi/sdk-authoring`): `offlineData.schema` writes into
  `offlineData`, as the runtime always did; authoring refused it as an attribute nothing reads.
- **`choosesChildren`** (`@plitzi/sdk-shared`, `@plitzi/sdk-authoring`): a plugin that shows only some of the elements
  put inside it — a dashboard's panels, a wizard's step — says so in its declaration, and the page checks owe none of
  them on screen; what it draws is still read by the checks of the whole page (images, sideways scroll, legibility).
  `verify` was red on every such page.

## MCP

- **`@plitzi/sdk-mcp/render`** (`@plitzi/sdk-mcp`): `plitzi_render`'s widget render on its own — no MCP server, no SSR,
  no OAuth — for a project whose own agent draws in its own pages: `render`, `renderWidgetShape` to declare it as a
  tool, `renderGuideText` for the agent. `base`, the style of the project's space, brings its tokens, classes and fonts
  to the widget.

## Server

- **`publicUrl` says where people reach the server** (`@plitzi/sdk-server`): it was `http://127.0.0.1:<port>` whatever
  the server was. It is `https` once `serverOptions.tls` gives it a certificate, and this machine's network address
  with `HOST` open to the network (what a tablet opens, what an OAuth provider sends it back to); `PUBLIC_URL` still
  wins. The network addresses it prints say `https` too.
- **A server serving TLS reaches itself** (`@plitzi/sdk-server`): with a local certificate (mkcert) Node trusts nothing
  the browsers were told to, so a runtime calling its own MCP failed. Its requests to its own address now connect to its
  listener and are taken when it presents exactly its certificate (`reachOwnServer`, exported from `/runtime`).
- **A runtime reads compressed answers again** (`@plitzi/sdk-server`): the dispatcher `reachOwnServer` (and the
  platform's `reachSpaceInside`) installs reached every other host with an undici connector that offers HTTP/2, and an
  answer that came back over h2 reached Node's `fetch` without its `content-encoding` — every API that compresses read
  as Brotli bytes. Other hosts are reached over HTTP/1.1 now, as Node's own `fetch` reaches them.
- **A project's server serves HTTPS from `.env`** (`@plitzi/sdk-server`, `@plitzi/sdk-shared`): `TLS_CERT` and
  `TLS_KEY`, the certificate's and the key's paths — what `plitzi cert` writes — with no code of the project's;
  `serverOptions.tls` still wins. A network address the certificate does not name is said at boot, the machine's
  `.local` name is printed among the addresses when it is named, and a server on loopback alone says how to open it to
  the network.
- **A session survives a phone on the Wi-Fi** (`@plitzi/sdk-server`): a private network address (`192.168.…`, `10.…`,
  Tailscale's `100.64/10`, IPv6 unique- and link-local) and a machine's mDNS name (`studio.local`) get the local
  cookie profile — `SameSite=Lax`, no `Secure`, no `Domain`. They got `SameSite=None; Secure`, which a browser drops
  over http: nobody could sign in from a tablet. A deployment's own `.local` sub-domains (`app.example.local`) keep the
  strict profile.
- **Hiding the dev tools on a server over HTTPS hydrates** (`@plitzi/sdk-server`): a server with a certificate speaks
  HTTP/2, which sends no `Host` — only `:authority` — and the cookies named for the origin's port (the dev tools'
  `plitzi_debug_<port>`, forced flags, painted state) were looked for without it. Shift+F12 hid the dev tools in the
  browser, the server rendered them back, and the page failed to hydrate. Every one is read off `requestAuthority`.
- **A rebuild of plugins says it finished** (`@plitzi/sdk-server`): bundles removed under a running server (`tmp/`
  deleted) were each a warning, "rebuilding…", and their "ready" at a level a project's terminal does not show. It is
  one episode now: said when noticed, and again when the last is built — how many, how long, which failed.
- **`tmp/dev-server.json` records the scheme** (`@plitzi/sdk-server`): `url` is `https` with a certificate, and the
  file adds the network addresses and the `publicUrl`.
- **`public/` is asked about every time** (`@plitzi/sdk-server`): it was cached for an hour — a `.js` or `.css` in it
  for a year, `immutable` — so a file a project rewrites while it runs arrived stale. It is `no-cache` now, answered
  `304` by its `ETag` while unchanged; `immutable` stays for what is versioned (the SDK, the plugins).

## CLI

- **`check`, `shot`, `verify` and `visual` find a server on HTTPS** (`@plitzi/cli`): they rebuilt
  `http://127.0.0.1:<port>`, so a project serving a certificate had no page checked. They read the URL `npm start`
  recorded, and take a local certificate on this machine only. A project's `playwright.config.ts` comes from
  `plitzi upgrade`.
- **`verify` runs the project's tests** (`@plitzi/cli`): a step `test`, after the lint, when `package.json` has a
  `test` script.
- **`tsconfig.json` is the project's** (`@plitzi/cli`): the compiler options moved to `plitzi/tsconfig.base.json`, which
  the CLI keeps up and `tsconfig.json` extends — so a folder of the project's own (`scripts/`, `tools/`) goes in its
  `include` without changing a file of the CLI's. `plitzi doctor --fix` makes an older `tsconfig.json` extend it,
  keeping only the options the project changed.
- **`doctor --fix` and `upgrade` write as the project's Prettier does** (`@plitzi/cli`): a repaired `tsconfig.json` or
  `package.json` left `verify`'s format step red.
- **`upgrade` renames `usePlitziServiceContext`** (`@plitzi/cli`): with `PlitziServiceProvider` and
  `PlitziServiceContextValue`, renamed in 0.38.12 with no alias — import, use and the module path that named it.
- **`skills update` compares every file** (`@plitzi/cli`): only `SKILL.md` was, so a change in a reference alone was
  "up to date".
- **`NOTES.md`, the project's notes for agents** (`@plitzi/cli`): `AGENTS.md` and `CLAUDE.md` are the CLI's and
  `upgrade` replaces them, so what a project's own sessions had to know had nowhere to live. `CLAUDE.md` imports
  `NOTES.md`, `AGENTS.md` sends every agent to it, and nothing the CLI does touches it; `doctor --fix` writes one for
  a project that has none.

- **`start:dev-inspect`** (`@plitzi/cli`): a server project's `start:dev` with Node's inspector open on
  127.0.0.1:9229, so a debugger (VS Code, `chrome://inspect`) attaches to the server, and again after each restart.
  `plitzi upgrade` adds it; `plitzi runtime add` has it restart on the runtime too.
- **`plitzi cert`** (`@plitzi/cli`): HTTPS while developing, for a phone or a tablet on the Wi-Fi — over http its
  browser gives a page no microphone, camera or clipboard. A certificate from mkcert's local authority for this machine,
  its network addresses and its `.local` name, in `tmp/tls/`, named in `.env`; what to install on the phone, said.
- **A browser project opens to the network** (`@plitzi/cli`): its `vite.config.ts` reads `HOST`, `TLS_CERT` and
  `TLS_KEY` from `.env`, as a server project does, and writes `tmp/dev-server.json` — the port Vite took and the scheme
  — so `page check`, `page shot` and `visual` find it on another port or over HTTPS. `plitzi upgrade` brings it.

## Docs

- **Two plugins share through `state`** (`@plitzi/sdk-authoring` skill): each plugin is a bundle of its own, so a module
  both import is two copies, and what one keeps there the other never sees.
- **`verify --help`** names the project's tests among its steps.
