---
'@plitzi/cli': patch
---

A server action's call whose answer was lost on the way back runs once, not twice, and authoring says what a page
weighs on a phone — and what of it a phone cannot hold.

## CLI

- `plitzi space snapshot` prints the snapshot's preview address, to look at it before any domain serves it.
- `plitzi space targets | deploy <domain> [--follow] [--redeploy] | deploys [domain] | download <deploy>`, and
  `space publish --deploy | --at <moment>` (RFC 0034): where each domain's site is — Plitzi, or a copy on GitHub Pages,
  AWS, Cloudflare, Netlify, Vercel, FTP, a zip or a server of your own — a copy deployed again and followed to its end
  (exit 1 when it failed), its deploys, a kept one's site as a zip, a publish with its deploy or set for later.
- `plitzi space snapshot`, `space publish <domain>`, `space rollback <domain> [--to production@9]` and `space releases
[domain]` (RFC 0034): the builder's Snapshot and Publish for a terminal, a CI job or an agent — what each domain
  serves, what a rollback would put back, a domain's history — held on the platform to the same rules, `--json` for a
  tool.

## Page server

- `wildcardSubdomain`'s `find` may answer a sub-domain's `credential`: a password its owner put on the address is asked
  by the basic-auth stage, as on a domain of its own. A space's address on the spaces' domain resolves by its sub-domain
  before any row is read, so a password set on it was never asked — the draft stayed open to everybody.

- `@plitzi/sdk-server/deploy` (RFC 0034): a space's site built and shipped wherever it is served. `buildSpaShell` — an
  `index.html` that names its environment and never a revision, with the SDK and React carried beside it under a folder
  named by their digest (no third-party CDN at run time) — and `buildStaticSite`, every page a page server draws, followed
  link by link, kept as HTML with the files it loads, a route with parameters no page reaches reported by name. Each
  build's fingerprint is said part by part (`fingerprintChanges`: the SDK, the fonts, the key…), and its versions
  (`buildVersions`). Uploaders: `s3Uploader` (AWS, R2 or any storage that speaks S3, signed with SigV4 — no AWS SDK —
  and switched in one step behind CloudFront by a prefix per deploy), `ftpUploader` (FTP and FTPS), `folderUploader`;
  `zipFiles` / `unzipFiles` for a site as one zip.
- `renderGrant({ served })`: a page that names no revision is answered the one its own domain (`Origin`) is published at.
- `createCloudAdapters({ domain })`: a server of your own serves the revision its domain is published at, says what it
  is (`x-plitzi-client: sdkServer/<version>`, judged as every client of the platform is), says once when Plitzi is
  newer, and logs the platform's own words when it is refused.
- `snapshotPreview({ suffix, keyOf, find })` and `previewLabel(name, snapshot, key)` (`@plitzi/sdk-server/spaces`): a
  snapshot served at an address of its own, `<name>--r12-production-<space>-<key>.<suffix>`, its key the deployment's
  secret for that snapshot — a wrong one is the 404 of a space that does not exist. A resolution may say `noindex`:
  every page on it answers `X-Robots-Tag: noindex, nofollow`, and its `/robots.txt` disallows everything.

## MCP

- `plitzi_publish { deploy }` deploys a copy a provider holds when the revision needs one (refused with why otherwise),
  answering the deploy it queued; `plitzi_releases` says where each domain's site is and what it asks.

- `plitzi_releases`, `plitzi_publish` and `plitzi_rollback`: what each domain serves and its history, a publish and a
  rollback, for the member the agent acts for and held to that member's right to publish; a refusal is answered as
  `{ done: false, reason }`. A host offers them through the `releases` adapter (`@plitzi/sdk-kernel`); the tool listing's
  budget grew to 84.2k for them.

## SDK

- A server action's call is sent with one key from its first try: a connection lost after a worker began the run — the
  request went out, the answer never came back — is kept for later under that same key, so the run it began answers
  for it (or refuses it while it still runs). Kept under a key of its own, it ran a second time. A key the call names
  is still its own.
- A template that is a literal word alone — `{{ null }}`, `{{ false }}`, `{{ true }}` — is that value: read as a name
  nobody set, it reached a step param or a binding as an empty string, so a `json` setState given `{{ null }}` to empty
  a key failed to parse. Written as text, each reads as a variable holding it does (`false`, `true`, nothing).

## Authoring

