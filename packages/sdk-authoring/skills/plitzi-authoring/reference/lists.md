# Lists

A `list` renders its children once per item. Its rows come from its `items` — an array written or bound on the list:
a provider's answer, `state`, a fixed set. **Only `source: 'controlled'` reads them.** The default, `'none'`, renders
its children once as a plain `<ul>` and never looks at `items`, so a list with items and any other source is refused
(`list-items-ignored`). A CMS collection arrives the same way: a provider with its `connector` around the list, and the
list bound to its records (see the provider in data-and-visibility).

```ts
list({ id: 'games', class: gameGrid, items: 'catalog.data.games', row: 'game-card' })   // a component per game
list({ id: 'games', items: 'catalog.data.games', row: r => text({ from: `${r.item}.title` }) })   // or a tree of its own
list({ id: 'plans', items: ['Free', 'Pro'], children: [text({ from: 'plans.item' })] })  // fixed items
```

`items` makes a list controlled: an array of its own, or the source its rows come from. `row` is what it renders once
per item — a component's id (placed with the row bound to its `item` prop, or its only prop), or a function handed the
row's names: `r.item` and `r.index` for a binding or `from`, `r.inTemplate.item` for a template
(`` `/games/{{ ${r.inTemplate.item}.slug }}` ``). A function needs the list's `id`, which names those sources. With
`items` a typed source's path (`items: site.data.games`, see typed-sources.md), the row is typed too:
`row: g => text({ from: g.item.title })`, and a field the sample's games lack is a type error.

- Each row publishes **`list_<id>.item`** (the row) and **`list_<id>.index`** (its position, a number from 0 —
  `index + 1` counts, and `==` compares it with text or a number alike). Inside the row,
  bindings read the short form (`'games.item.title'`), templates and attribute tokens the full one
  (`{{ list_games.item.slug }}`).
- A **nested list** sees the outer row: inside `list_features`, `list_games.item` is still the game.
- The list is a `<ul>` and its `class` styles that root; each child is rendered straight into it, with no wrapper.
  A card grid needs `{ margin: '0px', padding: '0px', 'list-style-type': 'none' }` in its class.
- Fixed data is `items: [ … ]` on the list itself — no provider needed.
- Everything inside a row is `repeated` in the handles: a test addresses one copy with `.first()` / `.nth()`.
- **A row is its item's by its `id`** when every item has a different one, else by its position: filtered or
  reordered, a row's state (an open detail, a field's text) follows its item. Items named by another field say so —
  `itemKey: 'slug'` (`list-item-key-missing` warns when fixed items lack it). A row whose item changes mounts again,
  so a one-row list showing "the current slide" replays the slide's entrance animation.

## Filtering and sorting

Feed the list through a template — `from` with `as` hands a list its template's **value**:

```ts
list({
  id: 'shown',
  from: 'catalog.data.games',
  as: "{{ source|filter(g => (state.genre ?? '') == '' or g.genre == state.genre)|sort((a, b) => b.score - a.score) }}",
  row: 'game-card'
})
```

Only the rows that match are rendered. A counter and an empty state read the same predicate over the same source:
`{{ source|filter(…)|length }}` as text, and `visible: { source: 'catalog.data.games', template: "{{ source is defined
and source|filter(…)|length == 0 }}" }`.

Hiding rows one by one with a visibility binding also works, but every hidden row stays in the DOM (with its whole
subtree unless the row says `loadStrategy: 'visible'`). Filter the items instead.

## A detail page

A page with a route param (`slug: 'games/{{slug}}'`) shows one record. With a server provider, `singleRecord` and
`filters` fetch just that one. In the browser — an offline project, a `query` returning the whole collection — narrow
the list to the record the route names:

```ts
apiContainer({ id: 'catalog', query: '/data/games.json', cache: true, children: [
  list({
    id: 'game',
    source: 'controlled',
    bind: [bindTemplate('items', 'catalog.data.games',
      '{{ source|filter(g => g.slug == navigation.routeParams.slug) }}', { returns: 'value' })],
    children: [gameDossier()]                       // reads list_game.item
  }),
  text('Signal lost — no game by that name.', {
    id: 'game-missing',
    visible: { source: 'catalog.data.games',
      template: "{{ source is defined and not (source|find('slug', navigation.routeParams.slug)) }}" }
  })
] })
```

A link to it from a card is an attribute token read inside the card's row:
`link({ href: '/games/{{ list_games.item.slug }}' })`.

## Carousels

```ts
carousel({ id: 'hero', label: 'Featured', items: 'site.data.slides', autoplay: 5000, row: 'slide-card', children: [
  button({ content: '›', title: 'Next slide', flows: [[onClick(), carouselNext('hero')]] })
] })
```

A `carousel` takes `items` and a `row` as a list does, and writes the row into a `carouselTrack`; its other children are
its controls, which read `carousel_hero.index`, `.count`, `.item` and `.items` (`list({ id: 'dots', items: 'hero.items',
… })` for dots, `activeWhen(dot, '{{ list_dots.index == carousel_hero.index }}')` for the current one). Steps:
`carouselNext`, `carouselPrevious`, `carouselGoTo(id, index)`, `carouselPlay`, `carouselPause`; it fires `onChange`.

- `mode: 'slide'` (one at a time, `transition` `slide`/`fade`/`none`, back enters from the left), `'marquee'` (`speed` px/s,
  no seam), `'scroll'` (a row that snaps and swipes; next moves a slide). Several slides at once: the carousel's class
  sets `--plitzi-carousel-slide-width` and `--plitzi-carousel-gap`.
- Autoplay holds still under the pointer (`pauseOnHover`), with keyboard focus inside, in a hidden tab and for reduced
  motion. In the builder it stands on its first slide. `label` names it for a screen reader.

See recipes/carousel.ts.
