# Data and visibility

## Bindings

```ts
heading({ bind: { content: 'posts.title' } })                     // short form: attributes
text({ bind: [{ to: 'content', source: 'stats.data.total',        // full form: anything else
  transformers: [{ action: 'twigTemplate', params: { template: "{{ source|number_format(0, '.', ',') }} views" } }] }] })
```

**A source names the id you gave the element** — `'posts.title'`, `'postList.item.cover'` — and the prefix is
completed from what the element publishes (`apiContainer_posts`, `list_postList`; a `form` publishes under
`apiContainer`). A name nothing answers to, or a prefix that does not match, is refused.

**Inside a template the name is spelled in full**: `{{ apiContainer_stats.data.total }}`, `{{ list_rows.item.id }}`.
The binding's `source` is completed for you; its template is read as written, so the short name there is refused.

An element re-renders when anything it reads changes: the first part of each binding's `source` and every source its
templates name. The globals are `variables`, `navigation` (`routeParams`, `queryParams`, `origin`, `currentPageId`),
`auth` (who is signed in, `status` while that is being found out), `state` (what flows wrote) and `theme`
(`mode`, `resolved`).

## Providers

```ts
apiContainer({ id: 'orders', query: '{{apiUrl}}/orders', credentials: 'include', children: [ … ] })
apiContainer({ id: 'board', runtime: 'server', action: 'queue-board' })          // resolved before the HTML
```

- A provider's source is readable by its **descendants** only. Wrap what reads it; a sibling cannot see it.
- It publishes `data` plus `isLoading`, `isEmpty`, `hasError`, `errorMessage` — bind a state to those, not to guesses.
- A query that depends on state is a binding on `query`; it answers `''` (and fetches nothing) until the state exists:
  `"{{ source ? apiUrl ~ '/workspaces/' ~ source ~ '/stats' : '' }}"` with `source: 'state.workspace.id'`.
- A space with any `runtime: 'server'` provider needs `rsc: { enabled: true }`.

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
compute is `visible: false` — so it waits hidden — plus a visibility binding with a template:

```ts
container({
  id: 'first-steps',
  visible: false,
  bind: [{
    to: 'visibility',
    source: 'stats.data.totals',
    category: 'initialState',
    transformers: [{ action: 'twigTemplate', params: {
      template: "{{ source ? (source.spaces > 0 and source.published > 0 ? 'false' : 'true') : 'false' }}"
    } }]
  }]
})
```

Rules for a condition's template:

- **A revealing condition starts hidden with `visible: false`.** A visibility binding alone keeps the element on
  screen until it answers — right for a hiding flag, a flash for a condition on data. `authorSpace` warns
  `condition-starts-visible` when a computed one on a provider starts on screen.
- **`'true'` shows, `'false'` hides, `''` writes nothing** and leaves the element as it is. Visibility hides only on
  an explicit false.
- **Answer what "not known yet" should mean.** For a revealing condition that is `'false'` (`source ? … : 'false'`);
  for a hiding flag it is `''` — nothing written, the default stays. A sidebar that answered `'false'` for a
  "folded" state nobody had set yet hid every label of the menu for everybody.
- **Hide the element itself.** Never wrap it in a container that is shown while the inner one is hidden: an empty
  visible wrapper still takes a slot in its parent's `gap`, and leaves a hole in the page.

### Loading, empty, error

Four states, and each has its own element:

| State | How to tell |
| --- | --- |
| Loading | `apiContainer_x.isLoading` — or simply nothing: every condition is hidden until data arrives |
| Empty | the answer ARRIVED and is empty: `{{ source is defined and source is empty ? 'true' : 'false' }}` over the list |
| Error | `apiContainer_x.hasError` |
| Data | the list itself |

`visible: '!provider.data.items'` is NOT an empty state: before the answer, `!undefined` is true and "Nothing here yet"
shows on every load. Test for "arrived and empty" (`is defined and … is empty`), or bind to `isEmpty` together with
`not isLoading`.

## Never ask the data for an opposite

Both sides of one question are `visible: 'x'` and `visible: '!x'`, not an `x` and a `notX` in the server's answer.
`!` reads a boolean that travelled as text (`"false"`, `"0"`) correctly. A three-state condition
(`Boolean(post) && !canEdit`) still belongs where the data is made.
