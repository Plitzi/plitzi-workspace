# Elements and styles

## Elements

One factory per element, named after it. Attributes and the authoring fields go in ONE flat object:

```ts
heading({ content: 'Fieldnotes', subType: 'h2', class: title })
image({ src: '/fox.jpg', alt: 'A fox', css: { 'aspect-ratio': '3/2' } })
container({ class: card, children: [ … ] })
text('Wildlife, close up')          // a string is the content
container([hero, grid])             // an array is the children
```

| Authoring field | What it does |
| --- | --- |
| `id` | the ONE name this element answers to — its key in the document, a binding's source, a step's target. Unique across the WHOLE space |
| `class` | a shared class: a `styles()` declaration or a name from the space's `classes`; a list for several. Exclusive with `css` |
| `css` | rules of this element's own: one set, or one per breakpoint (`{ desktop, tablet, mobile }`) |
| `states` | `hover`, `focus-visible`… beside the element's own `css` |
| `variant` | a variant of the class it wears (when the class declares it) or of its type |
| `slots` | a class for one of the element's OTHER selectors — a form control's `input` |
| `bind` | where a value comes from |
| `visible` | a condition (`'src'`, `'!src'`, `{ source, template }`), or `false` to start hidden |
| `flows` | what happens on click, on submit, on load |
| `runtime` | `'server'` resolves this provider's data on the server |
| `loadStrategy` | when the contents mount relative to visibility: `eager` (default), `lazy`, `visible` |
| `children` | the tree |
| `meta` | `meta.label` is the element's name in the builder's tree |

Anything else in the object is an **attribute** (`authorSpace` warns `unknown-attribute` for one the element never
reads).

**A link's `href` is a page id.** `link({ href: 'reports' })` finds the page by id, folder included. `mode: 'internal'`
for a path within the space carrying `{{tokens}}` — a row's own slug (`'/games/{{ list_games.item.slug }}'`), a route
param, state; `mode: 'external'` for a full URL passed through untouched. A link is an `<a>`: never put a link inside
another link — make the card the link, or the button, not both.

**Some types hold no children.** A `heading`, `text`, `paragraph`, `image`, `formControl`… renders its own attributes
and nothing nested in it — `authorSpace` refuses children there. A heading made of parts (a word in another colour, an
icon, a badge) is a `container` with the heading's tag: `container({ subType: 'h1', class: title, children: [text('Space
'), text('Gamer', { class: accent })] })` — give the texts `display: inline` in their class.

**A `button` shows its `content` AND its children.** `content` defaults to "Button": a button whose words are children
says `content: ''` (`default-content-beside-children` warns otherwise). Its accessible name is everything it shows.

**A `formControl` works on its own.** Inside a `form` its value is the form's and it validates on submit; outside one it
keeps its own value and fires `onChange` with `{ value, name }` on every change — a search box or a select that
filters a screen needs no form. Bind `defaultValue` to the state it writes and a reset of that state reaches it.

**A `list` is a `<ul>`.** The browser indents it and puts bullets on it; a list of cards needs
`{ margin: '0px', padding: '0px', 'list-style-type': 'none' }` in its class.

**A provider has no box unless you give it a tag.** An `apiContainer` renders no element of its own by default, so its
children sit in the parent's layout and a `class` on it styles nothing (`STYLE_WITHOUT_TAG`). Put the layout on the
parent, or give it `attributes: { subType: 'div' }`.

A type this SDK does not ship — a plugin — is authored the same way: `defineElement<Props>({ type, … })`,
`element<Props>('type', props)`, or `elementsFromManifest(manifest)`. See [plugins](plugins.md).

**What a type takes, answered by the package** instead of the 7,000-line `.d.ts`: every catalogue is exported, keyed by
type — `elementCatalog` (what it is for), `elementDefaultAttributes`, `elementAttributeNames`, `elementTriggers`,
`elementCallbacks`, `elementSlots`, `elementSourceTypes`, `elementLeafTypes`, plus `BUILTIN_TRANSFORMERS`. One line
prints any of them:

```bash
node --input-type=module -e "import * as a from '@plitzi/sdk-authoring'; const t = 'formControl'; console.log({ attributes: a.elementDefaultAttributes[t], triggers: a.elementTriggers[t], slots: a.elementSlots[t] })"
```

## CSS

Write CSS as you write CSS, shorthands included — they are expanded to the longhands Plitzi's editor reads. A property
outside the vocabulary is refused with the key it should have been (`paddingTop` → `padding-top`).

