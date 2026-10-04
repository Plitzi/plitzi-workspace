# Plitzi authoring — cheatsheet

What most changes need, on one page. Everything is imported from `@plitzi/sdk-authoring`. For the rest, ask by name —
`npx @plitzi/cli explain navigate` (an element, a step, a trigger, a problem's code), `--list steps` for every one of a
kind — rather than reading its `.d.ts`.

## The space

```ts
const space: SpaceSpec = {
  name, permanentUrl,                          // permanentUrl: lowercase, digits, `-`
  variables: { color: { card: { light, dark, default } } },   // every colour a token, both themes; tokens(variables).card
  classes: { card },                           // styles() declarations, by their own name; styles('card', tw('p-4 rounded-xl'))
  computed: { total: '{{ … }}' },              // values read anywhere as computed.total
  flags: { beta: { description, value: false, rules: [] } },
  customCss: '@keyframes …',                   // keyframes and what no property says
  layouts: [{ id: 'shell', body }],           // chrome shared by pages
  components: [{ id, props, slots, root }],    // a block placed many times with different content
  pages: [{ id, name, slug: '', layout: { id: 'shell', slot: 'main' }, body: [] }]   // slot: where the body goes
};                                             // slug '' is home; 'products/:slug' takes a param
const { schema, style, warnings } = authorSpace(space, { plugins: [declaration] });
```

## Elements

Every factory takes the element's attributes and these fields: `id`, `class`, `css`, `states`, `slots`, `bind`,
`visible`, `flows`, `anchor`, `flag`, `runtime`, `loadStrategy`, `children`.

```ts
text('Words', { class })                       // also text({ content }); a <div> — `display: inline` to flow
heading('Title', { subType: 'h2' })            // h1–h6; holds no children
paragraph('A paragraph.')
container([children], { subType: 'section' })  // div, section, nav, header, footer, main, article, li, h1–h6, span…
link({ href: 'about', content: 'About' })      // a page id, a '/path', or a URL — the mode follows from the href
link({ href: 'home', hash: 'plans' })          // → /#plans, onto the element with anchor: 'plans'
container({ motion: { enter: 'fade-up', on: 'view' }, children })  // arrives once as it comes into view; stagger, loop too
button({ content: 'Save', flows })             // holds children too: then content: ''
image({ src, alt })                            // or decorative: true
embed({ src, title })                          // a map, a player: another page in a frame
svg('<svg …>…</svg>', { label })               // checked, sanitised; currentColor follows the class
svg(svgFile(new URL('./logo.svg', import.meta.url)))  // a file, compacted: svgFile/svgFiles from '@plitzi/sdk-authoring/node'
fontAwesome({ icon: 'fa-solid fa-xmark' })
list({ id: 'rows', items: 'p.data.rows', row: 'row-card' })    // a <ul>; a component per row, its root an <li>
list({ id: 'rows', items: 'p.data.rows', row: r => listItem({ children: [text({ from: `${r.item}.title` })] }) })
carousel({ id: 'hero', items: 'p.data.slides', autoplay: 5000, row: 'slide-card', children: [/* carouselNext('hero') arrows */] })
                                               // rows follow their item's `id`, or `itemKey: 'slug'`
apiContainer({ id: 'p', query: '/data/x.json', cache: true, children })   // publishes p.data; no box of its own
apiContainer({ id: 'p', query: '/data/x.json', runtime: 'server', children }) // read by the page server: still p.data
                                               // loadingSlot: 'p-skeleton' — a child shown until it answers
form({ id, managedByInteractions: true, flows, children })
formControl({ name: 'email', label: 'Email', subType: 'email' })          // select: options: [{ label, value }]
modalContainer({ id, visible: false, title, children })
component('card', { props: { title }, children: { body: [ … ] } })
custom({ renderType: 'myPlugin' }); defineElement<Props>(declaration)      // a plugin
```

## Styles

```ts
const card = styles('card', { padding: 24, borderRadius: 16 });        // shorthands, camelCase, numbers as px
styles('title', { fontSize: { desktop: '48px', compact: '32px' }, fontWeight: 700 });   // one property per breakpoint
styles('card', { css: { desktop: { … }, compact: { … } }, states: { hover: { … } }, variants: { active: { … } } });
container({ class: card });                                    // a shared class…
container({ id: 'hero', class: [card, { opacity: '0.5' }] });  // …plus one thing (needs an id)
container({ css: { padding: '8px' } });                        // rules of its own — never with `class`
```

Breakpoints: `desktop` (base), `tablet` (48–64rem), `mobile` (≤48rem), `compact` (tablet AND mobile). Each inherits
from `desktop` alone. States: `hover`, `focus`, `focus-visible`, `active`, `disabled`…. An ancestor's state:
`ancestors: { [card.name]: { states: { hover: { … } } } }`.

## Data, bindings, visibility

```ts
from: 'p.data.title'                                           // the main attribute: content, src, href, items
from: 'rows.item.price', as: 'price'                           // shown as a format (space `formats`) or a template
from: site.data.title                                          // const site = source('p', sampleJson): typed, checked
bind: { alt: 'p.data.title' }                                  // other attributes; short source names
bind: [bindTemplate('content', 'p.data.items', '{{ source|length }} items')]
bind: [bindTemplate('items', 'p.data.rows', '{{ source|filter(r => r.on) }}', { returns: 'value' })]
bind: [variantFrom(pill, 'rows.item.status')]                  // a variant chosen by the data
bind: [activeOn(navLink, 'about')]                             // the current page's link
bind: [activeWhen(dot, '{{ list_dots.index == state.slide }}')] // a variant while a condition holds
visible: 'p.data.signedIn'                                     // shown while true; '!p.data.signedIn' inverts
visible: { source: 'p.data.rows', template: '{{ source is defined and source|length == 0 }}' }
visible: false                                                 // hidden until a step shows it
```

Inside a list row: `rows.item` in a binding, `{{ list_rows.item.x }}` in a template or an attribute,
`list_rows.index` is a number from 0. A provider's source in a template is `apiContainer_p`… —
spelled in full, as the element publishes it; an id with a `-` keeps it (`list_study-plans`: a minus takes spaces,
`a - b`). Globals: `state`, `navigation` (`routeParams`, `queryParams`),
`auth`, `variables`, `computed`, `flags`, `theme`, `host`.

## Flows

A flow is `[trigger, …steps]`, in an element's `flows`.

```ts
[onClick(), setState({ key: 'saved', type: 'boolean', value: true })]  // types: boolean, number, text, json
[named('sent', onSubmit()), setState({ key: 'email', type: 'text', value: '{{ sent.values.email }}' })]
[on('onChange'), …]; [on('onMouseEnter'), …]; [onPageLoad(), …]; [onKey('mod+k, escape'), …]
[onInterval(5000), …]                                          // every 5 s, while the tab is in view
[onClick(), scrollBy('cards', { x: '80%' })]; scrollTo('cards', { x: 'end' }); scrollIntoView('answer')
[named('row', onScroll()), …]                                  // { x, y, atStart, atEnd } of its own box
[onClick(), toggleState({ key: 'menuOpen' })]
[onClick(), cycleState({ key: 'slide', length: 3, by: -1 })]   // goes round; stepState({ key, by, min, max }) stops
[onClick(), openModal('details')]; closeModal('details')
[onClick(), navigate({ urlType: 'page', url: 'about' })]
[onClick(), runServerAction({ actionId: 'checkout', input: { id: '{{ list_rows.item.id }}' } })]
[onClick(), when({ field: 'state.step', operator: '=', value: '2' }, setState({ … }))]
[whileRunning('queue', onClick()), delay(1000), …]
[named('picked', declaredTrigger(declaration, 'onPick')), …]; declaredCallback(declaration, 'reset', { on: 'seats' })
```

## The problems met most

Each comes with its code in brackets; reference/authoring-errors.md has a row for every one — search it by code.

| Code | Write instead |
| --- | --- |
| `class-and-css` | `class: [card, { … }]` with an `id`, or the rules in the class |
| `id-taken` | ids are one namespace for the whole space, pages included: build a repeated helper inside `scope()` |
| `unknown-attribute` | the attribute it lists; an event is a flow, not an attribute |
| `children-in-leaf` | a `container` — a heading made of parts is `container({ subType: 'h1' })` |
| `template-short-source` | the source in full in templates: `list_rows`, `apiContainer_p` |
| `template-unknown-name` | a source, a variable, `navigation.queryParams.x` or `source` |
| `template-text-into-value` | `{ returns: 'value' }` on a template feeding `items` |
| `list-items-ignored` | `source: 'controlled'` |
| `condition-starts-visible` | `visible: { source, template }`, which starts hidden |
| `tablet-rule-skips-mobile` | the rule under `compact` |
| `colour-without-dark` | `{ light, dark, default }` |
| `click-on-static-element` | the flow on a `button` (it holds children) or a `link` |
| `image-without-alt` / `control-without-name` | `alt` or `decorative: true`; `title` on an icon button |
| `anchor-missing` | the `anchor` on the section the `hash` names |

## Recipes

Whole, authoring examples by intent — copy one, then change the names: see the Recipes table in SKILL.md.
