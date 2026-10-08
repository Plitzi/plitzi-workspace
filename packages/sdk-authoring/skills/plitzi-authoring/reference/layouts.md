# Layouts, and not writing anything twice

A space grows by pages, and most of what a page shows is the same on its neighbours: the top bar, the sidebar, the
footer, the menu, the "ask for help" card. Written into each page, that chrome is a copy per page — sixteen docs pages
carried the same sidebar sixteen times, around 900 elements whose only difference was which link was highlighted, and
the copies disagreed the first time one was edited. The tools below remove every one of those copies.

## A layout is the shell, written once

```ts
export const docsLayout: LayoutSpec = {
  id: 'docs-layout',
  label: 'Docs Layout',
  folder: 'docs',                      // files it beside its pages in the builder; it routes nothing
  body: [
    container({
      id: 'docs-shell',
      class: shell,
      children: [
        topbar(),                      // helpers returning ElementSpec keep the layout readable
        container({ id: 'docs-body', class: body, children: [sidebar(), container({ id: 'docs-slot', class: slot })] })
      ]
    })
  ]
};

// in the space
pageFolders: [{ id: 'docs', name: 'Docs' }],   // declared once: its slug (the id) starts its pages' addresses — /docs/quickstart
layouts: [appLayout, docsLayout],
pages: [{ name: 'Quickstart', slug: 'quickstart', folder: 'docs', layout: { id: 'docs-layout', slot: 'docs-slot' }, body: [ … ] }]
```

- **The slot** is the element in the layout where the page's body goes. It must be inside the layout (checked).
- **Not re-mounted on navigation.** Moving between pages of one layout keeps the shell — its scroll, its open menus,
  its providers, its state — and swaps only the slot. That is also why a layout is cheaper than a copy.
- **Layouts nest.** `layout: { id: 'app-shell', slot: 'main' }` on a LAYOUT puts a section shell (analytics tabs, docs
  sidebar) inside the application shell. The page resolves the chain from the outside in.
- **A provider in a layout serves every page** — the plan in a sidebar, a star count in a top bar. A server provider
  (`runtime: 'server'`) in a layout is resolved with the page like one in the page.
- **The layout is a box between the page and its shell.** The page's own class styles the page's root, which holds the
  layout, which holds your shell — so a page that is a column stretching its content to the window's height
  (`min-height: 100vh` with a `flex-grow: 1` child) no longer reaches the shell: the footer lifts off the bottom. Give
  the layout `css: { display: 'contents' }` and the chain is what it was. A slot that only marks where the page goes,
  inside a parent that lays its children out, takes the same.
- **The slot can be a role, not only a place.** A split screen's form half is the slot itself (`class: formPane`), so
  each page is just its card.
- **Ids are shared** between a layout and all its pages. Name layout elements after the layout (`docs-topbar`), and
  let pages prefix theirs with the page id.

## The menu is data

The pages a menu lists, their titles, their summaries and their order are ONE list, and everything that shows them
reads it — the sidebar, the page title, the meta description, "previous / next", an index of cards:

```ts
// nav.ts — the single source
export const DOCS_NAV = [
  {
    id: 'start',
    title: 'Getting started',
    icon: 'fas fa-rocket',
    entries: [
      { id: 'docs-index', slug: '', title: 'Plitzi for developers', lede: 'What a space is…', icon: 'fas fa-book-open' },
      { id: 'docs-quickstart', slug: 'quickstart', title: 'Quickstart', lede: 'One command…', icon: 'fas fa-bolt' }
    ]
  }
] as const;

// layout.ts — the sidebar, generated
const navGroup = (group: DocsGroup): ElementSpec =>
  container({
    id: `docs-group-${group.id}`,
    children: group.entries.map(entry =>
      link({
        id: `docs-nav-${entry.id}`,
        href: entry.id,
        class: navLink,
        children: [text(entry.title, { id: `docs-nav-label-${entry.id}` })]
      })
    )
  });
```

Adding a page is one entry in the list: the menu, the index and the neighbours' "next" follow.

## The current entry

