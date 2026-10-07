---
'@plitzi/sdk-server': patch
'@plitzi/cli': patch
'@plitzi/sdk-shared': patch
'@plitzi/sdk-authoring': patch
'@plitzi/sdk-elements': patch
'@plitzi/sdk-navigation': patch
'@plitzi/plitzi-sdk': patch
'@plitzi/plitzi-builder': patch
'@plitzi/sdk-dev-tools': patch
---

- **`unusedPort()`** (`@plitzi/sdk-server`): a port the system has just handed out, for a test to listen on. The
  package's own tests and `@plitzi/sdk-mcp`'s listened on fixed ports in the ephemeral range (393xx), which any
  outgoing connection of a test running beside them could take: CI failed with `EADDRINUSE` on runs with nothing
  wrong. Every one now listens on a port the system gives it.
- **Brotli at quality 5** (`@plitzi/sdk-server`): `compression.brotliQuality`, for a page rendered for one request, is
  5 (was 2). At 2 a 220 KB page came out larger than gzip — 36 KB against 31 — and at 5 it is 29 KB, for the CPU gzip
  spends; on half a core ~0.1 ms a page.
- **`verify` checks the pages for signed-in visitors** (`@plitzi/cli`): a page that sends the browser to sign in is
  checked again signed in as the account `.env` names — `PLITZI_CHECK_USER`, `PLITZI_CHECK_PASSWORD` (the environment
  wins over `.env`). With none named, `verify` says how. `page check --as` reads the password from `.env` too, and
  `page check` takes several pages, in one browser.
- **An address that shows nothing answers 404** (`@plitzi/sdk-shared`, `@plitzi/plitzi-sdk`, `@plitzi/sdk-server`):
  one no page answers was sent to the home page with a 302 — every typo read as the home page. A page whose slug is
  `'*'` is now the space's page for it, sent with status 404 (a folder may have its own; the deepest wins), and a page
  gated off by a flag shows it too. Never kept in the page cache: an address asked for at random filled it. Only a slug
  that IS `'*'`: a page answering a subtree by its own (`spaces/:spaceId/update/*`) stays a page like any other.
- **`authorSpace` gives a space with no `'*'` page a plain one** (`@plitzi/sdk-authoring`), in the home page's layout,
  and says so: suggestion `not-found-page`. The project templates carry their own.
- **`notFound` on a server provider** (`@plitzi/sdk-elements`, `@plitzi/sdk-server`): an expression against its answer
  (`{{ source.found == false }}`); when it is true the page is sent with status 404, rendered as written. Refused on a
  browser provider (`not-found-in-browser`) and when it is not one expression (`not-found-not-a-template`).
- **`page check` and `verify` know a page sent with 404** (`@plitzi/cli`): it is said, not failed; the space's `'*'`
  page is checked at an address no page has, and fails if it is not sent with 404.
- **A form field draws no background of its own** (`@plitzi/sdk-elements`): the `<input>` inside a form control's box
  (`field`) took `background-color: inherit`, and painted a translucent box colour a second time — a darker box inside
  the padding (Tremor's search). It is `transparent`: the box shows through it.
- **`space lint` offers `quiet` only where there is an element to put it on** (`@plitzi/cli`): a suggestion about what
  the space lacks — `not-found-page` — is answered by writing it.
- **`feedback --previous`** (`@plitzi/cli`): the brief says what to do when an earlier report's link no longer opens —
  say so, and ask the person for the highest id it had.
- **`start:prod` runs in production by itself** (`@plitzi/cli`): `NODE_ENV=production node …`. Without the variable a
  deployed project was a development server — dev tools on, and every public action answering its `steps` and `trace`
  (each step's result, what the `output` was meant to leave out). `doctor` says a `start:prod` that does not
  (`start-prod-not-production`); `plitzi upgrade --write` rewrites the script.
- **A project's `ActionRefusal` reaches the flow** (`@plitzi/sdk-server`): a functions bundle carries its own copy of the
  class, so `instanceof` never knew it and the run lost its reason (`{{ x.error }}` empty). Told apart by name now.
- **Plugins are not remounted after hydration** (`@plitzi/sdk-elements`): the registry wrapped each plugin again when
  the host handed it over again, a new component type every time — the server's HTML thrown away, entrances replayed,
  effects run twice. Each plugin component is wrapped once.
- **`start:dev` survives a space that does not author** (`@plitzi/sdk-server`): a restart while the space had an error
  died, and fixing the space woke nothing. It comes up answering every page with what is wrong (503), and loads the
  space the first time a save authors.
- **`page check` sees what is cut off at the screen's edge** (`@plitzi/sdk-authoring`, `@plitzi/cli`): a link or words an
  ancestor hides past the viewport, which no sideways scroll shows (`cut-off`).
- **`page shot --click <element...> --sheet`** (`@plitzi/cli`): elements clicked in order — a name or a CSS selector,
  inside a plugin too — pictured after each (`--frames`/`--every`), with how much changed, and every picture on one
  contact sheet. The dev tools' badge is no longer in a picture: its shadow root is marked (`@plitzi/sdk-dev-tools`).
- **`formControl` is optional unless it says `required: true`** (`@plitzi/sdk-elements`), as an HTML field is. A field
  left without `required` in an older space was required, and is not now.
- **`text({ decorative })`, `list({ label })`** (`@plitzi/sdk-elements`); **`writing-mode`, `text-orientation`** in the
  CSS vocabulary (`@plitzi/sdk-shared`).
- **`unused-token` reads the plugins' stylesheets** (`@plitzi/sdk-authoring`): `authorSpace`'s `stylesheets`, which
  `projectAuthoring` fills with every `.css` under `src/plugins/` — a token only a plugin used was said to be unused.
- **`id-taken` on a provider placed on two pages points at the layout they share** (`@plitzi/sdk-authoring`), not at
  `scope()`, which renamed its source and every template reading it.
- **The welcome template's tokens keep their names** (`@plitzi/sdk-authoring`): `satisfies`, not an annotation, so
  `tokens(variables).card` typechecks as the cheatsheet teaches.

