# The rules of writing a space

Every rule, with its why. The skill's core keeps the five that go wrong most in a line each; the rest authoring
refuses or warns of, with the fix.

1. **Name what is referred to.** Give an `id` to every element a binding, a flow or a test addresses. Ids are ONE
   namespace for the whole space — layouts and every page share it — so a helper that runs more than once builds inside
   `scope('promos', ref => …)`: every id in it is prefixed (`promos-panel`), and `ref('slides')` names one in full. An `id` is the element's name in the
   space (`data-plitzi-el` in the page); the DOM id a URL's `#fragment` lands on is its `anchor`.
2. **Share with classes, layouts and components, never with copies.** A look used twice is a `styles()` class.
   Chrome shown on several pages — a header, a sidebar, a footer — is a **layout** the pages name, written once. A block
   placed many times with different content — a product card, a testimonial — is a **component** placed with
   `component(id, { props })`. A menu, a card grid, a list of steps is DATA, never a block pasted per item: a short
   menu mapped in code is fine; rows — cards, dishes, tiles — are one `list` (`items: [ … ]`) whose row is written
   once. A link or a button says its words as
   its own `content`, not through a `text` inside it. Pages of one shape are one `pageFamily` over data. See
   [layouts](layouts.md), [components](components.md), [structure](structure.md) and
   [efficiency](efficiency.md).
3. **One element, one base selector.** An element takes a shared `class` OR its own `css`, never both — authoring
   refuses the pair. "This class plus one thing" is the class with rules on top, last in the list:
   `class: [cover, { opacity: '0.25' }]` (needs the element's `id`; it becomes the class `<id>--own`). A look that
   never changes is its own class.
4. **Visible by default; decide which way the logic flips.** An element is on screen unless something hides it. When
   the logic REVEALS it (hidden → shown: an empty state, a "get started" card, an admin-only panel), it starts hidden —
   `visible: 'source'`, or `visible: false` plus a binding for a computed condition — so it never flashes while data
   loads (`condition-starts-visible` warns). When a flag HIDES it (shown → hidden: a sidebar label until the sidebar
   is folded), it keeps the default and an absent flag must leave it shown. See
   [data and visibility](data-and-visibility.md). What a PERSON switches on — a feature in beta, a rollout —
   is a feature flag, not a visibility: gated off, it is not rendered at all. See [feature flags](feature-flags.md).
5. **Know where a template is evaluated.** A binding's template (`bindTemplate`) and a step's params evaluate full
   Twig. An ATTRIBUTE resolves a name with filters (`{{ list_games.item.slug }}`, `{{ post.slug|url_encode }}`) against
   the sources around the element; a condition there is used as written. Inside any template a source is spelled in
   full — `apiContainer_stats`, `list_rows` — and a query param is `navigation.queryParams.x`. A template that feeds a
   list its `items` hands over its value (`returns: 'value'`). `authorSpace` refuses a template it cannot read and a
   name nothing answers to. See [templates](templates.md).
6. **Tokens, not colours.** Every colour is a variable of the space with a `light` and a `dark` value; both themes are
   checked from the first commit.
7. **Times in UTC, and say so.** Format with an explicit zone (`|date('j M · H:i', 'UTC')`) and print "UTC" beside it:
   a page rendered on a server and hydrated in a browser in another zone must agree on the hour.
8. **Breakpoints are ranges.** `tablet` (48–64rem) and `mobile` (up to 48rem) each inherit only from `desktop`; a rule
   meant for both is written under `compact`.
9. **Never invent data.** Numbers, names and states on screen come from a source. A panel with nothing true to say is
   an empty state, not a placeholder figure. With no backend, the data is JSON read by an `apiContainer`: a server
   project's `src/data/*.json`, read on the server and never served; with no server, `public/data/*.json`, which is
   public — see [data and visibility](data-and-visibility.md).
10. **Never hand-write** `flat`, derived ids, `styleSelectors`, `beforeNode`/`afterNode`/`flowId`, or a
    `styleVariant` binding's key — use the factories, `variantFrom` and `activeOn`.
11. **A switch is named for how it leaves its default.** `toggleState` turns a key nobody has set yet ON, so a key
    named for the default (`showPlates`, on by default) takes a first click to do nothing: name it `platesOff`, and read
    every switch through `computed` (`plates: '{{ state.platesOff ? false : true }}'`) so its default shows before
    anybody touches it.
12. **Hand plugins over as their declarations**: `authorSpace(space, { plugins: [declaration] })` holds a plugin —
    placed with `defineElement(declaration)` — to the events, actions and attributes it declares. See
    [plugins](plugins.md).
13. **Usable without sight.** Screen readers and browser agents (Claude in Chrome) find a page's controls in its
    accessibility tree: every button and link has words (an icon-only button a `title`), every field a `label`
    (`hideLabel: true` hides it and keeps the name), every image an `alt` or `decorative: true`. Clicks go on a
    `button` — it holds children, so a whole card can be one — or a `link`, never on a container. See
    [accessibility](accessibility.md).
14. **Motion that stays smooth.** Animate `opacity` and `transform` only; no animated blur, shadow or size. See
    [motion](colours-and-motion.md).
