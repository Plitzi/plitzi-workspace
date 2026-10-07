# Elements and styles

## Elements

One factory per element, named after it. Attributes and the authoring fields go in ONE flat object:

```ts
heading({ content: 'Fieldnotes', subType: 'h2', class: title })
image({ src: '/fox.jpg', alt: 'A fox', css: { 'aspect-ratio': '3/2' } })
image({ src: 'https://cdn.shop.com/p.jpg', alt: '…', sizes: '360px', width: 1200, height: 800 })   // resized by the page server
container({ class: card, children: [ … ] })
text('Wildlife, close up')          // a string is the content
container([hero, grid])             // an array is the children
```

| Authoring field | What it does |
| --- | --- |
| `id` | the ONE name this element answers to — its key in the document, a binding's source, a step's target. Unique across the WHOLE space |
| `class` | a shared class: a `styles()` declaration or a name from the space's `classes`; a list for several. Exclusive with `css` |
| `css` | rules of this element's own: one set, or one per breakpoint (`{ desktop, tablet, mobile }`) |
| `states` | `hover`, `focus-visible`, `current` (the chosen link, toggle, tab), `expanded`, `first`/`last`/`odd`/`even`, `hidden`… |
| `variant` | a variant of the class it wears (when the class declares it) or of its type |
| `slots` | a class for one of the element's OTHER selectors — a form control's `input` |
| `bind` | where a value comes from |
| `visible` | a condition (`'src'`, `'!src'`, `{ source, template }`), or `false` to start hidden |
| `flows` | what happens on click, on submit, on load |
| `runtime` | `'server'` resolves this provider's data on the server |
| `loadStrategy` | when the contents mount relative to visibility: `eager`, `lazy`, `visible`. Left out, the type decides — `eager`, `lazy` for a modal or a dialog |
| `children` | the tree |
| `meta` | `meta.label` is the element's name in the builder's tree |

Anything else in the object is an **attribute** (`authorSpace` warns `unknown-attribute` for one the element never
reads).

**A link says where by its `href`:** a page id (`link({ href: 'reports' })`, folder included), a path within the space
— with `{{tokens}}` if it needs them, a row's own slug (`'/games/{{ list_games.item.slug }}'`) — or a full URL
(`https:`, `mailto:`, `tel:`), passed through untouched. `mode` follows from it; write it only to say otherwise. A link
that opens another tab (`target: 'blank'`) gets `rel="noopener noreferrer"`. A link is an `<a>`: never put a link inside
another link — make the card the link, or the button, not both.

**A link's words are its `content`** and an icon its `icon`, as a button's (`link({ href: 'pricing', content:
'Pricing', icon: 'fa-solid fa-arrow-right', iconPlacement: 'after' })`, its class on the `icon` slot) — never a
`text` or `fontAwesome` inside. The
link to the page being shown is `aria-current="page"`; its class's `current` state styles it, so one header in a
layout lights the right item everywhere.

