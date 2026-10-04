---
name: plitzi-authoring
description: >-
  Write or change a Plitzi space or snippet in TypeScript with @plitzi/sdk-authoring — pages, layouts, components,
  elements, CSS classes, data bindings, providers and flows — instead of hand-writing schema JSON. Use whenever the task is to
  create, extend, restyle or fix a space: adding a page or a section, sharing a header across pages, binding an
  element to data, showing or hiding something, wiring what happens on click, or turning an exported JSON into code.
---

# Authoring Plitzi spaces

A space is two JSON documents — a schema and a style — full of cross-referenced ids. **Never write them by hand.**
`@plitzi/sdk-authoring` derives every id, class name, parent link, breakpoint map and flow chain from a small
declaration, and refuses a declaration that would not render.

```ts
import { authorSpace, container, heading, styles, text } from '@plitzi/sdk-authoring';

const page = styles('page', { display: 'flex', 'flex-direction': 'column', padding: '96px 24px', gap: '16px' });

export const space = {
  name: 'My space',
  permanentUrl: 'my-space',
  pages: [{ name: 'Home', slug: '', class: page, body: [heading('Hello', { subType: 'h1' }), text('A paragraph.')] }]
};

const { schema, style, warnings } = authorSpace(space);
```

**Start with [the cheatsheet](CHEATSHEET.md)** — the factories, fields, steps and the problems met most, on one page —
and open a reference below only when the task names its subject. What an element takes, a step's params, what a
trigger hands its flow: `npx @plitzi/cli explain <name>` answers in a few lines (over MCP, `plitzi://explain/<name>`).
The published `.d.ts` documents the rest — search it by name, never read it whole.

This skill writes a space that lives in code. One that lives on Plitzi — edited in the builder, published from there —
is edited through the Plitzi MCP server instead, never both on one space; `plitzi create --from <space>` turns the
second into the first. If the MCP asks for a sign-in nobody can give, a project in code needs no account.

## How to work

1. **Read before you write.** Open `src/space.ts` (and whatever it imports) and find the layout, the classes and the
   helpers already there. Extend them; do not add a second way of doing something the space already does.
2. **Change the declaration, then author it.** `npm run author` (or restart the server) runs `authorSpace`. It checks
   everything — every field, value, template, name, param and page link — and a refusal says what to write instead:
   do exactly that. Never work around a check, cast past it, or move the logic into a plugin to escape it. The first
   refusals come one at a time; the linter's come as ONE list — fix every line of it before running again. How it
   checks, a one-file author script for any project, and what it cannot see: [validation](reference/validation.md).
