---
'@plitzi/cli': patch
---

A/B tests and audiences: an element that shows each visitor one of its variants, by chance or by rules; a run's single-flight key never
outlives its lifetime; a queue's jobs set aside are resumed at once.

## Elements

- **Variants: A/B tests and audiences in one element.** `variants` — in the builder's new **Testing** category — shows each
  visitor one of its `variantItem`s, chosen **by chance** (`chooseBy: 'chance'`, the default) or **by rules**
  (`'rules'`). By chance it holds two to five variants, A first, drawn by their `weight`s (0–100 each, against the
  others'); its `experiment` names the test — left empty, the element's id does, so a test runs as soon as it is
  placed — and the visitor's variant is kept under it in a cookie (`plitzi_ab`), so a reload or a later visit shows the
  same and a visitor keeps theirs when the shares change. A variant at 0 is shown to nobody; one left with a share ends
  the test for everybody; two with one name share it. `{{ experiments.<name> }}` — a new global source — reads
  `'a'`, `'b'`… The page server draws the variant and sends the cookie with the page; the browser hydrates with what it
  drew and draws only what no server did. Each variant keeps its share and its rule whichever way it chooses, so
  switching loses neither. Its settings list the variants — with each share and the percent it makes, or each rule in
  words — the one the canvas shows (`builderVariant`, a place from 0), and add, select and remove one. Authoring writes
  `variants()` / `variantItem()`; the linter says `variants-choose-by`, `variants-items`, `variants-builder-variant`,
  `experiment-name`, `experiment-weight`, `experiment-weights-differ` and `experiment-unknown`.
- **A tester forces a variant** where debugging is authorized: the dev tools' new **Experiments** tab, or
  `?ab=heroTest:b` in the address, kept for the visit in a session cookie of its own (`plitzi_ab_qa`) — shown over the
  visitor's variant, never kept as theirs. The server draws it (`forcedExperiments`), never keeps that page, and a
  forced experiment the space does not run is ignored and said in the console.
- **Gradual rollouts.** A flag takes `rollout: { percent, value }`: when none of its rules matches, `percent` of the
  visitors get `value`, the rest its own. Each visitor keeps their place (0–99, a `plitzi_rollout` cookie), so raising
  the percent keeps everyone who was in. The page server, the browser (the `flags` source and the router), the server
  data and a server action all resolve with the same places; the builder's Feature Flags panel, `upsertFlag` and
  authoring write it, and `flag-rollout` refuses a malformed one.
- **Audiences.** A Variants element by rules shows each visitor the first variant whose rule (`when`) they match: what a flag's
  rules see, `utm_*` query parameters included, and the visitor's facts — `visitor.returning`, `visitor.language`,
  `visitor.device`. A variant with no rule is for everybody else. The page server reads the facts off the request and
  the browser hydrates with them; a page it drew is cached apart by the facts its rules read, only for a space whose
  Variants elements read any. The linter says `variants-rule`, `variants-unreachable` and `variants-no-fallback`.
- **Time windows.** `timeWindow` shows what it holds only between `startsAt` and `endsAt` (ISO 8601 with the offset;
  either empty is no bound): drawn by the server at the instant it renders, which the browser hydrates at, then shown or
  hidden when the window opens or closes. Authoring writes `timeWindow()`; the linter says `time-window-bound` and
  `time-window-empty`.
- **Measuring A/B tests.** Each visitor's variant is reported once to the space's analytics as `$experiment`, when it
  is drawn (the server says what it drew, `drawnExperiments`); the new `reachGoal` step (`reachGoal('signup')` in
  authoring) reports a conversion, `$goal`, with the visitor's variants. `exposureOf` and `goalOf` read them; in the
  builder the step says what a visitor's page would count.
- **Trying them in the builder.** While editing, a Variants element shows the variant its settings pick; the canvas's preview
  shows the page to the visitor chosen in the State Manager's Visitor tab — the device (by default as the canvas is
  sized), the language, returning or not, the variant of each Variants element by chance and the date time windows are read at.
- **Variants are never offered as a list or a component.** `repeated-shape` took the variants of a
  Variants element (and what each holds alike) for rows of data — a list it cannot hold — or for one component: they are
  versions of one place, edited variant by variant. `suggestSpace` knows the built-in parts as `authorSpace` does.
- **A closed time window, and a Variants element with no variant for the visitor, take no room.** They kept an empty box,
  which a column's gap spaced the content around: now hidden as a hidden element is, their node kept to open in place.
- **The builder goes back to the space it was opened for.** Its menu's **Back to the space** opens the space's console
  (`/spaces/<its address name>`), not the list of every space; **Domains and targets** names it the same way.
