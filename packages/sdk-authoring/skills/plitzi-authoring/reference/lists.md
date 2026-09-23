# Lists

A `list` renders its children once per item. Its rows come from its `items`, which it reads in one of two ways:

| `source` | `items` is | Use it for |
| --- | --- | --- |
| `'controlled'` | written or bound on the list — an array | anything you have: a provider's answer, `state`, a fixed set |
| a connector | fetched by the list from a connector | server-driven CMS lists (see the provider in data-and-visibility) |

```ts
list({
  id: 'games',
  source: 'controlled',
  class: gameGrid,
  bind: { items: 'catalog.data.games' },          // an array from the provider around it
  children: [gameCard()]                          // rendered once per game
})
```

- Each row publishes **`list_<id>.item`** (the row) and **`list_<id>.index`** (its position, as text). Inside the row,
  bindings read the short form (`'games.item.title'`), templates and attribute tokens the full one
  (`{{ list_games.item.slug }}`).
- A **nested list** sees the outer row: inside `list_features`, `list_games.item` is still the game.
- The list is a `<ul>` and its `class` styles that root; each child is rendered straight into it, with no wrapper.
  A card grid needs `{ margin: '0px', padding: '0px', 'list-style-type': 'none' }` in its class.
- Fixed data is `items: [ … ]` on the list itself — no provider needed.
- Everything inside a row is `repeated` in the handles: a test addresses one copy with `.first()` / `.nth()`.

## Filtering and sorting

Bind `items` through a template that hands over its **value**:

```ts
list({
  id: 'shown',
  source: 'controlled',
  bind: [bindTemplate('items', 'catalog.data.games',
    "{{ source|filter(g => (state.genre ?? '') == '' or g.genre == state.genre)|sort((a, b) => b.score - a.score) }}",
    { returns: 'value' })],
  children: [gameCard()]
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
      template: "{{ source is defined and not (source|find('slug', navigation.routeParams.slug)) ? 'true' : 'false' }}" }
  })
] })
```

A link to it from a card is an attribute token read inside the card's row:
`link({ mode: 'internal', href: '/games/{{ list_games.item.slug }}' })`.
