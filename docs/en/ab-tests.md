# A/B tests, audiences, time windows and countdowns

A `variants` shows each visitor one of its variants — chosen **by chance** (an A/B test: each variant a share of the
visitors, and a visitor kept on theirs) or **by rules** (an audience: the first variant whose rule they match). This
page is how it works across the stack: the element, who draws a visitor's variant, where it is kept, what the page
server's cache does with it, and what the builder shows. How to write one is the authoring skill's (`feature-flags.md` §
Variants); the element's attributes are its declaration's (`packages/sdk-elements/src/elements/structure/Variants`).

## The element

`variants` holds `variantItem`s. By chance it holds two to five — the first is A (the control), then B, C, D, E by their
place; by rules, one at least, the last with no rule for everybody else.

| Attribute | On | What it is |
|-----------|----|------------|
| `chooseBy` | `variants` | `'chance'` (the default) or `'rules'`. |
| `experiment` | `variants` | By chance, the test's name: what a visitor's variant is kept under, and what `{{ experiments.<name> }}` reads. Empty, the element's id made a name (`pricing-test` runs `pricing_test`), so a test runs as soon as it is placed. |
| `builderVariant` | `variants` | The place (from 0) of the variant the builder's canvas shows while editing. Never a visitor's. |
| `weight` | `variantItem` | By chance, the percent of the visitors it is shown to (default 50); the variants' add up to 100 — 50/25/20/5, any split. 0 shows it to nobody. Shares that do not add up to 100 are drawn in proportion, and warned of. |
| `when` | `variantItem` | By rules, the visitors it is for: a rule group. None is everybody else. |

A variant keeps both its `weight` and its `when` whichever way it chooses, so switching loses neither. Only the
variant a visitor is shown is drawn — the others are absent, not hidden: their providers ask for nothing and their
words are not in the page; a visitor no variant is for (by rules, with no "everyone else") sees nothing, and the element
takes no room. Two Variants elements with the same `experiment` share it: a visitor sees the same variant of both (a headline and
the button under it), and the first one met gives the weights.

Its category in the builder is **Structure** (`market.category: 'structure'`), beside `timeWindow`: both show one part
of a page or another by a condition, and by rules a `variants` is personalisation as much as a test. Its settings list its variants — by chance with each share and the percent it makes, by rules with each
rule in words — with the one the canvas shows, and the way to add, select and remove one. `plitzi_render`'s offline
widgets leave it out (by type — the rest of Structure is theirs): a widget in a chat has no visit of a site to
choose by.

## Who draws a visitor's variant

One function decides, in `@plitzi/sdk-shared/experiments`, for both the server and the browser:
`assignExperiments(declared, kept, random)`. For each experiment the space runs (`declaredExperiments`, read off every
`variants` chosen by chance on its pages and in its components):

1. an experiment with one variant left with a weight is ended: everybody sees it (A when none has any), and nothing is
   kept;
2. a variant the visitor kept is theirs while it still has a weight, whatever the weights are now — what they were
   shown is what their visit is measured on;
3. otherwise one is drawn in proportion to the weights — a visitor whose variant was taken out (weight 0) too.