- **A rule written in code shows in the builder.** Every rule editor — a variant's, a flag's, a step's or a binding's
  `when` — drew an empty group for a rule with no ids, as any authored in code, by an agent or in a seed is: it is shown
  and edited now (`@plitzi/plitzi-ui` 1.6.41).
- **The canvas says who the preview is shown to, and reloads like a browser.** Its address bar shows the simulated
  visitor — language, device, first visit or returning, who is signed in, the date when one is chosen. Its choices are
  one panel in tabs — Visitor, Variants (every Variants element of the page: by chance the variant picked, by rules
  the one this visitor matches, each rule in words), Flags (each on or off for the visitor and why, forced Auto/On/Off),
  Date (and every time window of the page, shown or hidden at it) and URL — docked right of the canvas where there is
  room, under the address bar's button else. In the preview a reload button loads the page
  again as F5 does: what it set for this visit is emptied, what the space keeps between visits stays, and its loads and
  first flows run once more.
- **A test drawn in the preview, as a visitor's page draws it.** A test by chance set to **Draw** in the preview's
  Variants tab is drawn by its shares: **Reload** keeps the variant, as a visitor's cookie does, and **New visitor**
  (beside it, and in the canvas's address bar) is a first visit — nothing kept, every test set to Draw drawn again — so
  reloading as new visitors shows each variant in its share.
- **A test's shares are percents that add up to 100.** Each variant's `weight` is the percent of the visitors it is
  shown to — 50/25/20/5, any split. The Variants panel shows the total, says when it is not 100% and fits the shares to
  it keeping their proportions (`sharesToHundred`), and "Even shares" splits exactly (34/33/33); authoring, the MCP and
  the builder warn of shares that do not add up (`experiment-weights-total`). Until they do, each is drawn as its part
  of their total.
- **Layers says which variant is on screen.** Under a Variants element each variant reads which it is — A, B… or 1,
  2… — and the one the canvas shows while editing has its icon lit and "on screen" beside it; the others are faded.
- **Element settings say what they are.** The Settings tab's duplicate "Settings" heading is now the element's name
  over its own fields, and the flag gate every element has reads "Feature flag (optional) — None, not tied to a flag"
  rather than "Always rendered", which read as a flag in use.
- **The builder's catalogue says which element is a part of another.** An element that only works inside another
  (`ancestorType`: a Variants element's variant, a carousel's track) is listed right after it, its icon drawn as a piece and "in
  Variants" under its name. A plugin says it the same way — `ancestorType` in its declaration,
  carried by `plitzi plugin pack` into its manifest. Every control the builder draws shows the pointer.
- **A page server's HTML cache is keyed by the visitor's variants**, and a page that drew a visitor theirs is never
  kept: the next visitor with none is drawn their own.

## Server actions

- **A single-flight key is taken with its lifetime in one write.** The run guards took it with `increment` and gave it
  its lifetime with an `expire` after: a store that failed the second — a Redis timing out through a rollout — kept the
  key for good, and every later run of that action with that input was refused as "already running" while nothing ran.
  A scheduled job came back to the queue every second or two for as long ("Waiting for the same run to finish"), with
  no run anywhere to wait for. The key is now written with `swap` — only where nothing holds it, with the run's lifetime,
  at once — and holds the run's id. `RunKeyStore` is `get`, `set`, `swap` and `delete` of `ActionKvAdapter`.

- **A queue's jobs set aside are resumed at once.** `JobQueue.resumeWaiting({ spaceIds, kind?, name? })` puts every
  `paused` job of those spaces back in the queue — narrowed to actions or the functions' jobs, to one action or job — as
  `resume` puts one, each set aside after failing every attempt with every attempt again, and answers how many, with
  the functions' jobs among them. A group of a schedule's runs set aside (`listJobGroups`) was resumed a job at a time:
  the latest alone, while the row went on saying the rest. `createJobControl` offers it too, and tells whoever watches
  a job of the functions that it is back.

## To do when you upgrade

- A server or a proxy that caches pages of its own in front of `@plitzi/sdk-server` keys them by the `plitzi_ab` and
  `plitzi_rollout` cookies as well (`…_<port>` on a port), and never keeps a response that sets one — or every visitor
  behind the first is shown the first one's variant of an A/B test, or their place in a rollout.

- A key left without a lifetime by a version before this one is not freed by it: find the deployment's single-flight
  keys with no lifetime (`action:run:<space>:<action>:…`, in Redis `TTL` answers `-1`) and delete them.
- A job store of your own (`JobQueue`) needs `resumeWaiting`: one statement that sets the matching `paused` jobs
  `pending`, as `resume` does one. The stores of `@plitzi/sdk-actions` (memory, file, SQLite, Mongo, MySQL) have it.