- `column(gap, extra?)`, `row(gap, extra?)`, `grid(columns, gap, extra?)` for the three layouts every space repeats.
- **Breakpoints are ranges, not a cascade.** `tablet` is 48–64rem, `mobile` below 48rem, and each inherits only from
  `desktop` — a rule for `tablet` never reaches a phone (`authorSpace` warns `tablet-rule-skips-mobile`). A rule for
  everything narrower than a desktop is `compact`, written to both: `css: { desktop: { … }, compact: { 'grid-template-columns':
  '1fr' }, mobile: { gap: '8px' } }` — what `tablet` or `mobile` say for themselves wins.
- **`backdrop-filter`, `filter` and `transform` make an element the containing block of its `position: fixed`
  children.** A glass header with a fixed phone dock inside puts the dock at the top of the header, not the screen.
- **Fonts are declared.** A `font-family` loads only if the space lists the face in `fonts`
  (`{ source: 'google', family: 'Geist', fallback: 'system-ui, sans-serif', weights: [400, 600], styles: ['normal'] }`).

## Classes

```ts
const card = styles('card', {
  css: { padding: '24px', 'border-radius': '12px', 'background-color': 'var(--card)' },
  states: { hover: { 'border-color': 'var(--primary)' }, 'focus-visible': { outline: '2px solid var(--primary)' } },
  variants: { active: { 'border-color': 'var(--primary)' } }
});

container({ class: card, children: [ … ] });
```

- A flat object is the base rules; `{ css, states, variants, ancestors }` when there is more. Each part may be written
  per breakpoint.
- **Share a rule as a class, never as a spread.** Spreading a `const` into each element's `css` shares the source and
  duplicates the document: one selector per element, so restyling one card in the builder restyles one card.
- **Build a family from a plain object**, not by layering classes: `styles('button-primary', { ...buttonBase, … })`.
- One name declared twice with rules that disagree is refused. Declare a class once, in the module that owns it, and
  import it.
- `ancestors: { [sidebar.name]: { variants: { collapsed: { display: 'none' } } } }` styles an element by the state or
  variant of an ancestor class — the way to react to a parent's hover or collapse without a flow.
- **`:hover` is part of the selector, not a rule in `customCss`.** `customCss` is for what no class can say:
  keyframes, pseudo-elements, a rule across two unrelated elements, the inside of a third-party widget.
- Per element TYPE defaults go in `elements: { heading: { base, states, variants, slots } }` — a whole type at once.
- **Slots** are an element's other selectors: a `formControl`'s `input`, `label`, `error`; a `modalContainer`'s
  `backgroundContainer`, `rootContainer`, `headerContainer`, `headerTitle`, `headerCloseButton`, `bodyContainer`; a
  `dialogContainer`'s footer and buttons. `elementSlots` lists them all by type. Style one element's with `slots`, a
  whole type's with `elements.<type>.slots`.
- A `modalContainer` / `dialogContainer` is fixed to the viewport, as tall as its content up to the screen, and 500px
  wide up to the screen; theme its look through its slots.

**A variant chosen by the data:** `variantFrom(pill, 'jobs.item.status')`, or with a template when the data does not
already speak in variant names — `variantFrom(pill, 'runs.item.status', { template: "{{ source == 'completed' ?
'ok' : 'failed' }}" })`. The binding's key names the CLASS; never write it by hand. For "the current page", see
`activeOn` in [layouts.md](layouts.md).

## Colours and themes

Every colour is a **variable** with both values, and elements say `var(--name)`:

```ts
variables: {
  color: {
    foreground: { light: '#0c0c14', dark: '#ededf3', default: '#0c0c14' },
    card: { light: '#ffffff', dark: '#101019', default: '#ffffff' },
    primary: { light: '#5b3df5', dark: '#6e52f7', default: '#5b3df5' }
  }
}
```

- Choose each value against its own background: a colour picked on white is not the same colour on near-black.
- Fixed colours are only for surfaces that are fixed in both themes (a brand panel that is always dark) — and then
  the text on them is fixed too. Theme-following text on a fixed background is the bug.
- A tint of a token is `color-mix(in srgb, var(--primary) 12%, transparent)`, which follows the theme for free.
- `themeToggle()` is the switch; `theme.resolved` (`light`/`dark`) is a global source for anything else that needs it.
