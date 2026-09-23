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
        bind: [activeOn(navLink, entry.id)],
        children: [text(entry.title, { id: `docs-nav-label-${entry.id}` })]
      })
    )
  });
```

Adding a page is one entry in the list: the menu, the index and the neighbours' "next" follow.

## The current entry: `activeOn`

A menu in a layout is the same nodes on every page, so it cannot have the right entry styled by hand. It asks which
page is showing:

```ts
const navLink = styles('nav-link', {
  css: { color: 'var(--muted)' },
  variants: { active: { color: 'var(--foreground)', 'font-weight': '600' } }
});

link({ href: 'spaces', class: navLink, bind: [activeOn(navLink, ['spaces', 'space-record'])] });
```

`activeOn(class, pageIds, { variant?, slot? })` binds the class's variant to `navigation.currentPageId`: the `active`
variant on those pages, `idle` everywhere else. Several ids for one entry — a section and the pages under it. Do not
write the binding by hand with a `when` rule per page; that is the long form this replaces.

## Pages from a factory

When pages share a shape — a heading, a lede, content, a footer — the shape is a function and each page is its data:

```ts
export const docsPage = (id: string, markdownSource: string): PageSpec => {
  const entry = docsEntry(id);                          // title, slug, lede from nav.ts

  return {
    id,
    name: entry.title,
    slug: entry.slug,
    seoTitle: `${entry.title} — Docs`,
    seoDescription: entry.lede,
    folder: 'docs',
    layout: { id: 'docs-layout', slot: 'docs-slot' },
    body: [
      container({
        id: `${id}-main`,                                 // prefixed: this function runs once per page
        class: main,
        children: [heading(entry.title, { id: `${id}-title`, class: title }), markdown(markdownSource, { id: `${id}-md` }), ...footer(id)]
      })
    ]
  };
};

export const quickstart = docsPage('docs-quickstart', `## One command …`);
```

Every page is now its content and nothing else, and every page is guaranteed the same structure.

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
