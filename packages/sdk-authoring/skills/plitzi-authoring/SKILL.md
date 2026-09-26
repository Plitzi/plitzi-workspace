---
name: plitzi-authoring
description: >-
  Write or change a Plitzi space or template in TypeScript with @plitzi/sdk-authoring — pages, layouts, elements,
  CSS classes, data bindings, providers and flows — instead of hand-writing schema JSON. Use whenever the task is to
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

The published `.d.ts` is the reference for every factory, field and step builder
(`node_modules/@plitzi/sdk-authoring/dist/index.d.ts`) — read it instead of guessing a name or a param. For one element
type, the exported catalogues answer faster (`elementDefaultAttributes`, `elementTriggers`, `elementSlots`… — see
[elements and styles](reference/elements-and-styles.md)).

## How to work

1. **Read before you write.** Open `src/space.ts` (and whatever it imports) and find the layout, the classes and the
   helpers already there. Extend them; do not add a second way of doing something the space already does.
2. **Change the declaration, then author it.** `npm run author` (or restart the server) runs `authorSpace`. It checks
   everything — every field, value, template, name, param and page link — and a refusal says what to write instead:
   do exactly that. Never work around a check, cast past it, or move the logic into a plugin to escape it. The first
   refusals come one at a time; the linter's come as ONE list — fix every line of it before running again. How it
   checks, a one-file author script for any project, and what it cannot see: [validation](reference/validation.md).
3. **Read every warning.** Each one names something written that will not do what it says. Zero warnings is the bar.
4. **Look at it.** `npm run shot -- /about --width 390 --scheme dark` saves a picture of one page; `npm run visual`
   runs the checks. Look at desktop, tablet and mobile, light and dark, and the page while its data is still loading.
5. **Go through the [review checklist](reference/review-checklist.md) before saying it is done.** It is the feedback a
   reviewer gives on every change, written down so you do not need to hear it.

## The rules that matter most

1. **Name what is referred to.** Give an `id` to every element a binding, a flow or a test addresses. Ids are ONE
   namespace for the whole space — layouts and every page share it — so an element built by a helper that runs more
   than once gets its id prefixed by what it is for: `` `${pageId}-foot` ``.
2. **Share with classes and layouts, never with copies.** A look used twice is a `styles()` class. Chrome shown on
   several pages — a header, a sidebar, a footer — is a **layout** the pages name, written once. A menu, a card grid,
   a list of steps is DATA mapped to elements (`entries.map(entry => link(…))`), not a block pasted per item. See
   [layouts and duplication](reference/layouts.md).
3. **One element, one base selector.** An element takes a shared `class` OR its own `css`, never both — authoring
   refuses the pair. A look that never changes is its own class.
4. **Visible by default; decide which way the logic flips.** An element is on screen unless something hides it. When
   the logic REVEALS it (hidden → shown: an empty state, a "get started" card, an admin-only panel), it starts hidden —
   `visible: 'source'`, or `visible: false` plus a binding for a computed condition — so it never flashes while data
   loads (`condition-starts-visible` warns). When a flag HIDES it (shown → hidden: a sidebar label until the sidebar
   is folded), it keeps the default and an absent flag must leave it shown. See
   [data and visibility](reference/data-and-visibility.md).
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
10. **Never hand-write** `flat`, derived ids, `styleSelectors`, `beforeNode`/`afterNode`/`flowId`, or a
    `styleVariant` binding's key — use the factories, `variantFrom` and `activeOn`.
11. **A switch is named for how it leaves its default.** `toggleState` turns a key nobody has set yet ON, so a key
    named for the default (`showPlates`, on by default) takes a first click to do nothing: name it `platesOff`, and read
    every switch through `computed` (`plates: '{{ state.platesOff ? false : true }}'`) so its default shows before
    anybody touches it.
12. **Hand plugins over as their declarations**: `authorSpace(space, { plugins: [declaration] })` holds a plugin —
    its own type, or a `custom({ renderType })` host — to the events, actions and attributes it declares. See
    [plugins](reference/plugins.md).

## Recipes

Copy the one that fits, then change the names. Each is the shape `authorSpace` accepts on the first try.

