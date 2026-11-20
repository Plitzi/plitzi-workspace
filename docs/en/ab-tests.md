# A/B tests, audiences and time windows

An A/B test shows each visitor one of two versions of a part of a page, and keeps showing them the same one. This page
is how it works across the stack: the element, who draws a visitor's variant, where it is kept, what the page server's
cache does with it, and what the builder shows. How to write one is the authoring skill's (`feature-flags.md` § A/B
tests); the element's attributes are its declaration's (`packages/sdk-elements/src/elements/testing/AbTest`).

## The element

`abTest` holds two to five `abTestVariant`s: the first is A (the control), then B, C, D, E by their place.

| Attribute | On | What it is |
|-----------|----|------------|
| `experiment` | `abTest` | The experiment's name: what a visitor's variant is kept under, and what `{{ experiments.<name> }}` reads. Empty, the test runs nothing and shows A. |
| `builderVariant` | `abTest` | The variant the builder's canvas shows, so each can be edited. Never a visitor's. |
| `weight` | `abTestVariant` | Its share of the visitors against the others' weights, 0–100 (default 50). 0 shows it to nobody. |

Only the variant a visitor is shown is drawn — the others are absent, not hidden: their providers ask for nothing and
their words are not in the page. Two tests with the same `experiment` share it: a visitor sees the same variant of both
(a headline and the button under it), and the first one met gives the weights.

Its category in the builder is **Testing** (`market.category: 'testing'`), the elements a page is measured with rather
than made of. `plitzi_render`'s offline widgets leave it out: a widget has no visitors to split.

## Who draws a visitor's variant

One function decides, in `@plitzi/sdk-shared/experiments`, for both the server and the browser:
`assignExperiments(declared, kept, random)`. For each experiment the space runs (`declaredExperiments`, read off every
`abTest` of its pages and its components):

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

`audience` holds `audienceVariant`s and shows each visitor the first whose `when` — a rule group, as a flag's — they
match; one with no conditions matches everybody, the "everyone else" an audience ends with. Its rules see what a flag's
do (`environment`, `hostname`, `routeParams.*`, `queryParams.*` — `utm_source` and the like —, `user.*`) and the
visitor's facts (`@plitzi/sdk-shared/audiences`): `visitor.returning` (first seen more than a visit — 30 minutes — ago,
by the `plitzi_seen` cookie the SDK writes once), `visitor.language` (the primary subtag of the first language asked
for) and `visitor.device` (`mobile`, `tablet`, `desktop`, by the `Sec-CH-UA-Mobile` hint or the user agent).

The page server reads the facts off the request (`requestVisitorFacts`) and hands them to the browser
(`serverVisitor`), which hydrates the variant drawn; with no server, the browser reads them itself, once per page
(`browserVisitorFacts`). Only the variant shown is drawn, found by its item (`childOfItem`) — a variant a flag switched
off is not among the children.

**The page cache.** A page an audience drew is kept apart by the facts its rules read — and only those, only for a
space whose audiences read any (`audienceFactsUsed`). They are known before the cache is asked only from the space the
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

## In the builder

The canvas seeds `render.builder: true` (`apps/builder/src/App.tsx`), and nothing is drawn, read off the visitor's
cookies or written there. **While editing**, each A/B test shows its `builderVariant` and each audience the variant its
`builderVariant` names (by place from 0), so every variant can be edited; an empty variant is marked in the canvas as an
empty tab is. **In the preview**, the canvas shows the page to a simulated visitor, chosen in the State Manager's
**Visitor** tab: the variant of each A/B test it forces (`experiments.qa`, each test's `builderVariant` until chosen) and
the facts the audiences read (`visitorSimulation`, laid over the device the canvas is sized as, the editor's language
and a first visit — `useSimulatedVisitor`, published as the page's `visitor`) and the date the time windows are read
at (`simulatedAt`, the page's `clock`; the editor's own until chosen). While editing a time window always shows what it
holds. A rolled-out flag answers its own value there; the Feature Flags panel forces it.

## Authoring and the linter

`abTest()` and `abTestVariant()` write it (`sdk-authoring/src/elements/elements.ts`). `lintExperiments` holds each test
to a name (`experiment-unnamed`, `experiment-name`), two to five variants and nothing else (`experiment-variants`), a
weight each and one at least above 0 (`experiment-weight`), a canvas variant it has (`experiment-builder-variant`),
and tests that share a name to one set of weights (`experiment-weights-differ`); a template reading an
experiment no test runs is `experiment-unknown`. `audience()` and `audienceVariant()` write an audience, and
`lintAudiences` holds it to its variants and nothing else (`audience-variants`), each rule a rule group
(`audience-rule`), no variant after one for everybody (`audience-unreachable`) and one such at the end
(`audience-no-fallback`). `timeWindow()` writes a window, and `lintTimeWindows` holds its bounds to instants with
their offset (`time-window-bound`) and its end after its start (`time-window-empty`). The builder's Space Issues, the
MCP and the publish gate say the same.

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
