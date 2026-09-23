# Structuring a space that grows

A one-screen space fits in `src/space.ts`. Past a few pages, split it by what changes together — and keep every
repeated thing in exactly one place.

```text
src/space/
  index.ts          the SpaceSpec: name, variables, fonts, layouts, pages — assembly only
  tokens.ts         colour, shadow and radius variables, each with light and dark
  styles.ts         classes shared across areas (buttons, panels, page titles)
  components.ts     functions returning ElementSpec: panel(), statCard(), emptyState()
  layouts/app.ts    the application shell (+ its own classes)
  docs/
    nav.ts          the section's pages as data: id, slug, title, lede, order
    layout.ts       the section shell, generated from nav.ts
    page.ts         docsPage(id, content) — the shape every page of the section shares
  pages/
    home.ts         one file per page, or per page family
```

## Components are functions

The same block in two places is a function with parameters. Its ids come from a parameter, because ids are one
namespace for the whole space:

```ts
export const panel = (params: { id: string; title: string; sub?: string; link?: { href: string; label: string }; children: ElementSpec[] }): ElementSpec =>
  container({
    id: params.id,
    class: panelCard,
    children: [
      container({
        id: `${params.id}-head`,
        class: panelHead,
        children: [
          heading(params.title, { id: `${params.id}-title`, subType: 'h3', class: panelTitle }),
          ...(params.sub ? [text(params.sub, { id: `${params.id}-sub`, class: panelSub })] : []),
          ...(params.link ? [link({ id: `${params.id}-link`, href: params.link.href, class: panelLink, children: [text(params.link.label)] })] : [])
        ]
      }),
      ...params.children
    ]
  });
```

A page then reads as what it shows: `panel({ id: 'hm-traffic', title: 'Traffic', link: { href: 'analytics', label:
'Open analytics →' }, children: [chart] })`.

## Lists are data

Four quick links, three pricing plans, a sidebar menu, the steps of an onboarding: an array and a `map`.

```ts
const QUICK = [
  { id: 'team', icon: 'fas fa-user-plus', title: 'Invite your team', href: 'workspace' },
  { id: 'docs', icon: 'fas fa-book-open', title: 'Quickstart', href: 'docs-quickstart' }
] as const;

container({ id: 'quick', class: quickGrid, children: QUICK.map(item => quickCard(item)) });
```

When items differ in ONE detail (one link needs a binding), put that detail in the item's data as an optional field
— never an `if (item.id === 'team')` inside the map.

## Names

- **Ids:** `area-role` in kebab-case — `hm-traffic-title`, `docs-nav-docs-data`. Never the builder's positional
  `container-45` in code you maintain: rename them when you touch the code.
- **Classes:** named after the role, not the look — `panel-title`, not `bold-16`.
- **State keys:** flat and descriptive — `docsClosedStart`, `onboardingDetails`.

## Code that came from an export

`specFromSpace` writes what the builder saved, faithfully: every element's own `css`, positional ids, `when` rules
per page. It renders; it is not maintainable. When you work on such a file, leave it better:

- repeated `css` blocks → one class;
- a nav with a hand-styled current entry per page → a layout and `activeOn`;
- the same tree pasted per item → a function and a `map`;
- `container-45` → a name.

Each of those is safe to do on its own: authoring refuses anything that would not render, and the visual check shows
the rest.
