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
| `visible` | a condition (`'src'`, `'!src'`), or `false` to start hidden |
| `flows` | what happens on click, on submit, on load |
| `runtime` | `'server'` resolves this provider's data on the server |
| `children` | the tree |
| `meta` | `meta.label` is the element's name in the builder's tree |

Anything else in the object is an **attribute** (`authorSpace` warns `unknown-attribute` for one the element never
reads).

**A link's `href` is a page id.** `link({ href: 'reports' })` finds the page by id, folder included. `mode: 'internal'`
for a path within the space carrying `{{tokens}}`; `mode: 'external'` for a full URL passed through untouched. A link
is an `<a>`: never put a link inside another link — make the card the link, or the button, not both.

**A `list` is a `<ul>`.** The browser indents it and puts bullets on it; a list of cards needs
`{ margin: '0px', padding: '0px', 'list-style-type': 'none' }` in its class.

**A provider has no box unless you give it a tag.** An `apiContainer` renders no element of its own by default, so its
children sit in the parent's layout and a `class` on it styles nothing (`STYLE_WITHOUT_TAG`). Put the layout on the
parent, or give it `attributes: { subType: 'div' }`.

A type this SDK does not ship — a plugin — is authored the same way: `defineElement<Props>({ type, … })`,
`element<Props>('type', props)`, or `elementsFromManifest(manifest)`.

## CSS

Write CSS as you write CSS, shorthands included — they are expanded to the longhands Plitzi's editor reads. A property
outside the vocabulary is refused with the key it should have been (`paddingTop` → `padding-top`).

- `column(gap, extra?)`, `row(gap, extra?)`, `grid(columns, gap, extra?)` for the three layouts every space repeats.
- **Breakpoints are ranges, not a cascade.** `tablet` is 48–64rem, `mobile` below 48rem, and each inherits only from
  `desktop` — a rule for `tablet` never reaches a phone. Write it in both; `authorSpace` warns
  `tablet-rule-skips-mobile`.
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