**The page server draws first** (`requestExperiments`, `apps/server/src/helpers/experiments.ts`, called by
`prepareRender`). It reads every experiment in the space, not only the page's, so a visitor who moves on in the browser
finds their variants already kept. The page is drawn with them, the browser is handed them (`serverExperiments`, in the
render's props and the hydration payload), and what was drawn just now goes back as a `Set-Cookie` with the page —
sent by `handler.tsx` and `streamBody.tsx` before the first byte.

**The browser hydrates with the server's variants** and never draws its own over them: a page hydrated with another
variant would be thrown away and drawn again. `useExperiments` (`sdk-elements/src/dataSource`) takes the server's, then
the visitor's cookie, then draws what neither has — a space rendered with no server, a static copy at a provider — and
writes the cookie. It publishes the result as the `experiments` source (`runtime.sources.experiments`), which the
element and every template read.

A render nobody visits — a preview for a picture (`__pt`), a draft's unsaved edits — draws nothing and keeps nothing:
what the visitor has not kept is the first variant still shown (A, unless taken out), so every picture of the page is
the same.

## Where a variant is kept

A cookie, `plitzi_ab` (`plitzi_ab_<port>` on a port, as the flags a tester forces), holding `heroTest:b,pricing:c`,
for 180 days, `SameSite=Lax`, `Secure` on https, readable by the page. A cookie rather than web storage for the
theme's reason: the server draws the variant, so it has to know it before the page exists. One writer
(`experimentsCookie`) for the server's header and the browser's `document.cookie`.

## The page cache

A page draws only the variant each test shows its visitor, so the HTML cache is keyed by that cookie's raw value
(`buildHtmlCacheKey`): visitors who kept the same variants share a page. A render that drew a visitor anything is never
kept (`RenderPrep.cacheable`): the next visitor with no cookie must be drawn their own, not handed the first one's.
So the first page a visitor opens on a space with an A/B test is always rendered; the ones after it are served from
the cache like any other. A cache or a proxy in front of the page server has to do the same — the changeset says so.

## Forcing a variant

A tester shows any variant without being drawn it, on the flags' terms: only where debugging is authorized
(`authorizesDebugging`), the same rule the dev tools panel follows. The dev tools' **Experiments** tab lists each
experiment, the variant the page shows and each variant's share, and forces one; an address forces them too —
`?ab=heroTest:b,pricing:c` — and the SDK keeps what it forced for the rest of the visit. Both are kept in a session
cookie of their own, `plitzi_ab_qa` (`forcedExperimentsCookieName`), never in the visitor's: what a tester forced is
shown over their variant and never measured as theirs.

The server reads it in `requestExperiments` and hands it to the browser apart (`forcedExperiments`), so the page
hydrates the same; `useExperiments` applies it over the visitor's variants. A forced experiment the space does not run,
or a variant its test has not, is ignored and said in the console. A page drawn with forced variants is never kept,
and the HTML cache is keyed by that cookie, as by the flags a tester forces.

## Audiences

A `variants` chosen by rules shows each visitor the first `variantItem` whose `when` — a rule group, as a flag's — they
match; one with no conditions matches everybody, the "everyone else" it ends with. Its rules see what a flag's
do (`environment`, `hostname`, `routeParams.*`, `queryParams.*` — `utm_source` and the like —, `user.*`) and the
visitor's facts (`@plitzi/sdk-shared/audiences`): `visitor.returning` (first seen more than a visit — 30 minutes — ago,
by the `plitzi_seen` cookie the SDK writes once), `visitor.language` (the primary subtag of the first language asked
for) and `visitor.device` (`mobile`, `tablet`, `desktop`, by the `Sec-CH-UA-Mobile` hint or the user agent).

The page server reads the facts off the request (`requestVisitorFacts`) and hands them to the browser
(`serverVisitor`), which hydrates the variant drawn; with no server, the browser reads them itself, once per page
(`browserVisitorFacts`). Only the variant shown is drawn, found by its item (`childOfItem`) — a variant a flag switched
off is not among the children.

**The page cache.** A page an audience drew is kept apart by the facts its rules read — and only those, only for a
space whose Variants elements by rules read any (`audienceFactsUsed`). They are known before the cache is asked only from the space the
server holds already (the offline-data cache): the handler sets `ctx.audienceKey`, which the HTML key carries. Asked
before the space was held, a page an audience drew is kept for nobody (`audienceUnkeyed` in `prepareRender`); every
later request keys it. The address and the session are in the key already, so rules on `queryParams` or `user` need
nothing more.

## Time windows