3. **Read every warning, then every suggestion.** A warning names something written that will not do what it says —
   zero warnings is the bar. A suggestion (`[suggest]`, `suggestions` in `authorSpace`'s result) names a shorter way to
   the same page: a layout for chrome on every page, a component or a `list` for copies, a button's own `content`. Take
   them, the ones that save the most first. See [efficiency](reference/efficiency.md).
4. **Look at it.** `npm run check -- /about --width 1440,390` says in text whether the page is whole — every element on
   screen, nothing overflowing, a clean console; `npm run shot -- /about --width 390 --scheme dark` is the picture, for
   when it says something is wrong (`--frames 4` shows what moves); `npm run visual`
   runs the checks. Look at desktop, tablet and mobile, light and dark, and the page while its data is still loading.
5. **Go through the [review checklist](reference/review-checklist.md) before saying it is done.** It is the feedback a
   reviewer gives on every change, written down so you do not need to hear it.

## The rules that matter most

1. **Name what is referred to.** Give an `id` to every element a binding, a flow or a test addresses. Ids are ONE
   namespace for the whole space — layouts and every page share it — so a helper that runs more than once builds inside
   `scope('promos', ref => …)`: every id in it is prefixed (`promos-panel`), and `ref('slides')` names one in full. An `id` is the element's name in the
   space (`data-id` in the page); the DOM id a URL's `#fragment` lands on is its `anchor`.
2. **Share with classes, layouts and components, never with copies.** A look used twice is a `styles()` class.
   Chrome shown on several pages — a header, a sidebar, a footer — is a **layout** the pages name, written once. A block
   placed many times with different content — a product card, a testimonial — is a **component** placed with
   `component(id, { props })`. A menu, a card grid, a list of steps is DATA, never a block pasted per item: a short
   menu mapped in code (`entries.map(entry => link({ href, content: entry.title }))`) is fine; rows — cards, dishes,
   tiles — are one `list` over them (`items: [ … ]`) whose row is written once. A link or a button says its words as
   its own `content`, not through a `text` inside it. See [layouts and duplication](reference/layouts.md),
   [components](reference/components.md) and [efficiency](reference/efficiency.md).
3. **One element, one base selector.** An element takes a shared `class` OR its own `css`, never both — authoring
   refuses the pair. "This class plus one thing" is the class with rules on top, last in the list:
   `class: [cover, { opacity: '0.25' }]` (needs the element's `id`; it becomes the class `<id>--own`). A look that
   never changes is its own class.
4. **Visible by default; decide which way the logic flips.** An element is on screen unless something hides it. When
   the logic REVEALS it (hidden → shown: an empty state, a "get started" card, an admin-only panel), it starts hidden —
   `visible: 'source'`, or `visible: false` plus a binding for a computed condition — so it never flashes while data
   loads (`condition-starts-visible` warns). When a flag HIDES it (shown → hidden: a sidebar label until the sidebar
   is folded), it keeps the default and an absent flag must leave it shown. See
   [data and visibility](reference/data-and-visibility.md). What a PERSON switches on — a feature in beta, a rollout —
   is a feature flag, not a visibility: gated off, it is not rendered at all. See [feature flags](reference/feature-flags.md).
5. **Know where a template is evaluated.** A binding's template (`bindTemplate`) and a step's params evaluate full
   Twig. An ATTRIBUTE resolves a name with filters (`{{ list_games.item.slug }}`, `{{ post.slug|url_encode }}`) against
   the sources around the element; a condition there is used as written. Inside any template a source is spelled in
   full — `apiContainer_stats`, `list_rows` — and a query param is `navigation.queryParams.x`. A template that feeds a
   list its `items` hands over its value (`returns: 'value'`). `authorSpace` refuses a template it cannot read and a
   name nothing answers to. See [templates](reference/templates.md).
6. **Tokens, not colours.** Every colour is a variable of the space with a `light` and a `dark` value; both themes are
   checked from the first commit.
7. **Times in UTC, and say so.** Format with an explicit zone (`|date('j M · H:i', 'UTC')`) and print "UTC" beside it:
   a page rendered on a server and hydrated in a browser in another zone must agree on the hour.
8. **Breakpoints are ranges.** `tablet` (48–64rem) and `mobile` (below 48rem) each inherit only from `desktop`; a rule
   meant for both is written under `compact`.
9. **Never invent data.** Numbers, names and states on screen come from a source. A panel with nothing true to say is
   an empty state, not a placeholder figure. With no backend, the data is JSON the project serves
   (`public/data/*.json`) read by an `apiContainer` — see [data and visibility](reference/data-and-visibility.md).
   `public/` is served to anyone who asks: never a secret or data only some visitors may read there.
10. **Never hand-write** `flat`, derived ids, `styleSelectors`, `beforeNode`/`afterNode`/`flowId`, or a
    `styleVariant` binding's key — use the factories, `variantFrom` and `activeOn`.
11. **A switch is named for how it leaves its default.** `toggleState` turns a key nobody has set yet ON, so a key
    named for the default (`showPlates`, on by default) takes a first click to do nothing: name it `platesOff`, and read
    every switch through `computed` (`plates: '{{ state.platesOff ? false : true }}'`) so its default shows before
    anybody touches it.
12. **Hand plugins over as their declarations**: `authorSpace(space, { plugins: [declaration] })` holds a plugin —
    its own type, or a `custom({ renderType })` host — to the events, actions and attributes it declares. See
    [plugins](reference/plugins.md).
13. **Usable without sight.** Screen readers and browser agents (Claude in Chrome) find a page's controls in its
    accessibility tree: every button and link has words (an icon-only button a `title`), every field a `label`
    (`hideLabel: true` hides it and keeps the name), every image an `alt` or `decorative: true`. Clicks go on a
    `button` — it holds children, so a whole card can be one — or a `link`, never on a container. See
    [accessibility](reference/accessibility.md).
14. **Motion that stays smooth.** Animate `opacity` and `transform` only; no animated blur, shadow or size. See
    [motion](reference/colours-and-motion.md).

## Recipes

Each is a whole file that authors with no warning — CI holds it to that. Copy the one that fits, then change the names.

| To… | Open |
| --- | --- |
| Show data with no backend: a JSON file, a card per row, a count, an empty state, a computed value | [recipes/show-data.ts](recipes/show-data.ts) |
| Data typed by a sample of it: completed and checked paths, typed rows | [recipes/typed-data.ts](recipes/typed-data.ts) |
| Filter and sort a list from a select | [recipes/filter-a-list.ts](recipes/filter-a-list.ts) |
| A page per record (`/products/:slug`), and "not found" | [recipes/detail-page.ts](recipes/detail-page.ts) |
| Link to a section of a page (`/#plans`) | [recipes/link-to-a-section.ts](recipes/link-to-a-section.ts) |
| A carousel: slides with arrows, dots and autoplay; a marquee; a row that swipes | [recipes/carousel.ts](recipes/carousel.ts) |
| Do something every few seconds — a ticker, a poll, a slideshow by hand | [recipes/every-few-seconds.ts](recipes/every-few-seconds.ts) |
| A marquee that scrolls for ever and stops under the pointer | [recipes/marquee.ts](recipes/marquee.ts) |
| A row that scrolls sideways, with arrows that hide at its ends | [recipes/scroll-a-row.ts](recipes/scroll-a-row.ts) |
| A link built from a row: WhatsApp with the product's name, `mailto:` | [recipes/link-with-data.ts](recipes/link-with-data.ts) |
| React to a click or a submit; a modal; a switch | [recipes/forms-and-modals.ts](recipes/forms-and-modals.ts) |
| A feature behind a flag | [recipes/feature-flag.ts](recipes/feature-flag.ts) |
| An element of your own (a plugin), checked | [recipes/plugin.ts](recipes/plugin.ts) |
| Controls a screen reader and a browser agent can use | [recipes/usable-without-sight.ts](recipes/usable-without-sight.ts) |
| Tokens, a shared class, "the class plus one thing", tablet and phone at once | [recipes/style-a-page.ts](recipes/style-a-page.ts) |
| A design in Tailwind classes, kept as classes the builder edits | [recipes/from-tailwind.ts](recipes/from-tailwind.ts) |
| A page from elsewhere in a frame (`embed`: a map, a player) and a drawing of your own (`svg`) | [recipes/embed-and-svg.ts](recipes/embed-and-svg.ts) |

## References

| Read | When |
| --- | --- |
| [elements-and-styles.md](reference/elements-and-styles.md) | Any element or CSS: factories, fields, classes, states, variants, tokens, fonts, lists, links |
| [colours-and-motion.md](reference/colours-and-motion.md) | Colours for both themes, tokens, keyframes, and motion that stays smooth (good practices) |
| [tailwind.md](reference/tailwind.md) | A design written in Tailwind classes: `tw()`, its breakpoints and states, what it refuses |
| [layouts.md](reference/layouts.md) | Anything shown on more than one page; menus; reducing duplication of elements and styles |
| [efficiency.md](reference/efficiency.md) | The same page with fewer elements: the suggestions `authorSpace` makes, and the short way for each long one |
| [components.md](reference/components.md) | One block placed many times — a card, a tier, a testimonial: props, slots, binding a row into one, why it is closed |
| [data-and-visibility.md](reference/data-and-visibility.md) | Bindings, providers, offline data, loading/empty/error states, live data, caching, showing and hiding, kept state |
| [kept-state.md](reference/kept-state.md) | State that outlives a reload: `keepState`, transient and painted keys |
| [feature-flags.md](reference/feature-flags.md) | Switching a part of the space on or off — a beta, a rollout, the old version kept until the new one ships |
| [lists.md](reference/lists.md) | Rendering rows, filtering and sorting them, a detail page for one record, carousels |
| [typed-sources.md](reference/typed-sources.md) | Data typed by a sample of it: `source()`, typed rows, `twig` for templates |
| [validation.md](reference/validation.md) | How `authorSpace` checks, the loop that wastes no attempts, and what it cannot see |
| [authoring-errors.md](reference/authoring-errors.md) | What `authorSpace` refuses or warns about, and what to write instead |
| [templates.md](reference/templates.md) | Any `{{ … }}` or `{% … %}`: where it runs, naming sources, filters, tests, dates |
| [flows.md](reference/flows.md) | Clicks, submits, page loads, every few seconds, server actions, modals, state |
| [realtime.md](reference/realtime.md) | Pages that see each other: channels, presence, cursors, a shared board, who may hear a topic |
| [plugins.md](reference/plugins.md) | A component of your own: props, binding them, writing state, channels, registering, behaving in the builder |
| [drawing.md](reference/drawing.md) | A plugin that draws or animates: a canvas sized to the device, WebGL shaders that say why they failed, a loop that stops when nobody sees it |
| [structure.md](reference/structure.md) | A space bigger than one screen: files, helpers, naming, keeping it short |
| [testing.md](reference/testing.md) | Any test: `inspectPage` (one call, every problem), handles, fixtures, catching a flash from the first frame, shortcuts, counting renders |
| [performance.md](reference/performance.md) | A page with many elements, a busy flow, something that feels slow: what renders, what it costs, how to measure it |
| [snippets-and-export.md](reference/snippets-and-export.md) | Publishing a snippet; turning an exported JSON — or a server action — into code |
| [accessibility.md](reference/accessibility.md) | Icon buttons, fields, images, clickable cards, toggles, headings, landmarks, a canvas — anything a screen reader or a browser agent has to use |
| [review-checklist.md](reference/review-checklist.md) | Before you say it is done |

**What to read for a kind of task** — the cheatsheet, then only these:

- A site — landing, catalogue, blog: elements-and-styles, layouts, components, lists.
- An app with state and actions: data-and-visibility, templates, flows — realtime when pages see each other.
- A component of your own: plugins.
- A refusal or a warning: search authoring-errors.md for its code — never read it whole.
- Tests: testing.

Nothing else needs reading up front.
