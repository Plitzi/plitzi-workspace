---
'@plitzi/cli': patch
---

A server action's call whose answer was lost on the way back runs once, not twice, and authoring says what a page
weighs on a phone — and what of it a phone cannot hold.

## SDK

- A server action's call is sent with one key from its first try: a connection lost after a worker began the run — the
  request went out, the answer never came back — is kept for later under that same key, so the run it began answers
  for it (or refuses it while it still runs). Kept under a key of its own, it ran a second time. A key the call names
  is still its own.

## Authoring

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
  (`slug: '*'`) with a **404** badge — of the space, or of its folder —, and the page menu's **Use as 404 page** makes
  another page it, giving the old one a slug of its name back (both said before and after). One per place — the space,
  or one folder: typing `*` in a page's slug, moving a 404 page into a folder, or dragging it there in the sitemap where
  one already is, is refused, saying which page it is and how to swap them. Its settings say what it is, on the Page
  section's header too.

- **Space check** (the issues button's list) reads in tabs — Errors, Warnings, Suggestions, each counted — and, in each,
  a line per code, folded, with how many and what they save: the fix is said once per code, a long message is cut to
  three lines until asked for, and its code is set apart. Only the list scrolls; the tabs and *Fix automatically* stay.
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

## Authoring and the 404 page

- `not-found-twice`, refused: two pages answering every address nothing else does (`slug: '*'`) in the same place — the
  space, or one folder —, which left the router to pick one. A folder's answers its own addresses, the space's the rest.
  `@plitzi/sdk-shared/navigation` says which page is a place's 404 (`notFoundPageIn`, `isNotFoundPage`) and a free slug
  for one that stops being it (`freeSlugFor`).