```ts
// Data with no backend: a JSON file the project serves (public/data/games.json), read by a provider.
apiContainer({ id: 'catalog', query: '/data/games.json', cache: true, children: [ /* reads catalog.data.… */ ] })

// A list of rows from that data. Inside a row: short form in bindings, full name in templates and attributes.
list({ id: 'games', source: 'controlled', bind: { items: 'catalog.data.games' }, children: [
  link({ mode: 'internal', href: '/games/{{ list_games.item.slug }}', children: [
    text('', { bind: { content: 'games.item.title' } })
  ] })
] })

// A filtered list: a template that hands over its VALUE.
list({ id: 'shown', source: 'controlled',
  bind: [bindTemplate('items', 'catalog.data.games', "{{ source|filter(g => g.genre == state.genre) }}", { returns: 'value' })],
  children: [ … ] })

// Text computed from data.
text('', { bind: [bindTemplate('content', 'catalog.data.games', '{{ source|length }} games')] })

// Shown only when a computed condition says so (starts hidden, no flash).
text('Nothing here yet', { visible: { source: 'catalog.data.games', template: '{{ source is defined and source|length == 0 }}' } })

// A value used in many places: declare it once in the space, read it anywhere as computed.xp.
computed: { xp: '{{ (state.favourites|length) * 10 }}' }

// A button that does something: a flow is [trigger, steps…].
button({ content: 'Save', flows: [[onClick(), setState({ key: 'saved', type: 'boolean', value: true })]] })

// A form: the flow goes on the form, which manages its own submit.
form({ id: 'signup', managedByInteractions: true,
  flows: [[named('sent', onSubmit()), setState({ key: 'email', type: 'text', value: '{{ sent.values.email }}' })]],
  children: [formControl({ name: 'email', label: 'Email', subType: 'email' }), button({ content: 'Sign up', subType: 'submit' })] })

// A modal: hidden until a flow opens it.
modalContainer({ id: 'details', visible: false, title: 'Details', children: [ … ] })
button({ content: 'Open', flows: [[onClick(), openModal('details')]] })

// A plugin: author it from its own declaration, flow on its events, call its actions — all checked.
const seats = defineElement<SeatPickerAttributes>(declaration);
seats({ id: 'seats', flows: [[named('picked', declaredTrigger(declaration, 'onPick')), setState({ key: 'seat', type: 'text', value: '{{ picked.seat }}' })]] })
button({ content: 'Clear', flows: [[onClick(), declaredCallback(declaration, 'reset', { on: 'seats' })]] })
authorSpace(space, { plugins: [declaration] })

// A link: to a page by its id, to a path with mode 'internal', to anything else with mode 'external'.
link({ href: 'about' }); link({ href: '/games/nebula', mode: 'internal' }); link({ href: 'mailto:hi@x.com', mode: 'external' })
```

## References

| Read | When |
| --- | --- |
| [elements-and-styles.md](reference/elements-and-styles.md) | Any element or CSS: factories, fields, classes, states, variants, tokens, fonts, lists, links |
| [layouts.md](reference/layouts.md) | Anything shown on more than one page; menus; reducing duplication of elements and styles |
| [data-and-visibility.md](reference/data-and-visibility.md) | Bindings, providers, offline data, loading/empty/error states, live data, caching, showing and hiding, kept state |
| [lists.md](reference/lists.md) | Rendering rows, filtering and sorting them, a detail page for one record |
| [validation.md](reference/validation.md) | How `authorSpace` checks, the loop that wastes no attempts, and what it cannot see |
| [authoring-errors.md](reference/authoring-errors.md) | What `authorSpace` refuses or warns about, and what to write instead |
| [templates.md](reference/templates.md) | Any `{{ … }}` or `{% … %}`: where it runs, naming sources, filters, tests, dates |
| [flows.md](reference/flows.md) | Clicks, submits, page loads, server actions, realtime channels, modals, state |
| [plugins.md](reference/plugins.md) | A component of your own: props, binding them, writing state, channels, registering |
| [structure.md](reference/structure.md) | A space bigger than one screen: files, helpers, naming, keeping it short |
| [testing.md](reference/testing.md) | Any test: `inspectPage` (one call, every problem), handles, fixtures, catching a flash from the first frame, shortcuts, counting renders |
| [performance.md](reference/performance.md) | A page with many elements, a busy flow, something that feels slow: what renders, what it costs, how to measure it |
| [templates-and-export.md](reference/templates-and-export.md) | Publishing a template; turning an exported JSON into code |
| [review-checklist.md](reference/review-checklist.md) | Before you say it is done |
