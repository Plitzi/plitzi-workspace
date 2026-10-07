---
'@plitzi/sdk-server': patch
'@plitzi/cli': patch
'@plitzi/sdk-shared': patch
'@plitzi/sdk-authoring': patch
'@plitzi/sdk-elements': patch
'@plitzi/sdk-navigation': patch
'@plitzi/plitzi-sdk': patch
'@plitzi/plitzi-builder': patch
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