- A tab of a `tabContainer` takes `hash`: a link to the page ending in `#domains` opens on that tab, and choosing the
  tab writes it in the address — replaced, so Back leaves the page rather than the tab. A page the server drew opens on
  it before it paints, and hydrates there: no flash of the first tab.
- `usePrePaint(name, script, enabled?)` (`@plitzi/sdk-shared/hooks`): an element that draws by what only the browser
  knows — the address's hash — asks the page to run its script as soon as it is parsed, before it paints. The server
  render collects what was asked (`SSRRenderResult.prePaint`, once per name) and the page server writes each under the
  page's nonce, whole or streamed; in the browser it asks nothing. A tab with a `hash` is its first user.
- An attribute an element does not read, on an element that reads none, says so (`It reads no attribute: remove it.`)
  instead of an empty list.

- `many-elements`, a suggestion: a page that builds more than 1,500 elements as it opens — its own, its layouts' and its
  components' once per instance — says how many and whose, and what a visit downloads for them (and 10,000 of them,
  before compression). What starts hidden with `loadStrategy` `lazy` or `visible` is not counted, and what starts hidden
  until a click (`visible: false`) and is built all the same is named, with the `lazy` that defers it. Generous on
  purpose: a rich page is a choice, said once and quieted with why (`quiet: ['many-elements']`).
- `heavy-layout`, a suggestion: a layout whose own part of the document passes 250 KB, with how many pages are
  downloaded with it. `heavy-page` now says what 10,000 visits move for the page, too.
