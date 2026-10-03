# Data and visibility

## Bindings

```ts
heading({ from: 'posts.title' })                                                  // the element's main attribute
text({ from: 'stats.data.total', as: "{{ source|number_format(0, '.', ',') }} views" })   // through a template
text({ from: 'products.item.price', as: 'price' })                                // a format of the space's, by name
image({ alt: '', bind: { alt: 'posts.title' }, from: 'posts.cover' })             // `bind`: the other attributes
container({ bind: [bindTemplate('width', 'state.xp', '{{ source / 10 }}%', { category: 'style' })] })  // a style
text({ bind: [{ to: 'content', source: 'posts.title', when: { … } }] })             // full form: anything else
```

`from` binds what the type shows — a text's, heading's, paragraph's or button's `content`, an image's `src`, a link's
`href`, a list's `items` — and leaves it empty until the data answers. `as` shows it through a template (`source` is
the value), or a format the space names once in `formats: { price: "{{ source|currency('USD') }}" }` (filters
`currency` and `percent` are there for exactly this). `bind` is for every other attribute;
`bindTemplate(to, source, template, { category?, returns? })` is the computed attribute — a template over the value
at `source`. `returns: 'value'` hands over what a single `{{ expression }}` evaluates to instead of its text: a list's
`items`, a number, a flag (see [lists](lists.md)).

**A source names the id you gave the element** — `'posts.title'`, `'postList.item.cover'` — and the prefix is
completed from what the element publishes (`apiContainer_posts`, `list_postList`; a `form` publishes under
`apiContainer`). A name nothing answers to, or a prefix that does not match, is refused.

**Inside a template the name is spelled in full**: `{{ apiContainer_stats.data.total }}`, `{{ list_rows.item.id }}`.
The binding's `source` is completed for you; its template is read as written, so the short name there is refused.

An element re-renders when anything it reads changes: the first part of each binding's `source` and every source its
templates name. The globals are `variables`, `navigation` (`routeParams`, `queryParams`, `origin`, `currentPageId`),
`auth` (who is signed in, `status` while that is being found out), `state` (what flows wrote), `theme`
(`mode`, `resolved`), `host` (the `hostData` an application embedding the space hands the SDK) and `computed` (below).

## Values computed once

A value many elements show — a score, a level, a count of what the visitor picked — is declared once on the space and
read everywhere as `computed.<name>`, instead of repeating its expression in every binding:

```ts
export const space = {
  …,
  computed: {
    xp: '{{ (state.favourites|length) * 10 + (state.runs ?? 0) * 5 }}',
    level: '{{ computed.xp // 100 + 1 }}'
  }
};

text('', { bind: [bindTemplate('content', 'computed.level', 'Level {{ source }}')] })
```

A computed value reads the globals (`state`, `auth`, `navigation`, `variables`, `theme`, `host`) and the ones declared
above it — not an element's source: bind that on the element. One `{{ expression }}` gives its value (a number, a
list); anything else gives text. `authorSpace` refuses a name read before it is declared, or never.

## Providers

```ts
apiContainer({ id: 'orders', query: '{{apiUrl}}/orders', credentials: 'include', children: [ … ] })
apiContainer({ id: 'board', runtime: 'server', action: 'queue-board' })          // resolved before the HTML
```

- A provider's source is readable by its **descendants** only. Wrap what reads it; a sibling cannot see it.
- It publishes `data` plus `isLoading`, `isEmpty`, `hasError`, `errorMessage` — bind a state to those, not to guesses.
  `isEmpty` reads what arrived: a `query`'s body when it is missing, `null`, `''`, `[]` or `{}`; a connector list by
  its `records`; a `singleRecord` provider by its `record`. It is also true before the first answer, so pair it with
  `not isLoading` for an empty state.
- A query that depends on state is a binding on `query`; it answers `''` (and fetches nothing) until the state exists:
  `"{{ source ? apiUrl ~ '/workspaces/' ~ source ~ '/stats' : '' }}"` with `source: 'state.workspace.id'`.
- A space with any `runtime: 'server'` provider needs `rsc: { enabled: true }`.

### Typed by a sample

`source('site', home)` types a provider's source from a sample of its answer, so a misspelt path is a type error —
see [typed-sources.md](typed-sources.md).

### Data in a project with no backend

An offline project (`offlineMode`) still never invents data: the content lives in JSON files the project serves
(`public/data/games.json`, served in either mode) and a provider reads them like any API — `apiContainer({ id: 'catalog', query:
'/data/games.json', cache: true, children: [ … ] })`. The page binds to `catalog.data.…` exactly as it would to a live
backend, so swapping the file for a real endpoint later changes one `query`. `mockData` is what the BUILDER shows while
editing; it is not a data source for the running page. Say on the page that demo content is demo content.

**In a server project (`create --mode server`), put the provider on the server** — `runtime: 'server'`, with
`rsc: { enabled: true }` on the space — and the page server reads the file from `public/` itself: the page arrives
with those sections in it (and their anchors in place) instead of fetching them once the browser has the page. A
browser provider leaves the server-rendered HTML without them. A `query` with `{{tokens}}` is still read in the
browser, against the visitor's route and state.

