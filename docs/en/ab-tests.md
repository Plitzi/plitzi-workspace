# A/B tests

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

## In the builder

The canvas seeds `render.builder: true` (`apps/builder/src/App.tsx`): the element shows `builderVariant`, the
`experiments` source holds each test's `builderVariant`, and no cookie is read or written. The test's settings choose
the variant to edit and its name, each variant's settings its weight; an empty variant is marked in the canvas as an
empty tab is.

## Authoring and the linter

`abTest()` and `abTestVariant()` write it (`sdk-authoring/src/elements/elements.ts`). `lintExperiments` holds each test
to a name (`experiment-unnamed`, `experiment-name`), two to five variants and nothing else (`experiment-variants`), a
weight each and one at least above 0 (`experiment-weight`), a canvas variant it has (`experiment-builder-variant`),
and tests that share a name to one set of weights (`experiment-weights-differ`); a template reading an
experiment no test runs is `experiment-unknown`. The builder's Space Issues, the MCP and the publish gate say the same.

## Measuring it

The platform does not record which variant a visitor saw: `{{ experiments.<name> }}` is there for a flow to send with
the conversion it measures — a `webHook` to the space's analytics, a server action writing a row.