A menu in a layout is the same nodes on every page, so it cannot have the right entry styled by hand — and does not
need to. A link to the page being shown marks itself: `aria-current="page"`, which a screen reader announces, and its
class's `current` state dresses it:

```ts
const navLink = styles('nav-link', { css: { color: 'var(--muted)' }, states: { current: { color: 'var(--foreground)' } } });

link({ href: '/pricing', mode: 'internal', class: navLink });
```

An entry lit for a SECTION — a journal and its articles, `/automations/runs` while on `/automations/runs/42` — says
`current: 'section'`: current on its page and on every page under its path, at a `/` (`/runs` holds `/runs/42`, not
`/runsx`), announced there as the current entry (`aria-current="true"`); the same `current` state dresses it. A link to
`/` holds every page, so authoring warns (`link-current-section`):

```ts
link({ href: 'runs', class: navLink, current: 'section' });
```

`activeOn(class, pageIds, { variant?, slot? })` is for an entry lit on pages NOT under its path — `['spaces',
'space-record']` when a record lives at `/s/:id`: it binds the class's variant to `navigation.currentPageId`, the
`active` variant on those pages and `idle` everywhere else. Do not write the binding by hand with a `when` rule per
page; that is the long form this replaces.

## Pages from a factory

When pages share a shape — a heading, a lede, content, a footer — the shape is written once and each page is its data,
with `pageFamily`: it gives every page its id, slug, titles, folder and this layout, and prefixes the ids each body
gives (see [structure](structure.md#pages-of-one-shape-are-a-family)):

```ts
pages: pageFamily(
  { folder: 'docs', layout: { id: 'docs-layout', slot: 'docs-slot' }, seoTitle: entry => `${entry.title} — Docs`,
    body: entry => [container({ id: 'main', class: main, children: [heading({ id: 'title', content: entry.title, class: title }), markdown(entry.source, { id: 'md' })] })] },
  DOCS   // [{ id: 'docs-quickstart', title, slug, description, source }] — the same list the sidebar reads
)
```

Every page is now its content and nothing else, and every page is guaranteed the same structure.

## The page for an address nothing answers

```ts
{ id: 'not-found', name: 'Not found', slug: '*', layout: { id: 'site', slot: 'site-main' }, body: [ … ] }
```

- **`slug: '*'`** is the page of every address no other page answers — a mistyped link, a page taken down — sent with
  status 404, in the layout you give it, so the visitor is still on the site with a way back. Its own address answers
  404 too.
- **One per folder, if a section wants its own.** In a folder (`folder: 'docs'`) it answers that folder's unknown
  addresses; the deepest folder's wins, the space's takes the rest. A page whose `flag` is off shows it too.
- **A space with none is given a plain one** — a title and a link home, in the home page's layout — and `author`
  suggests writing your own (`not-found-page`): say it in the space's words.
- **A page that exists but finds nothing** — `/products/:slug` for a slug no product has — is sent with 404 too when
  its server provider says so: `notFound: "{{ not (source.data.products|find('slug', navigation.routeParams.slug)) }}"`,
  one expression against its answer, on a `runtime: 'server'` provider of the page. When the record comes from a
  provider of its layout, which every page shares, the page says it: `notFound` on the page reads its server providers
  by name — `"{{ not (apiContainer_feed.products|find('slug', navigation.routeParams.slug)) }}"`. The page renders as
  written: show its "not found" part with `visible`.

## Styles follow the same rule

- A role used on several pages is ONE class (`panelCard`, `pageTitle`), declared in the module that owns the area and
  imported — never re-declared per page, never spread into `css`.
- Layout classes live with the layout; page classes with their page; shared ones in one `styles.ts` per area.
- A family of looks is a shared base object and one class per member; a state of one element is a variant.
- If you find yourself copying a `css` block, it is a class. If you find yourself copying an element tree, it is a
  function, a layout, or a `map` over data.

## When NOT to use a layout

A block that appears on one page belongs to that page. A block on several pages but in different places is a
function (`communityLinks('docs-help', 'on-surface')`), not a layout. A layout is for what frames the page.