- `desktop-only`, a suggestion: a page, layout or component styled for the desktop alone where a phone breaks — a width
  past 480 px no `max-width` holds, a grid whose fixed columns and gaps are wider than a phone or whose shared columns a
  phone squeezes under 120 px, type past 64 px — that no `mobile` rule sets again, by the class that says it. A layout
  fluid on its own, a row whose one column grows, a dense widget's thin columns, what a `mobile` rule hides or scales
  down whole, a grid a `mobile` rule lays out otherwise (a table's row stacked with `display: flex`), a width inside a
  box that clips or scrolls it sideways (`overflow-x: auto` round a table, `hidden` round a hero's glow), and a space
  written mobile first are never named.

## Authoring and the builder say the same

- Authoring is the one source of what a space is warned of: the checks it made of a spec alone are now read off the
  documents, so `validateSpace` — and with it the builder's Space Issues and the MCP — says them too.
  `tablet-rule-skips-mobile` (which no longer names a grid's own properties on a phone that is not a grid there),
  `unknown-variant` (an element's own variant and one an `activeWhen` sets, with the plugin's or the hosted component's
  hint) and `transient-`, `kept-`, `painted-` and `browser-state-without-keep-state` were said by `authorSpace` alone.
- `AUTHORING_ONLY_CODES`: the few codes only `authorSpace` can say, each with why in its row of
  `authoring-errors.md` (`plugin-attribute-reserved` reads the plugin's own declaration, `not-found-page` that the
  page was added, `class-overrides-class` the shorthand a rule was written with). Every other code is said the same by both — a consumer holds itself to it
  by comparing the two with these left out.
- `pluginTypesOf(types)` (`@plitzi/sdk-authoring`): a space's installed plugins as the element types the linter reads,
  in both their spellings — what `authorSpace` passes, for a host that lints a stored space.
- `pluginStylesheets(plugins)` (`@plitzi/sdk-mcp/server`): the stylesheets a space's installed plugins publish, cached,
  so a token only a plugin's CSS reads is not said unused (`unused-token`).
- A suggestion is quieted on the one element every element it is about sits in, too: copies side by side said alike on
  purpose once, on their row (`quiet: ['repeated-shape']` on a plan picker's options), not on each copy. A quiet written
  there was read by nothing before.

## Builder

- **Publish, for somebody who has never done it.** It opens on the space's own address — live with every save, nothing to
  publish there, only who may see it — then the domains, each saying what it shows now, or one not connected yet. What
  a domain should show is three answers: **your latest changes**, kept as a version on the way (no Snapshot needed
  first, and an unchanged draft publishes the version it already is); **a version you kept**; or **every change, as you
  save it**. Who may see it is beside it, and one block says what the domain will show instead of what and what visitors
  will see change. Scheduling is a button of its own. Publish opens the sheet on every plan — it sent a free space to the
  plans although its site was already live.

- **A credential starts with what it signs in to.** A new one is chosen from cards — APIs and content, storage, deploys,
  email, site access — each saying what it is for; then that provider's own fields, named as the provider names them,
  with where it issues one and with what permissions beside them, and a link to that page. A secret is typed unseen and
  can be shown to check a paste; a value of the wrong shape (an R2 key that is not 32 hexadecimal characters, a signed
  token pasted as a key) is said at its field, by the same rule the platform refuses a save with. An API's or a CMS's
  credential is a list of named values instead of JSON. The list labels every kind, deploy credentials too, and a
  domain's password is called a **Site password**. The kinds are one list in `@plitzi/sdk-shared/credentials`.

- The draft's status and **Snapshot** are one control, as **Publish** and its menu are; the account group's parts sit
  evenly inside it (3 px all round), so a hovered one no longer leans to a side. **Domains and targets** opens the
  console on the space's Domains tab.

- **Where a domain's site is, and its deploys** (RFC 0034, F2–F4). The publish sheet lists every domain as a target —
  Plitzi, or a copy on a provider as a single-page app, prerendered or a server of your own — with what it serves and what
  it asks (a deploy that failed, newer versions out, a plan that dropped it). It says what a publish will do before it
  does — whether the copy needs a deploy and why, what runs on Plitzi — and its button becomes the deploy too; pressed, it
  follows the deploy's steps and log, and a deploy can be stopped. A target's settings choose its mode and provider from
  the platform's list, sign in with a credential of the space (GitHub, Cloudflare, Netlify, Vercel, FTP, now kinds of
  the credential form) or a bucket of its CDN, protect it — only whoever manages the space moves it — and make its deploy
  hook. A publish can be set for later, in your own time.
- **The draft has a panel of its own.** Its chip opens what it is against the last snapshot and what changed, where it is
  live as it is saved and what the targets ask, with Snapshot as its next step — no longer a second way into Publish,
  which is a split button whose menu rolls each domain back, opens the history, and the console's domains.
- **A snapshot's preview** (RFC 0034 §14.6): each revision in the publish sheet has **Preview** beside it — the snapshot
  at an address of its own, as a visitor would see it, before any domain serves it. Only whoever has the link opens it,
  and it is never indexed.
- **Releases and rollback** (RFC 0034, F1). Every publish and rollback of a domain is recorded — what it serves from
  then on, what it served before, who — and the publish sheet lists a domain's history, with **Serve this again** on
  each release and **Roll back to rN** at its foot and beside the outcome: a rollback asks first, naming what it puts
  back and what it does not undo (feature flags, the space's data), and is never refused by plan.
- **Snapshot and Publish, redrawn** (RFC 0034, F0). The header's end is one release cluster: a chip that says how far
  the draft has moved since the last snapshot ("4 changes since production r12"), **Snapshot**, and **Publish** — its
  one primary; the logo's chevron is a real menu — back to the spaces, **Export**, the theme — and the quota, plan and role read as one group.
  **Make a snapshot** chooses its environment on a segmented control (each with its latest revision; a locked one
  outlined with its plan, never a bright tile), says what changes against that environment's latest, asks what it is
  for, shows only the notices that apply, and offers **Snapshot and publish…**. **Publish** opens beside the page:
  the domains, each with what it serves now; the environment and the revision, each snapshot with its words, who
  made it and where it is live; what changes on that domain; then one action, and the outcome in the sheet itself.
  Cancel no longer weighs what the action does.
- The page tree marks what a visitor may not open: a lock beside a page only for signed-in visitors or for some
  permissions, saying which (and when it answers everyone else with a 404), and beside a folder all of whose pages are —
  fainter, with how many, when only some are. Read by the rule the server withholds pages with (`protectedAccessOf`,
  `@plitzi/sdk-shared/schema`), so the lock and what a visitor is sent never disagree.
- A page's settings are four sections — **Page** open, **Access**, **Scroll** and **Search & sharing** closed, each
  header saying what it holds (`Signed-in visitors · 404 to others`, `Locked`, the SEO title), a restricted page's in
  the accent — where they were one column of every field with a notice under each, longer than the panel. Every field
  is where it was, one click away; each section's notices are one line about the state it is in, and the search and
  share previews sit in a section of their own. The sections are `SettingsSection`, for other elements' settings too.
- The 404 page is said and set in the builder: the Pages tree marks the page of every address no other page answers
  (`slug: '*'`) with an icon of its own, as the home page has — of the space, or of its folder, said in its title —,
  and the page menu's **Use as 404 page** makes another page it, giving the old one a slug of its name back (both said before and after). One per place — the space,
  or one folder: typing `*` in a page's slug, moving a 404 page into a folder, or dragging it there in the sitemap where
  one already is, is refused, saying which page it is and how to swap them. Its settings say what it is, on the Page
  section's header too.

- **Space check** (the issues button's list) reads in tabs — Errors, Warnings, Suggestions, each counted — and, in each,
  a line per code, folded, with how many and what they save: the fix is said once per code, a long message is cut to
  three lines until asked for, and its code is set apart. Only the list scrolls; the tabs and _Fix automatically_ stay.
  The modal is wider on a desktop.
- The **Components** area: a component unfolds to a preview of it — drawn as its first instance shows it, fitted to its
  size — and every place it is used, by page, each a link to the instance (a page of many folds them; the **Usages**
  panel's pages fold too). The one open in the canvas is marked **Editing**.
- A component edited on its own is drawn as one of its instances shows it: that instance's props over the defaults,
  on the ground it sits on (the nearest background and text colour around it, the page's layout's included). **Shown
  as** in the banner picks the instance. A component made for a dark band no longer opens on a blank white canvas.
- The **Style Manager**: a search and **New** on one line; **All**, **Classes**, **Elements** and **Unused** with their
  counts; the element types' defaults and the classes in sections; a row per selector — its kind, its name, how many
  elements wear it or that none does —, its box shown while several are checked; **Select all** among the unused to
  delete them at once. The selector picked is named over the inspector with what it dresses and the breakpoint edited.
  A long list is grouped by the prefix its classes share (`adm-…`, `lp-…`, the rest under **Other**), each folded until
  opened, and drawn by what is in view: 1,900 selectors list, pick and check at once.
- The space's issues are asked for once the save queue has stayed drained a moment (1.5 s), not after every save of an
  edit, and the server reads a big space's in half the time (`authorSpace`, `validateSpace` and `suggestSpace` too:
  the website's checks went from 720 ms to 350).
- An element's **classes** are a field: the type's defaults first, the classes after, **Add class…** always there,
  the Style Manager at its end. Focused, it lists the space's classes — **Create class** first for a new name — and the
  arrow keys move through them, Enter adding the one marked.

- The builder's colours are one system, in both schemes: every panel, window, modal, menu and field is painted with
  plitzi-ui's semantic tokens — the backdrop, the panels, what is raised, what floats above them, the fields, two
  lines and three levels of text, each readable (4.5:1 or more) on every ground. The dark scheme's panels, floating
  windows and modals were one colour, so nothing read as above anything; the light scheme's lists took their text
  colour from the page the builder was mounted in. Needs `@plitzi/plitzi-ui` with the `ui-*` tokens.

- The views that take the canvas' place — Server, Settings — use a wide screen: past 1,536 px the page is 1,280 wide,
  and each section's name stands in a column of its own beside what it holds, as a settings page reads.
- Assets' folders are rows of the panel, as Pages' are — no card each, their count in words' colour, an empty one
  marked in amber, the one a file is dragged over in the accent.

- The **State Manager** is the page's context, where it was a JSON box: **State** lists every key the space reads or
  writes — set or not yet — each edited as what it is (a toggle, a number, words, JSON), with how the settings keep it
  (kept, painted, browser, not kept) and the elements that read and write it, each a link; the keys the page holds
  that nothing names apart; the changes as the canvas runs, newest first; the whole as JSON still. **Visitor** shows
  the page to your session, a guest or one of the space's test accounts, and what the page reads of its visitor.
  **Address** is the URL the page is tried on. **Computed** lists the space's computed values and what each gives
  now. A case is saved by name — the state, the visitor and the address — and applied again in one choice; kept in
  the browser, never in the space.
- The **Usages** panel read only a bare token's sources: `{{ state.open ? 'a' : 'b' }}` read nothing. It reads every
  template's.

## Authoring and the 404 page

- `not-found-twice`, refused: two pages answering every address nothing else does (`slug: '*'`) in the same place — the
  space, or one folder —, which left the router to pick one. A folder's answers its own addresses, the space's the rest.
  `@plitzi/sdk-shared/navigation` says which page is a place's 404 (`notFoundPageIn`, `isNotFoundPage`) and a free slug
  for one that stops being it (`freeSlugFor`).
