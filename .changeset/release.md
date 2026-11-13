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
  down whole, and a space written mobile first are never named.

## Builder

- The page tree marks what a visitor may not open: a lock beside a page only for signed-in visitors or for some
  permissions, saying which (and when it answers everyone else with a 404), and beside a folder all of whose pages are —
  fainter, with how many, when only some are. Read by the rule the server withholds pages with (`protectedAccessOf`,
  `@plitzi/sdk-shared/schema`), so the lock and what a visitor is sent never disagree.