### Live, cached, refreshed

- **Live:** `refreshSeconds: 15` asks again on its own (either runtime); it pauses in a hidden tab and never
  overlaps. Use it for queues, feeds, status boards — then mark the panel as live so the reader knows it moves.
- **Cached:** `cache: true` (and `staleTime` seconds, 30 by default) shares an answer between providers asking the
  same thing and across page changes.
- **Refreshed by writes:** a `webHook` that is not a GET refreshes every request to its own site by default
  (`invalidateQueries: 'origin'`); a `runServerAction` refreshes everything (`'all'`). Narrow it with
  `'elements'` + `invalidateElements: ['orders']`, or stop it with `'none'`.
- **Say `'none'` when a refresh would move the page on.** A page that decides where to go from a provider's answer
  ("profile complete → leave") will act on the refreshed answer in the middle of a multi-step form that saves as it
  goes, and skip the last step.

## Visibility

What the page's own data or state shows and hides. What a person switches on — a feature in beta, the old version
kept during a rollout — is a [feature flag](feature-flags.md): gated off, an element is not rendered at all.

```ts
container({ visible: 'posts.hasPosts', … })     // shown while true
container({ visible: '!posts.hasPosts', … })    // its inverse
modalContainer({ visible: false, … })           // starts hidden; a flow opens it
```

**An element is visible by default.** Which way its condition flips decides how it is written:

| The logic… | Example | Write |
| --- | --- | --- |
| reveals it: hidden until the data says so | empty state, "get started", admin-only panel, error note | `visible: 'src'`, or `visible: false` + a computed binding |
| hides it: shown unless a flag says otherwise | sidebar labels until the sidebar is folded, a banner until dismissed | a binding with no `visible`; an absent flag must leave it shown |

`visible` starts the element **hidden**, and it appears when its data says so. A revealing condition you have to
compute is `visible: { source, template }` — it starts hidden too, and the template's value is read as a yes or a
no: `false`, `0`, an empty text, an empty list and nothing at all are a no, anything else a yes. Write the condition
itself; `? 'true' : 'false'` is not needed:

```ts
container({
  id: 'first-steps',
  visible: {
    source: 'stats.data.totals',
    template: '{{ source and not (source.spaces > 0 and source.published > 0) }}'
  }
})
```

Rules for a condition's template:

- **A revealing condition starts hidden** — `visible: { source, template }` does that for you. A visibility binding
  written by hand in `bind` keeps the element on screen until it answers — right for a hiding flag, a flash for a
  condition on data. `authorSpace` warns `condition-starts-visible` when a computed one on a provider starts on screen.
- **A hidden element stays in the DOM** (`plitzi-component--hidden`), its subtree mounted. `loadStrategy: 'visible'`
  mounts the subtree only while it is shown, and `'lazy'` from the first time it is shown (modals do that already).
  Use it on heavy panels that are usually hidden; leave the default on what is usually on screen.
- **`'true'` shows, `'false'` hides, `''` writes nothing** and leaves the element as it is. Visibility hides only on
  an explicit false.
- **Answer what "not known yet" should mean.** For a revealing condition that is `'false'` (`source ? … : 'false'`);
  for a hiding flag it is `''` — nothing written, the default stays. A sidebar that answered `'false'` for a
  "folded" state nobody had set yet hid every label of the menu for everybody.
- **Hide the element itself.** Never wrap it in a container that is shown while the inner one is hidden: an empty
  visible wrapper still takes a slot in its parent's `gap`, and leaves a hole in the page.

### Loading, empty, error

A provider renders nothing inside it until its first answer. A skeleton of what is coming is a child named by its
`loadingSlot` — `apiContainer({ loadingSlot: 'catalog-skeleton', children: [container({ id: 'catalog-skeleton' }),
…] })` — shown alone until then and gone after (`loading-slot-unknown` if no child has that id). So a provider goes
around the section that needs it, never around a layout's slot: there every page would wait on it.

Four states, and each has its own element:

| State | How to tell |
| --- | --- |
| Loading | `apiContainer_x.isLoading` — or simply nothing: every condition is hidden until data arrives |
| Empty | the answer ARRIVED and is empty: `{{ source is defined and source is empty }}` over the list |
| Error | `apiContainer_x.hasError` |
| Data | the list itself |

`visible: '!provider.data.items'` is NOT an empty state: before the answer, `!undefined` is true and "Nothing here yet"
shows on every load. Test for "arrived and empty" (`is defined and … is empty`), or bind to `isEmpty` together with
`not isLoading`.

## Never ask the data for an opposite

Both sides of one question are `visible: 'x'` and `visible: '!x'`, not an `x` and a `notX` in the server's answer.
`!` reads a boolean that travelled as text (`"false"`, `"0"`) correctly. A three-state condition
(`Boolean(post) && !canEdit`) still belongs where the data is made.

## State that outlives a reload

`keepState`, what is never kept, and what the first paint needs from it — see [kept-state.md](kept-state.md).