**An element's `id` is not its HTML id.** It reaches the DOM as `data-plitzi-el`. For a section a URL can land on, give it
an `anchor` (`anchor: 'plans'` → `id="plans"`: lowercase, digits, `-`) and link to it with `hash`:
`link({ href: 'home', hash: 'plans' })` goes to `/#plans` and scrolls there, waiting for a section that renders once
its data arrives. One anchor per page, layouts included; never inside a list row or a component, which would repeat
it — `authorSpace` refuses each, and a `hash` no element on that page carries (`anchor-missing`). Under a fixed
header, give the section `scroll-margin-top` (the header's height) so it does not land beneath it.

**Some types hold no children.** A `heading`, `text`, `paragraph`, `image`, `formControl`… renders its own attributes
and nothing nested in it — `authorSpace` refuses children there. A heading made of parts (a word in another colour, an
icon, a badge) is a `container` with the heading's tag: `container({ subType: 'h1', class: title, children: [text('Space
'), text('Gamer', { class: accent })] })` — give the texts `display: inline` in their class.
A piece that sits in a line of text without breaking it — a dot before a title, a badge — is
`container({ subType: 'span', … })`: inline by default. It holds words and inline pieces, never a heading or a
paragraph (`span-holds-block`).

**A `button` shows its `content` AND its children.** `content` defaults to "Button": a button whose words are children
says `content: ''` (`default-content-beside-children` warns otherwise). Its accessible name is everything it shows.

**A `formControl` works on its own.** Inside a `form` its value is the form's and it validates on submit; outside one it
keeps its own value and fires `onChange` with `{ value, name }` on every change — a search box or a select that
filters a screen needs no form. Bind `defaultValue` to the state it writes and a reset of that state reaches it.

**A `list` is a `<ul>`, its rows `<li>`s straight inside** — `listItem({ … })`, or `list-row-not-li` warns. It is
indented with space below it: `{ margin: '0px', padding: '0px' }` on its class takes that off.

**A provider has no box unless you give it a tag.** An `apiContainer` renders no element of its own by default, so its
children sit in the parent's layout and a `class` on it styles nothing (`STYLE_WITHOUT_TAG`). Put the layout on the
parent, or give it `attributes: { subType: 'div' }`.

A plugin's type is authored the same way: `defineElement<Props>({ type, … })` — see [plugins](plugins.md).

**What a type takes:** `npx @plitzi/cli explain formControl`, or the exported catalogues ([validation.md](validation.md)).

## CSS

Write CSS as you write CSS, shorthands included — they are expanded to the longhands Plitzi's editor reads. Keys in
kebab-case or camelCase (`paddingTop`, as a React style object), and a bare number on a length is pixels (`gap: 16`;
`fontWeight: 800`, `opacity: 0.5` stay numbers). A property outside the vocabulary is refused.

- `column(gap, extra?)`, `row(gap, extra?)`, `grid(columns, gap, extra?)` for the three layouts every space repeats.
- **Breakpoints are ranges, not a cascade.** `tablet` is 48–64rem, `mobile` up to 48rem, and each inherits only from
  `desktop` — a rule for `tablet` never reaches a phone (`authorSpace` warns `tablet-rule-skips-mobile`). A rule for
  everything narrower than a desktop is `compact`, written to both: `css: { desktop: { … }, compact: { 'grid-template-columns':
  '1fr' }, mobile: { gap: '8px' } }` — what `tablet` or `mobile` say for themselves wins.
- **One property that changes, in place:** `{ fontSize: { desktop: '24px', mobile: '18px' }, fontWeight: 800 }` — the
  rest of the rule stays desktop-only, without splitting it by breakpoint. Both forms mix.
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

- A flat object is the base rules; `{ css, states, variants, ancestors, pseudos, conditions }` when there is more. Each part may be written
  per breakpoint.
- **Share a rule as a class, never as a spread** into each element's `css`: that is one selector per element, so
  restyling one card in the builder restyles one card.
- **Build a family from a plain object**, not by layering classes: `styles('button-primary', { ...buttonBase, … })`.
- Of two classes on an element, the one the stylesheet writes later wins (first met; a breakpoint's after the base),
  not the list's last: write the longhands a class means (`class-overrides-class`).
- One name declared twice with rules that disagree is refused. Declare a class once, in the module that owns it, and
  import it.
- `ancestors: { [sidebar.name]: { variants: { collapsed: { display: 'none' } } } }` styles an element by the state or
  variant of an ancestor class — the way to react to a parent's hover or collapse without a flow; `'>'` is the parent,
  whatever it wears (a component's part: `{ '>': { states: { expanded: … } } }`).
- `pseudos: { after: { content: '"→"' } }` (`before`/`after` need a quoted `content`; also `selection`, `marker`,
  `placeholder`, `first-letter`, `first-line`). `conditions: { 'motion-reduce': …, 'container (max-width: 30rem)': … }`.
- **`hidden` is how an element looks while its `visible` says no** — where it goes as it hides, and where it comes
  from as it shows. Give the class a transition that includes `display` with `allow-discrete`, and a panel fades or
  slides instead of blinking; the transition on the base is the way in, the one in `hidden` the way out:

  ```ts
  const panel = styles('panel', {
    css: {
      transition: 'opacity 220ms cubic-bezier(0.2, 0.9, 0.3, 1.2), transform 220ms cubic-bezier(0.2, 0.9, 0.3, 1.2), display 220ms allow-discrete'
    },
    states: {
      hidden: {
        opacity: '0',
        transform: 'translateY(-6px) scale(0.98)',
        transition: 'opacity 120ms ease-in, transform 120ms ease-in, display 120ms allow-discrete'
      }
    }
  });
  ```

  What is inside follows its container with `ancestors: { [panel.name]: { states: { hidden: { … } } } }` — a
  different `transition-delay` per item staggers them. A container whose children mount only while it shows
  (`loadStrategy: 'visible'`) empties before it can leave: use `'lazy'` on one that animates out.
- **The navigation goes in a layout, once:** a link to the page shown dresses itself with its class's
  `states: { current: { … } }` — never a class picked per page, which copies the header into every page.
- **`:hover` is part of the selector, not a rule in `customCss`.** `customCss` is for what no class can say: a rule
  across two unrelated elements, the inside of a third-party widget.
- Per element TYPE defaults go in `elements: { heading: { base, states, variants, pseudos, slots } }` — a whole type.
- **Slots** are an element's parts (not `customCss`): a `formControl`'s `input` (the box), `field` (its `<input>`),
  `label`, `requiredMark`, `error`; a `markdown`'s or `richText`'s `heading`, `heading2`, `link`, `codeBlockFrame`…;
  a `pagination`'s `page` (the one shown: its `current` state). `plitzi explain <type>` lists them. Style one
  element's with `slots`, a type's with `elements.<type>.slots`.
- A `modalContainer` / `dialogContainer` is fixed to the viewport, as tall as its content up to the screen, and 500px
  wide up to the screen; theme its look through its slots.

**A variant chosen by the data:** `variantFrom(pill, 'jobs.item.status')`, or with a template when the data does not
already speak in variant names — `variantFrom(pill, 'runs.item.status', { template: "{{ source == 'completed' ?
'ok' : 'failed' }}" })`. The binding's key names the CLASS; never write it by hand. A variant while a condition holds
— the dot of the slide on screen — is `activeWhen(dot, '{{ list_dots.index == state.slide }}')` (`active`, else
`idle`); for "the current page", `current` in [layouts.md](layouts.md).

## From Tailwind classes

A design written in Tailwind classes becomes classes the builder edits with `styles('pill', tw('…'))` — see
[tailwind.md](tailwind.md).

## Colours, themes and motion

Every colour is a token with a light and a dark value, read as `var(--name)` (or `tokens(variables)`); keyframes go in
the space's `keyframes` — see [colours-and-motion.md](colours-and-motion.md).