`timeWindow` (Structure) shows what it holds only between `startsAt` and `endsAt` — ISO 8601 with the offset, so the
same instant for every visitor (`instantOf` reads nothing else; either empty is no bound). The page server draws it at
the instant it renders and hands that instant to the browser (`renderedAt`, the store's `clock`) for a space that has
one, so the page hydrates as drawn; then it follows the browser's clock and shows or hides it when the window opens or
closes (`nextWindowChange`). A kept page is drawn at the instant it was rendered: within the cache's lifetime of a
bound, the first paint may show the other side, which the page corrects as it starts. Not access control — what it
holds is in the space's document.

`countdown` (Basic) says how long is left until its `to`, or until the `endsAt` of the time window it is in
(`TimeWindowContext`), each unit from `largest` down to `smallest` named in the space's language through `Intl`
(`countdownLabel`). It reads the same `clock`: a space with either reads it (`readsTheClock`, `helpers/clock.ts` in
the page server), so a countdown is drawn with the figures of the instant the page rendered and hydrates on them, then
counts on to each second (`nextCountdownTick`). It is a `<time datetime>` with `role="timer"`, which a screen reader does
not read out as it changes. At zero it stays at zero and runs `onCountdownEnd`, once per page, when it gets there or
when the page opens past it.

## In the builder

The canvas seeds `render.builder: true` (`apps/builder/src/App.tsx`), and nothing is drawn, read off the visitor's
cookies or written there. **While editing**, each Variants element shows the variant its `builderVariant` names (by place from 0,
picked with the eye in its settings), so every variant can be edited; an empty variant is marked in the canvas as an
empty tab is. **In the preview**, the canvas shows the page to a simulated visitor, chosen in the State Manager's
**Visitor** tab: the variant of each Variants element by chance it forces (`experiments.qa`, each test's `builderVariant` until chosen) and
the facts the audiences read (`visitorSimulation`, laid over the device the canvas is sized as, the editor's language
and a first visit — `useSimulatedVisitor`, published as the page's `visitor`) and the date the time windows are read
at (`simulatedAt`, the page's `clock`; the editor's own until chosen). While editing a time window always shows what it
holds. A rolled-out flag answers its own value there; the Feature Flags panel forces it.

## Authoring and the linter

`variants()` and `variantItem()` write it (`sdk-authoring/src/elements/elements.ts`). `lintVariantsElements` holds each to how it
chooses (`variants-choose-by`), its variants and nothing else — two to five by chance, one at least by rules
(`variants-items`) — and a canvas variant it has (`variants-builder-variant`). By chance: a readable test name
(`experiment-name`; empty is the element's own), a share each and one at least above 0 (`experiment-weight`), shares adding up to 100 (`experiment-weights-total`), and those
that share a name agreeing on their shares (`experiment-weights-differ`); a template reading an experiment no Variants element
runs is `experiment-unknown`. By rules: each rule a rule group (`variants-rule`), no variant after one for everybody
(`variants-unreachable`) and one such at the end (`variants-no-fallback`). `timeWindow()` writes a window, and
`lintTimeWindows` holds its bounds to instants with their offset (`time-window-bound`) and its end after its start
(`time-window-empty`). The builder's Space Issues, the MCP and the publish gate say the same.

## Measuring it

Two analytics events, named and read in `@plitzi/sdk-shared/experimentEvents`, reserved with a `$` a space's
own `plitzi.track` names never start with:

- **`$experiment`** — one visitor of a variant: `{ experiment, variant }`. Reported once per visitor and experiment,
  when the variant is drawn for them: the server says what it drew for the page (`drawnExperiments`, the store's
  `experiments.drawn`), the browser adds what it draws (`useExperiments`), and `AnalyticsReporter` reports each once. A
  reload finds the variant kept and draws nothing, so nothing is counted twice.
- **`$goal`** — a conversion: the `reachGoal` step (`spaceCallbacks.reachGoal`, `reachGoal('signup')` in authoring)
  reports `{ goal, 'ab.<experiment>': <variant>… }`, the visitor's variant of each experiment of the space. A name that
  is not one (letters, digits, `-`, `_`) is refused and said in the console. In the builder nothing is counted: the step
  says what a visitor's page would.

A deployment's analytics reads them with `exposureOf` and `goalOf`; Plitzi's folds them into visitors and conversions
per experiment, variant and goal, and shows them in the console with each variant's rate against A's.
