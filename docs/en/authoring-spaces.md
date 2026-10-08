# Authoring spaces in code

A practical guide to writing a Plitzi space as **TypeScript** instead of exported JSON: a page is a tree, a
stylesheet is an object, and everything a document needs but nobody decides — ids, class names, parent and root
links, the breakpoint maps, the linked list a flow is — is derived.

It is the same document either way. A space authored here opens in the builder, is served by SSR and is edited by
the agent exactly like one dragged together by hand. What changes is that you can read it, review it in a diff and
re-theme it.

---

## 1. One import

```ts
import { authorSpace, container, css, heading, image, onClick, setState } from '@plitzi/sdk-authoring';
```

One package, and it installs nothing else: `@plitzi/sdk-authoring` has an empty dependency tree, no React and
nothing that touches a browser. A server, a seed, a migration, a build script, a browser bundle authoring its own
space (see `browser/04-no-server`) and a project that only publishes snippets all depend on that
one name.

Everything it exports is inside it — there is no second place to look:

| Part | What it is |
| --- | --- |
| the CSS vocabulary | `css`, shorthand expansion, `column`/`row`/`grid`, `styles` |
| the element factories | one per element, plus `element`, `defineElement`, `elementsFromManifest`, triggers |
| the interaction vocabulary | what a step can do: `setState`, `navigate`, `runServerAction`, `delay`… |
| the binding transformers | and the shape a declared param has |
| assembly and validation | `authorSpace`, `authorSnippet`, `validateSpace`, `validateSnippet`, the spec types |

It used to be a `/authoring` fragment inside each of five packages, composed at the end. Each fragment read its own
package's internals, which is what keeps a factory honest — but it also meant five places to look for one answer,
and only the composition knew they belonged together. They now live here, and read those internals across a
package boundary instead.

What did NOT come along is the vocabulary the **runtime** declares: an element's declaration primitive
(`elementDeclaration`, `AuthorableAttributes`), the adapter that draws a declared param as a control
(`toInteractionCallback`), the callbacks a source registers. A React component reads those while a page renders, so
they live in `@plitzi/sdk-shared/authoring` — one folder of their own, in the package everything already depends
on. `@plitzi/sdk-authoring` re-exports every one of them, so it is still one import; the dependency arrow points
one way, which is what lets authoring be a package at all.

---

## 2. A space in one screen

```ts
const space: SpaceSpec = {
  name: 'Fieldnotes',
  permanentUrl: 'fieldnotes',

  variables: { color: { brand: { light: '#4422ee', dark: '#8899ff', default: '#4422ee' } } },

  // Rules written once and named. An element reaches one with `class`.
  classes: {
    page: { desktop: { display: 'flex', 'flex-direction': 'column', padding: '96px 24px' } },
    card: { desktop: { 'border-radius': '12px', border: '1px solid var(--line)', padding: '24px' } }
  },

  // What every element of a TYPE looks like before any class applies.
  elements: { heading: { base: { color: 'var(--brand)' }, variants: { title: { 'font-size': '48px' } } } },

  pages: [
    {
      name: 'Home',
      slug: '',
      class: 'page',
      body: [
        heading('Fieldnotes', { subType: 'h1', variant: 'title' }),
        container({ class: 'card', children: [text('Wildlife, close up')] })
      ]
    }
  ]
};

const { schema, style, warnings } = authorSpace(space);
```

`authorSpace` returns the two documents every Plitzi renderer consumes, and throws rather than hand back a space
that would not render. Ids are hashes of the path that produced them, so authoring the same declaration twice
writes byte-identical documents — a seed can re-run without churning what it wrote last time.

### Layouts

A layout is a shell several pages share — the header, the sidebar — written once, so they are the same nodes on every
page rather than a copy per page that drifts. It is a root of its own, never inside a page and never one of them, and
a page names it together with the element inside it where its body goes:

```ts
export const space: SpaceSpec = {
  // …
  layouts: [
    {
      id: 'app-shell',
      body: [container({ id: 'sidebar', children: [ … ] }), container({ id: 'main' })]
    }
  ],
  pages: [{ name: 'Home', slug: '', layout: { id: 'app-shell', slot: 'main' }, body: [ … ] }]
};
```

The slot is checked to be inside the layout: a slot anywhere else renders the shell with the page nowhere in it, and
nothing downstream would say so. A layout may sit inside another one (`layout` on the layout itself), and the page
resolves the chain from the outside in. `folder` files a layout under a page folder in the builder; it routes nothing.

Ids are one namespace for the layout and every page that names it — a helper that builds an element per page
prefixes its ids with the page (`` `${pageId}-foot` ``), and authoring names both places when two elements collide.

**A menu in a layout marks the current page by itself.** The menu is the same nodes on every page, and the link to
the page being shown carries `aria-current="page"`: its class's `current` state says how it looks
(`states: { current: { color: 'var(--foreground)' } }`), with no binding at all. A link that names a query is current
only while the address has it — of `/?window=6h` and `/?window=24h`, the one shown. An entry lit for a section — a
journal and its articles — is `current: 'section'` on the link: current on every page under its path, at a segment
boundary (`/runs` holds `/runs/42`, not `/runsx`), and announced there as `aria-current="true"` rather than `"page"`,
because ARIA's `page` says the link leads to the page itself; the `current` style state selects both. The pages of an
entry that are not under its path are `activeOn(navLink, ['spaces', 'space-record'])`, which binds the class's
`active` variant to `navigation.currentPageId` for those pages and `idle` for every other. The entries themselves are data —
one list of pages (id, slug, title, summary, order) that the menu, the page titles, the meta descriptions and the
"previous / next" links all read — and the pages that share a shape come from one function that takes that entry
and the page's content. This site's own docs are built that way: sixteen pages that used to carry the whole sidebar
each (some 900 elements) are one layout, one list and sixteen calls.

### Components

A block placed many times with different content — a product card, a testimonial — is a **component**: declared once
in `components` and placed with `component(id, { props, children })`. The document holds one tree, so an edit to it, in
code or in the builder, is an edit to every instance. It is closed: inside, it reads `props` (what each instance hands
in, declared like a step's params) and the globals, never the page around an instance.

```ts
components: [{
  id: 'product-card',
  props: { title: { type: 'text', description: 'The product name', required: true } },
  slots: ['product-card-actions'],
  root: container({ id: 'product-card-root', children: [heading({ id: 'product-card-title', bind: { content: 'props.title' } }), container({ id: 'product-card-actions' })] })
}],
pages: [{ name: 'Shop', slug: 'shop', body: [component('product-card', { props: { title: 'Lamp' }, children: [button('Buy')] })] }]
```

An undeclared component or prop, a required prop left out, a value of the wrong kind and a child for a slot the
component does not have are refused by name. How it works underneath is [Components](./components.md).

---

## 3. Elements

Every element has a factory named after it, and its attributes are typed from the element's own component:

```ts
heading({ content: 'Hello', subType: 'h2' });   // subType is 'h1' | … | 'h6', not string
image({ src: '/fox.jpg', alt: 'A fox' });
container({ class: 'card', children: [...] });
```

Attributes and the handful of **authoring fields** go in one flat object. The authoring fields are the same on
every element:

| Field | What it does |
| --- | --- |
| `id` | the ONE name this element answers to — its key in the document, a binding's source, a step's target. Derived positionally (`<type>-<n>`) when left out |
| `class` | a shared class: a name from `classes`, or a `styles()` declaration. Exclusive with `css` |
| `css` | rules of this element's own — one set, or one per breakpoint |
| `variant` | a style variant of the element's own vocabulary |
| `slots` | a class for one of the element's OTHER selectors — a form control's `input`, `label`, `error` |
| `bind` | where a value comes from |
| `visible` | show it only while this source is true; `!source` for the inverse |
| `flows` | what happens on click, on submit, on load |
| `runtime` | `'server'` resolves this element's data on the server |
| `children` | the tree |
| `meta` | what the builder shows — `meta.label` names the element in its tree |

Nothing collides: no element in the catalogue has an attribute called `class`, `css`, `bind` or any of the others,
and a test fails the build if one ever declares one. Two names would otherwise overlap. `label` — which a link and
a form control both carry — belongs to the **attribute**, because that is the one an author means; the tree name is
`meta.label`. And `id`: `nodeHtml` spreads the DOM attributes, so its `id` is excluded from what it can be authored
with — the element's own name has to win, since it is what a binding reads it by.

Two shorthands, for the two things a page is mostly made of:

```ts
text('Wildlife, close up');            // a string is the content
container([hero, grid]);               // an array is the children
```

A `button` and a `link` say their words themselves — `link({ href: 'pricing', content: 'Pricing' })` — with an icon
beside them as `icon` (`'fa-solid fa-arrow-right'`, `iconPlacement: 'before' | 'after'`, styled through the `icon`
slot), and hold children too, with the words `after` them or `before` (`contentPlacement`). A `text` inside instead is an
element more, with a colour of its own that ignores the link's colour and hover (`content-attribute` suggests the
move).

### Elements this SDK does not ship

A type from a plugin, or one a deployment brings itself, is authored the same way:

```ts
// A factory as typed as any built-in one
const speciesStatus = defineElement<{ status?: string; latin?: string }>({
  type: 'speciesStatus',
  content: { definition: { label: 'Species Status' } }
});

speciesStatus({ status: 'vulnerable', class: 'panel' });

// Or, one element at a time
element<{ status?: string }>('speciesStatus', { status: 'vulnerable' });

// Or, every type a published plugin manifest declares
const { chart } = elementsFromManifest<{ chart: { kind?: string } }>(manifest);
```

`defineElement` takes a declaration or a plugin's `pluginSchema` entry — they are the same shape, which is why a
plugin type costs nothing extra to author.

Hand the same declaration to `authorSpace` and the plugin is checked like a built-in element — authored as its own
type, or hosted by `custom({ renderType })`:

```ts
authorSpace(space, { plugins: [declaration] });

speciesStatus({ id: 'status', flows: [[declaredTrigger(declaration, 'onPick'), setState({ … })]] });
button({ flows: [[onClick(), declaredCallback(declaration, 'reset', { on: 'status' })]] });
```

A flow on an event it never fires, a step sent to an action it does not answer and an attribute it does not read are
refused, naming what it does declare. `declaredTrigger` and `declaredCallback` build those steps from the declaration,
so a name it does not have is a compile error. `pluginTypes: ['speciesStatus']` is the lighter form: it says the type
exists and checks nothing about how the space uses it.

---

## 4. Style

Write CSS the way anyone writes CSS. Shorthands are expanded before they reach the document, because Plitzi's
style editor reads a closed list of longhand properties — a `padding` that survives to persistence renders
correctly and then cannot be edited or overridden per breakpoint:

```ts
css({ padding: '96px 24px', 'border-radius': '12px', border: '1px solid var(--line)' });
// → padding-top/right/bottom/left, four corner radii, four widths, four styles, four colours
```

You rarely call `css` yourself: `authorSpace` runs every rule set it is given through it. What you get from that is
the refusal — a property outside the vocabulary is an error at the line that wrote it, with the correct key named:

```
Unknown CSS property: "paddingTop" (did you mean "padding-top"?)
```

Per breakpoint, when a rule set needs it. Anything else is the desktop rules:

```ts
css: { desktop: { 'font-size': '48px' }, mobile: { 'font-size': '30px' } }
css: { 'font-size': '48px' }   // the same, for desktop only
```

`column(gap, extra?)`, `row(gap, extra?)` and `grid(columns, gap, extra?)` are sugar over `css` for the three
layouts every space writes over and over.

### Sharing a rule: `styles()`

There are two ways for two elements to share a rule, and only one of them shares it in the **document**. Writing
the rule set once in a `const` and spreading it into each element's `css` shares the *source*: every element still
gets a selector of its own, so four cards are four identical rules — and re-theming the card in the builder
re-themes one of them. Across this SDK's five demo spaces that idiom accounted for 165 of 320 selectors.

`styles(name, rules)` is the same declaration written where it is used, producing one selector:

```ts
const card = styles('card', { padding: '24px', 'border-radius': '12px', 'background-color': 'var(--surface)' });

const post = (title: string) => container({ class: card, children: [heading(title, { subType: 'h3' })] });
```

It is accepted anywhere a class name is — an element's `class`, a `slot`, a page's `class` — and collected from
wherever the tree names it, so a declaration nothing names writes nothing at all. Two declarations under one name
are fine while they say the same thing and refused when they do not: a class means one rule set per space, never
whichever module the bundler reached first.

`classes` at the top of a space is the same mechanism with the rules gathered in one place, and stays the right
home for what describes the space rather than one section of it. Both end up in the same stylesheet.

### States and variants

A `:hover` and a variant are not classes of their own in Plitzi: they are parts of the **same** selector, which is
what the style editor shows as tabs of one class. Written as a second rule in `customCss` they render, and then
cannot be read back or overridden per breakpoint — so they are declared beside the rules they modify:

```ts
const card = styles('card', {
  css: { padding: '24px', 'background-color': 'var(--surface)' },
  states: { hover: { 'background-color': 'var(--surface-hover)' } },
  variants: { active: { 'border-color': 'var(--accent)' }, muted: { css: { opacity: '0.6' }, states: { hover: { opacity: '1' } } } }
});

container({ css: { color: 'var(--muted)' }, states: { hover: { color: 'var(--foreground)' } } });
```

`states` takes the states the editor has tabs for — `hover`, `focus`, `focus-visible`, `focus-within`, `active`,
`disabled`, `checked`, `visited`, `current`, `expanded`, `hidden`, and where the element sits among its siblings,
`first`, `last`, `odd` and `even` — and each one, like `css`, may be written per breakpoint.
Once a style has `states`, `variants`, `ancestors`, `pseudos` or `conditions`, its own rules go under `css` beside them: rules written next to
`states` are refused (`rule-set-mixed`) rather than read as something else. An element's own `states` sit beside its
own `css`, and are refused next to a shared `class` for the same reason `css` is. An element type's defaults (`elements`) take the same
`states` and `variants`, and `slots` for the type's other selectors — a modal's `rootContainer`, a form control's
`input` — so every element of the type is dressed at once.

`current` is the chosen one of a set: a link to the page being shown (`aria-current="page"`, from the address the page
was rendered at), a pressed toggle (`aria-pressed="true"` — a theme toggle's option, a button with `ariaPressed`) or a
selected tab (`aria-selected="true"`). The element marks itself, which a screen reader announces too, so a header
written once in a layout dresses the right navigation item on every page — no class chosen per page, no copy of the
header per page. A tab panel on show is `current` too (`[role="tabpanel"]:not([hidden])` — the others carry `hidden`),
and every alternative of the selector weighs at most two attributes, so a class's `current` (0,3,0) wins over its
`hover` (0,2,0) wherever the two are written. `expanded` is the control whose panel is open (`aria-expanded="true"`).

`hidden` is not a pseudo-class: it is how an element looks while its `visible` says no — where it goes as it hides
and where it comes from as it shows (it is also written as the element's `@starting-style`). With a transition on the
class that includes `display` and `allow-discrete`, a panel moves in and out instead of blinking; the base's
transition is the way in, the one in `hidden` the way out, so each can have its own pace:

```ts
const panel = styles('panel', {
  css: { transition: 'opacity 220ms ease-out, transform 220ms ease-out, display 220ms allow-discrete' },
  states: {
    hidden: {
      opacity: '0',
      transform: 'translateY(-6px)',
      transition: 'opacity 120ms ease-in, transform 120ms ease-in, display 120ms allow-discrete'
    }
  }
});
```

What is inside follows it through `ancestors` — `{ [panel.name]: { states: { hidden: { … } } } }`. A container whose
items mount only while it is shown (`loadStrategy: 'visible'`) is empty by the time it leaves; one that animates out
takes `'lazy'`. A browser without `@starting-style` or discrete transitions shows and hides it at once, as before.

Which variant an element wears can come from the data — a status pill that is amber while a job waits and green once
it is done. `variantFrom` writes that binding, keyed by the class the element wears:

```ts
const pill = styles('statusPill', { css: { padding: '2px 8px' }, variants: { pending: {…}, succeeded: {…} } });

text({ class: pill, bind: [{ to: 'content', source: 'jobs.item.label' }, variantFrom(pill, 'jobs.item.status')] });
```

The value at the source names the variant; when the data does not already speak in variant names, `template` turns
it into one — `variantFrom(pill, 'runs.item.status', { template: "{{ source == 'completed' ? 'ok' : 'failed' }}" })`,
or `{ template: "{{ source == 'code' ? 'on' : '' }}" }` for a control that lights up when a state names it. Written
by hand the key is the trap: it names the selector the variants
belong to, and the element's type (`text.base`) is a different selector from its class (`statusPill.base`) — the
first renders with no variant at all, and nothing reports it.

### Pseudo-elements, conditions and the parent

What used to need `customCss` beside a class is part of it, in one style language the builder, the MCP and authoring
read and write alike (`StyleBlock` in `sdk-shared`, compiled by `processSelector` in `sdk-style`):

- **`pseudos`** — `before`, `after`, `marker`, `placeholder`, `first-letter`, `first-line`, `selection` (`STYLE_PSEUDOS`),
  each with its states: `.x:hover::after`, the pseudo-element last, where CSS allows it. Authoring refuses what draws
  nothing — a `before`/`after` with no `content`, a `content` without its quotes (`isContentValue`), a property the
  browser drops on that pseudo-element (`PSEUDO_PROPERTIES`).
- **`conditions`** — `motion-reduce`, `motion-safe` and container widths (`container card (max-width: 30rem)`), kept in
  one spelling (`canonicalCondition`) and written after everything else in the class, so they win at the same weight.
  Breakpoints stay what they are: conditions of the whole page, one block each.
- **`ancestors['>']`** — the parent, whatever it wears, by its state alone (`:where([aria-expanded="true"]) > &`):
  what lets a closed component's part answer the element around it without naming that element's class. Only the
  parent: "any ancestor in a state" would match on every hover of the page.

### Motion

Keyframes go in the space's `keyframes` — validated, written as the block `customCss` starts with, where the style
editor reads them back (`splitKeyframesCss`) — and a class names them (`animation: 'marquee 30s linear infinite'`);
one no keyframes declare is warned (`animation-name-unknown`). Animate
`opacity` and `transform`: they keep running while the page hydrates, and anything else — a blur, a shadow, a
`background-position`, a size — repaints on the main thread and stutters with it. A decoration that needs one of
those starts `paused` and runs under `[data-hydrated]`. The whole list is in [Motion](./motion.md).

---

## 5. Data

A binding says where a value comes from. The short form targets attributes, which is what nearly every binding
does:

```ts
heading({ bind: { content: 'posts.title' } })
```

The full form is for everything else — element state, a transformer, a condition:

```ts
paragraph({
  bind: [
    { to: 'content', source: 'cats.count',
      transformers: [{ action: 'twigTemplate', params: { template: '{{source}} cats came back.' } }] }
  ]
})
```

A template over a value is common enough to have its own helper, `bindTemplate(to, source, template, options)`:
`bindTemplate('content', 'cats.count', '{{ source }} cats came back.')`. `{ category: 'style' }` computes a style
property, and `{ returns: 'value' }` hands over what a single `{{ expression }}` evaluates to instead of its text —
the only way to feed a list's `items` a filtered or sorted array (a text template there is refused).

**Whether an element is on screen is its own field, not a binding.** `visible` takes a source, and a leading `!`
inverts it:

```ts
container({ visible: 'cats.hasRecords', children: [ … ] })
container({ visible: '!cats.hasRecords', children: [text('No cats today.')] })
```

Visibility is element STATE rather than an attribute, which is the one binding nobody guesses the category of —
written into `bind` as an attribute it lands on a `visibility` no element reads, so the element stays on screen and
nothing reports it. As a field it cannot be got wrong, and it leaves `bind` free to stay in its short form: a
condition is not an attribute, and pushing one into the list turned every binding beside it into the long one.

It is one field with a `!` rather than a `visible`/`hidden` pair because **`hidden` is a real HTML attribute** —
and in this surface an attribute keeps a name it shares with anything else.

A source names **the id you gave the element**, and the prefix is filled in:

```ts
bind: { content: 'posts.title' }        // → apiContainer_posts.title
bind: { src: 'postList.item.cover' }    // → list_postList.item.cover
bind: { content: 'auth.username' }      // a global: variables, navigation, auth, state, host, theme
```

Only half of a source name is yours. The other half is the kind of source the ELEMENT publishes, and it is not
always the word you can see — **a `form` publishes under `apiContainer`**, because what it offers its descendants
is a record like any other provider's. Assembled by hand from the type you wrote, `form_signup.values` names a
source nothing registers.

Written in full it still works, and is now checked against the same table: a prefix that does not match the
element it names is refused, and so is a name nothing answers to. **Name anything something else refers to** —
derived names are positional, so adding an element above renumbers every one below it and each binding that named
one then points somewhere else without changing.

That is the quietest failure a space can carry — the binding resolves to nothing, the element renders its
placeholder, and every layer below considers the document perfectly valid.

### Showing an element on the opposite of a condition

A binding shows an element when its field is true, so a page that needs both sides of one question used to need
both sides ANSWERED: a `found` and a `missing` beside it, a `signedIn` and a `signedOut`. That is a field per
question whose only reason to exist is the missing word, and it puts "when is this hidden?" in whatever service
produced the data rather than in the page that hides it.

```ts
container({ visible: 'post.found', children: [ … ] }),
container({ visible: '!post.found', children: [text('No such post.')] })
```

`visible: false` is the third answer: the element starts hidden with nothing bound, for a flow to reveal
(`toggleState`, `setState`) — a panel, a confirmation, a second step.

### A condition that has to be computed

An element is visible by default, and which way its condition flips decides how it is written. One the logic
REVEALS — an empty state, a "get started" card, an admin-only panel — starts hidden: `visible` starts the element
HIDDEN and the data then shows it. One a flag HIDES — the labels of a sidebar until it is folded — keeps the default
and an absent flag must leave it shown — `visible: '!state.folded'`, whose inverse of a key nobody has written is
`true`. Once a source has a value, every answer is a yes or a no — `false`, `0`, `''` and an empty list hide it;
while it has none, a plain source or a template answering `''` writes nothing and the element keeps how it started. A revealing condition that is more than one value is `visible: { source, template }` — it waits
hidden like any condition, and the template's answer is read the same way:

```ts
container({
  id: 'first-steps',
  visible: {
    source: 'stats.data.totals',
    template: "{{ source ? (source.spaces > 0 ? 'false' : 'true') : 'false' }}"
  }
})
```

Its template answers `'true'` or `'false'`, and `'false'` while the source has not arrived: an element that shows
until its data lands and then hides is a flash on every load. A visibility binding on its own keeps the element on
screen until it answers — right for "shown until a flag says otherwise", wrong for a condition on data, which is why
`authorSpace` warns `condition-starts-visible` when a computed one starts on screen. Hide the element itself, never a wrapper around it —
a visible wrapper with a hidden child still takes a slot in its parent's `gap`.

An **empty state** is "the answer arrived and is empty", which is not what `!items` says: before the answer,
`!undefined` is true, and "Nothing here yet" shows on every load. Ask for both —
`{{ items is defined and items is empty }}` — or bind to the provider's `isEmpty` together with
`not isLoading`.

The `!` is the `not` transformer, which is available to any binding (`transformers: [{ action: 'not', params: {} }]`).
It reads a boolean that travelled as TEXT — `"false"` and `"0"`, which JavaScript calls true — and treats an empty
array as false. An empty object is true, because a data source answers `{}` both for "no record" and for a record
with no fields.

Only for a real inverse. `cannotEdit: Boolean(post) && !canEdit` is three states, not two — the page shows nothing
at all when there is no post — and a condition like that still belongs where the data is made.

### Feature flags — what a person switches on

Visibility is the page's own logic. What a PERSON decides is switched on — a feature still being built, a version for
beta users, the old checkout kept during a rollout — is a feature flag, declared on the space and named by a gate:

```ts
authorSpace({
  name: 'Shop',
  permanentUrl: 'shop',
  flags: {
    newCheckout: {
      description: 'The one-step checkout',
      value: false,
      rules: [{ when: { combinator: 'and', rules: [{ field: 'user.roles', operator: 'contains', value: 'beta' }] }, value: true }]
    }
  },
  pages: [{ name: 'Checkout', slug: 'checkout', body: [
    container({ id: 'checkout-new', flag: 'newCheckout', children: [ … ] }),
    container({ id: 'checkout-old', flag: '!newCheckout', children: [ … ] })
  ] }]
});
```

A gated element whose flag disagrees is not rendered at all — not a hidden element, no markup and no server data — and
a gated page answers 404. Its declaration still travels with the space's document, so a flag switches a feature off; it
does not keep it secret. `{{ flags.newCheckout }}` reads one anywhere a source is read, a server action included, and
`useFlag('newCheckout')` from a plugin. Above the space, the server rendering it, the SDK embedding it and a tester with
the dev tools may each override a flag the space declares. The whole of it — layers, publishing, the builder — is in
[Feature flags](./feature-flags.md).

---

## 6. Flows

A flow is a list of steps, and each step is a function:

```ts
button({
  id: 'cta',
  content: 'Get a quote',
  flows: [[
    onClick(),
    named('quote', runServerAction({ actionId: 'shipping-quote', input: '{"city":"Berlin"}', mode: 'await' })),
    setState({ key: 'quote', type: 'text', value: '{{quote.output.summary}}' })
  ]]
})
```

Three things go wrong when a step is written as a literal, and the builders answer all three:

- **Where it runs.** A global callback registers under its source MODULE (`state`, `auth`, `actions`), an element
  callback under an element's id, and a utility under nothing at all. A step naming the wrong one resolves to
  no function and the flow silently stops. The builders fill it in; a trigger and an untargeted element callback
  are filled with the element the flow was declared on.
- **Which `setState`.** There are two: the global one writes `runtime.state.<key>`, and `updateElement` changes
  one element's own attribute. They take different params.
- **What it takes.** Params are typed, from the same declaration the builder's own panel is drawn from.

`named(id, step)` is how a later step reads an earlier one: a running flow keeps its scope keyed by node id, so
`{{quote.output.summary}}` resolves only when the step that produced it is called `quote`. Unnamed steps get a
derived id — unique, and nothing you can write down.

What a step puts in that scope is its catalogue's `preview`, so a `when` asking a step of its flow for any other key is
refused (`condition-field-unpublished`): the field is never there, and the rule answers the same whatever happened.
`whenSucceeded` / `whenFailed` read a server action's `status`; a sign-in answers `ok`, and is asked
`when({ field: 'signedIn.ok', operator: '=', value: true }, …)`.

**A source read inside a flow is named in full.** A binding completes the prefix for you (`jobRows.item.id` becomes
`list_jobRows.item.id`); a step's params are templates the runtime reads as written, so there the short name
resolves to nothing — the button posts an empty id and every layer below reports success. `authorSpace` refuses
it and says the full name:

```ts
list({ id: 'jobRows', source: 'controlled', bind: { items: 'board.jobs' }, children: [listItem({ children: [
  button({ content: 'Retry', flows: [[
    onClick(),
    runServerAction({ actionId: 'job-retry', input: { jobId: '{{ list_jobRows.item.id }}' } })  // the row clicked
  ]] })
] })] })
```

The list publishes one scope per row, so `list_jobRows.item` is the row whose button was pressed, not the first one.

A step's params are Twig in full — a condition (`{{ member.isAdmin ? '1' : '' }}`) or a loop runs, as it does in a
binding's template. What a param RESOLVES to is data and is not evaluated again, so text a visitor typed that happens
to contain braces reaches the step as typed. An attribute is the one place that is narrower: it resolves
`{{ name|filter }}` tokens only, because attributes carry prose.
A root that is a step of the same flow is that step's result and is left alone.

### Keyboard shortcuts

`onKey(keys)` starts a flow from the keyboard. It is a trigger every element has, heard on the whole page for as long
as the element is mounted — nobody focuses a map before pressing `+`:

```ts
seismicMap({
  id: 'map',
  flows: [
    [onKey('plus, ='), declaredCallback(declaration, 'zoomIn', { on: 'map' })],
    [onKey('minus'), declaredCallback(declaration, 'zoomOut', { on: 'map' })],
    [onKey('escape'), setState({ key: 'selectedId', type: 'text', value: '' })]
  ]
});
```

`keys` is one shortcut or several with commas: a character (`'f'`, `'?'`, `'+'`), a key's name (`escape`, `space`,
`arrowup` or `up`, `enter`, `f1`…) and modifiers before it (`shift+f`, `alt+1`, `mod+k` — ⌘ on a Mac, Ctrl
elsewhere). Shift counts for a letter and not for a symbol, which is typed with whatever the keyboard needs. A press
while somebody types in a field is the field's, unless Ctrl, ⌘ or Alt is held or the key is Escape — and even then
the field keeps its own editing (⌘A, ⌘Z, ⌘C/⌘V, moving and deleting by word), so `mod+a` bound to "select all
shapes" never steals "select this text"; a press that matches is the shortcut's alone, so an arrow bound to a flow no longer scrolls the page. `{{ <step>.key }}` is the key
pressed, for one flow answering several. A shortcut that cannot fire — two keys, only modifiers, a name that is not a
key — is refused where it is written, and `lintSpace` reports one written in the builder (`trigger-keys`).

### What a step reads

**Each step reads the page as it is when that step runs** — not as it was when the trigger fired. A `when` or a
`{{ state.x }}` after a `setState` sees the new value; one after a `delay`, a server action or anything else that
waits sees whatever changed meanwhile, including what the person using the page did. `computed` values are evaluated
again for each step, over the state as it is then.

That is what makes a flow that waits say what it means:

```ts
// Delete, with five seconds to take it back: the Undo button beside it only clears `pendingDelete`.
button({
  id: 'delete',
  content: 'Delete',
  flows: [
    [
      onClick(),
      setState({ key: 'pendingDelete', type: 'text', value: '{{ list_rows.item.id }}' }),
      delay(5000),
      // Read after the wait: if Undo was pressed meanwhile, `pendingDelete` is empty and nothing is deleted.
      when(
        { field: 'state.pendingDelete', operator: '=', value: 'list_rows.item.id', isBinding: true },
        runServerAction({ actionId: 'row-delete', input: { id: '{{ list_rows.item.id }}' } })
      )
    ]
  ]
});
```

`isBinding: true` compares the field with another path rather than with a literal.

While a flow runs, the same trigger on the same element does not start it again — a second click on Delete during
those five seconds is ignored, which is what keeps a double click from submitting twice. That is the trigger's
`whileRunning`, and `skip` is its default; `queue` and `parallel` are for a trigger that must never lose a firing, and
`latest` for one where only the newest firing matters:

```ts
flows: [[whileRunning('queue', named('arrived', on('onArrival'))), addNotification({ … }), …]]
```

| `whileRunning` | A firing while the flow runs |
| --- | --- |
| `skip` (default) | is ignored — a button that submits |
| `queue` | runs after the one in progress, in order — a stream of events, each announced |
| `parallel` | runs at once, beside it — independent firings that do not touch the same state |
| `latest` | stops the one in progress and runs — a search as you type. The stopped run starts no further step, and the step it waits on is told to stop: a server action is cancelled (on the server too), a request aborted |

It is per flow: two flows on the same click are two things, and one still running says nothing about the other.

To act on the value from BEFORE a write, put the step that reads it first. Two branches under opposite `when`
guards cannot toggle a value — the second sees what the first wrote and flips it back; `toggleState` does it in one
step.

### Cached requests

An `apiContainer` that reads from the browser asks for its data every time it is shown, unless its author opts
into the page's query cache with `cache: true`. Cached, an answer is kept for `staleTime` seconds (30 unless the
element says otherwise; `0` asks on every mount) and shared by every cached provider asking the same thing — same
URL, method, credentials and headers. Moving between sections or pages inside that window costs no request. Past it
the answer is still drawn at once, and a fresh one is fetched behind it. An answer nobody is showing is kept for
`gcTime` seconds (300 by default) before it is forgotten.

```ts
apiContainer({ id: 'orders', query: '/api/orders', cache: true, staleTime: 60 })
```

A cached answer stops counting as current before its time — it stays on screen until the new one lands — when:

- the element's own `performQuery` runs — it always asks again;
- a flow runs `invalidateQueries()`. `invalidateQueries({ elements: ['orders'] })` narrows it to the containers
  with those ids — a container is named by its id, so a request whose URL is a template is still easy to reach —
  and `invalidateQueries({ url: '/api/orders' })` to the requests whose URL starts with that. Providers on screen
  ask at once, the rest when they are next shown;
- a write succeeds. Both write steps say what they refresh with `invalidateQueries`: a `webHook` sent with anything
  but `GET`/`HEAD` refreshes the requests to its own site by default (`'origin'`), a completed `runServerAction`
  refreshes all of them by default (`'all'`, since only the server knows what an action touched), and either can
  name containers instead (`'elements'` with `invalidateElements: ['orders', 'members']`) or nothing (`'none'`, for a
  step that only reads). A `writeRecord` refreshes them all;
- the visitor signs in, signs out or changes account. This one does not wait: whatever was held for the previous
  visitor is dropped at once, and every provider on screen loads again.

A server-driven provider (`runtime: 'server'`) is never in that cache — its answer comes in the RSC payload — and the
same invalidations reach it all the same: by its id, by `url` when it reads nothing but a `query`, and with
everything. It asks the page server for its own slice again, hidden ones when they are next shown, and asks around
the caches on the way (`Cache-Control: no-cache`): outside `main`, `/_rsc` keeps an answer for `rsc.cacheTtlMs`, and
served from there a refresh after a write is the slice from before it. Its own `performQuery` and `writeRecord` ask
the same way; a page of a "load more" and a `refreshSeconds` timer do not — the cache's lifetime is how stale the
deployment lets an answer be.

A `webHook` that reads can use the same cache: `webHook({ url, cache: true, staleTime: 60 })` answers from it while
the answer is fresh, and shares it with any container asking the same thing.

```ts
button({
  flows: [[
    onClick(),
    webHook({ url: '/api/members', method: 'post', body: { email: '{{form.values.email}}' },
      invalidateQueries: 'elements', invalidateElements: ['members'] })
  ]]
})
```

### Keeping a provider current

A page that shows something still moving — a queue, a feed, a status board — sets `refreshSeconds` on its provider,
and it asks again on its own that often:

```ts
apiContainer({ id: 'board', runtime: 'server', action: 'queue-board', refreshSeconds: 2 })
```

It works for either runtime: a browser request is sent again, a server provider asks the server for its own slice
again — through the caches, so outside `main` an answer can be up to `rsc.cacheTtlMs` old. It pauses while the tab is hidden and never starts a refresh while
the last one is still in flight. `0`, the default, never does.

While a provider is asked again its `isLoading` is true, in either runtime. A server provider asks one question at a
time: asking for what is already in flight joins that request, and a newer question drops the one it would overwrite
— aborted in the browser and on the server, so a slow answer never lands over a newer one. `cancelQuery`
(`cancelApi('orders')` in code) is that drop on purpose: a STOP button for a slow report; what is shown stays. A
server provider's `input` bound to the visitor's state asks again whenever it changes, as a bound `query` does.

A link to a page with server data asks for that page's data before it goes (and only then: arriving does not ask
again). Meanwhile the `navigation` source says `pending: true` and `pendingLocation`; a second link clicked before the
first went drops the first, which never goes.

A refused request (`4xx`/`5xx`) is shown but never kept. Server-driven providers (`runtime: 'server'`) are not
part of this: their data arrives with the page. The dev-tools' Store tab lists what the cache holds under
"Queries", with how long each answer has left and a button to expire it.

### State that outlives a visit

`settings: { keepState: true }` keeps `runtime.state` — what `setState` writes — across reloads, in the browser's
storage and under whoever is signed in. `transientState` lists the keys never kept: a filter, a panel left open.

Web storage is the browser's alone, so what was kept comes back after hydration: the server paints the space's
defaults, and the page swaps in what the visitor chose a moment later. For what the first paint SHOWS — the tool a
toolbar shows as last picked, a name in an avatar — list the keys in `paintedState`:

```ts
settings: { keepState: true, paintedState: ['toolPick', 'name'], transientState: ['panelOpen'] }
```

They are kept in a cookie as well. The server renders with them and hands the page the same values as its starting
state, so nothing is swapped; the HTML cache is keyed by that cookie. Small values only — it travels with every
request, and past a few kilobytes it is not written (the dev-tools say so). Never a secret, and never a key that is
also transient. The cookie carries its owner like the kept state does: written by another account, the page drops
what it rendered with it as soon as auth has settled.

### Visitors who sign in, and what they may do

A space whose visitors sign in with their Plitzi account says so, and declares what each of its roles gives:

```ts
settings: { userProvider: 'server', visitorRoles: { author: ['postPublish'], editor: ['postPublish', 'postEdit'] } }
```

`userProvider: 'server'` signs people in through the page server — a link to `/auth/sign-in?return=/` (`mode:
'external'`, a real navigation) sends them to sign in and brings them back signed in on the space's host; `authLogout`
ends it. The roles are published and exported with the space; an action's `access: 'role'` and a page's `can()` ask for
the permissions. `authorSpace` refuses a role or a permission that is not a plain name, a role with no permissions and
a permission named twice. Who holds each role is given by email in the builder, never written into the space.

### Pages that see each other

When "every few seconds" is too slow — cursors, presence, a shared board — the space declares `channels` and a page
subscribes with a `channel` element; a server action announces what it saved with `realtime.publish`. A topic no
declared pattern matches is refused here, naming the patterns (`channel-topic` in `lintSpace`); a topic of a private
(`grant: true`) channel with no `grant` bound is reported too (`channel-grant`). See
[Realtime channels](./realtime.md).

---

## 7. What is refused

`sdk-schema` is the only thing in the SDK that writes a schema document, and it is the only thing that says
whether one is valid. Everything else — the style vocabulary, the element factories, the step builders — produces
inert specs. That is what keeps every guarantee about the finished document in one place.

`authorSpace` puts its own output through the same gate anything else goes through. It reports everything it cannot
write in one run — a `SpaceRefusedError` whose `refusals` each carry the line that wrote the element, the nearest named
element and a **code**. Every refusal and warning has one: `AUTHORING_CODES` (exported) is the table they are raised
from — whether each is refused or warned, what was wrong and what to write instead — and the skill's
`reference/authoring-errors.md` is generated from it (`yarn generate:authoring-errors` in `sdk-authoring`), so a code
cannot be missing from the page. It refuses:

- a CSS property the style editor could not read back
- a `class` or a `slot` naming a class the space does not declare (with the name you probably meant)
- an element asking for a shared class AND rules of its own — an element has one base selector
- one class name declared twice with rules that disagree
- a binding source naming an element nothing answers to, or one whose prefix is not what that element publishes
- a flow's params or a binding's template reading an element's source by its short name (`{{ jobRows.item.id }}`
  for `list_jobRows`, `{{ stats.total }}` for `apiContainer_stats`) — a template is read as written
- a template the interpreter would read past: an operator it does not implement (`matches`), a filter or a function
  it does not have, a stray character, an unclosed bracket or tag
- a name in a binding's template or an attribute's token that nothing answers to, or a source read from outside the
  element that publishes it (a query parameter is `navigation.queryParams.<name>`)
- a template feeding an attribute that holds a list or an object (`items`) that renders text
- children on a type that holds none (`heading`, `text`, `image`, `formControl`…) — a heading made of parts is a
  `container` with an `h1`–`h6` tag, and a piece inline in it a `container` with `subType: 'span'`
- a name that shadows a global data source (`variables`, `navigation`, `auth`, `state`, `host`, `theme`, `flags`,
  `computed`)
- a `flag` that is not a flag name, a gate on a flag the space does not declare (`flag-undeclared`), a template reading
  one (`flag-unknown`), and a declaration whose `value` or a rule's is not `true` or `false`
- a step target naming an element that is not there
- two elements answering to one name — the error says where the first one was written
- a flow whose chain points at a node that is not there
- everything `validateSchema` already checked: orphans, cycles, broken parent/root links, pages

And it returns `warnings` for what is written and will not do what it says — `unknown-attribute`,
`condition-starts-visible` (a computed visibility that would show until its data answers), `template-never-resolved` (a condition in an ATTRIBUTE, which only resolves `{{ name|filter }}` tokens — against the sources around the element; conditions
belong in a binding's template or a step's params, where Twig is evaluated in full), `state-key-has-runtime-prefix`,
`FORM_SUBMIT_UNMANAGED`, `STYLE_WITHOUT_TAG`, `tablet-rule-skips-mobile` (write the rule under `compact` to reach
both; a rule the phone hides with `display: none` is left alone), `span-holds-block` (a `container` with
`subType: 'span'` holding a heading, a paragraph, a list, a form or prose), `default-content-beside-children` (a `button` whose placeholder "Button" would print beside its children),
`flag-unused` (a declared flag nothing gates on or reads) and `flag-rule-empty` (a flag rule with no conditions, which
is skipped rather than read as "always").

Documents you did NOT author here go through the same door:

```ts
import { validateSpace } from '@plitzi/sdk-authoring';

const { valid, errors, warnings } = validateSpace({ schema, style });
```

Worth running over an export from the builder, a JSON somebody edited by hand, or anything a self-hosted
deployment is about to serve.

### What could be shorter: suggestions

A space can be right and still be two or three times the size it needs: the same header written into every page, the
same card copied with other words, a `text` inside every button. Nothing there is refused or warned — it renders — but
every copy is an element to read and a place the next edit has to be made again. `authorSpace` also returns
`suggestions`, the shorter way to the same page, the ones that save the most elements first:

```ts
const { suggestions } = authorSpace(space);
// [{ code: 'repeated-on-pages', saves: 57, at: 'src/pages/docs.ts:291', elementIds: [...], message: '4 pages carry…' }]
```

| Code | Written the long way | The short way |
| --- | --- | --- |
| `repeated-on-pages` | One block at the edge of several pages, the same or styled per page | A layout holding it once; a link marks its own page with the `current` state |
| `repeated-shape` | One structure written again with other words | A component with props, or one `list` when the copies are sibling rows of data — never for siblings that read different sources or write different state keys, which are controls written alike |
| `content-attribute` | A `button` or `link` whose only child is a `text` | The element's own `content` |
| `custom-css-class` | `customCss` rules a class's `states` and `ancestors` say | Those, on the class |
| `custom-css-sdk-default` | A reduced-motion reset, or the theme toggle's icons, in `customCss` | Nothing: the SDK does both |
| `custom-css-notifications` | `.Toastify__*` rules in `customCss` — the toast, its icon, close button or progress bar | The space's `notifications` |
| `heavy-animation` | Keyframes animating a size, a position, a blur, a shadow, or a colour in a loop | `opacity` and `transform`; decoration held until `[data-hydrated]` — see [Motion](./motion.md) |
| `unused-class`, `unused-token`, `unused-component` | A class, token or component nothing wears, reads or places | Removed — or used where it was meant to go |
| `literal-colour` | A class painted from the palette typing out a token's light value | `var(--token)` to follow the scheme; a token of one value when it must stay the same in both |
| `class-overrides-class` | One class's shorthand (`padding`) erasing a longhand another class on the element writes out, because the stylesheet writes it later — first met, or a breakpoint's — whatever the class list says | The longhands it means. Read while authoring only: the document keeps longhands, so the builder and the MCP cannot tell |

A suggestion never blocks: it is advice, not the publish gate, and copies about to diverge are a reason to leave it.
Left on purpose, it is quieted where it is written — `quiet: ['repeated-shape']` on an element it is about, a
component's instance included (`component(id, { quiet })`) — so it stops burying the ones that matter. It is kept in the
document (`definition.quiet`) and read by `suggestSpace`, so the builder's list and the MCP leave out the same ones; the
MCP writes it with `quiet` on an element op. `quiet` takes only suggestions' codes (`quiet-unknown`).
`suggestSpace({ schema, style })` gives the same list for a document authored anywhere; the MCP server's
`plitzi_apply` (a `dryRun` too) answers with the ones a batch opened up (never again the ones the space already
had — a suggestion about declarations names them in `subjects`, so a class a batch left unused is new beside the old
ones), and `npm run author` prints them under the warnings. The skill's `reference/efficiency.md` is the agent's version
of this table, with the rules that cost styles rather than elements.

---

## 8. Agents

An agent working in a consumer's project sees only what npm installed — not this repository. Everything it needs
is inside the packages:

- **The types.** Every factory, spec field and step builder carries its documentation in the published `.d.ts`,
  and it is one file: `node_modules/@plitzi/sdk-authoring/dist/index.d.ts`. Attribute types come from each
  element's own component, so `subType: 'h7'` is a compile error in the consumer's project, not a page that
  renders wrong.
- **The skill.** `@plitzi/sdk-authoring` ships this guidance as an Agent Skill, so it installs with the package —
  and `@plitzi/sdk-server` ships the same file, so a self-hoster finds it without knowing the authoring package
  exists:

  ```bash
  cp -R node_modules/@plitzi/sdk-authoring/skills/plitzi-authoring ~/.claude/skills/
  ```

---

## 9. Snippets

A **snippet** is the other artefact this surface produces, and it is not a space — nor a component, which stays
linked to every place it renders, where a dropped snippet is a copy (see `components.md`, *Components and snippets*):
one subtree, the style that dresses it and a name, published as a JSON. Somebody fetches it by URL, it appears in the builder's **Assets → Files**, and dragging it onto a canvas instantiates a copy of the subtree in a space you never see.

```ts
import { authorSnippet } from '@plitzi/sdk-authoring';
import { writeFile } from 'node:fs/promises';

const { snippet, warnings } = authorSnippet({
  name: 'Pricing card',
  description: 'A price, a list of features and a call to action.',
  classes: {
    card: { display: 'flex', 'flex-direction': 'column', gap: '16px', padding: '24px', 'border-radius': '12px' },
    price: { 'font-size': '40px', 'font-weight': '700' }
  },
  root: container({
    class: 'card',
    children: [heading('$19', { subType: 'h3', class: 'price' }), text('per month'), button({ content: 'Start' })]
  })
});

await writeFile('pricing-card.json', JSON.stringify(snippet, null, 2));
```

That file is the whole deliverable. Host it anywhere, and add it to a space as an `application/json` resource —
uploading it lands it in `snippets/` on that space's CDN, and **Assets → Files** picks it up from there.

`root` is a single element and its subtree: the root is the snippet's `baseElementId`, so nobody writes an id.
Everything else — `classes`, `elements`, `variables`, `schemaVariables` — is declared exactly as a space declares
it, and for the same reason it matters more here: **what the snippet names, the snippet has to carry**.

Two checks exist only for snippets, because a snippet leaves the space it was written in:

| Refused / warned | Why |
| --- | --- |
| a binding whose source is outside the subtree | the element publishing it stays behind, so the binding resolves to nothing wherever the snippet lands — bring the provider into the snippet, or bind to a global (`variables`, `navigation`, `auth`, `state`) |
| a class named but not carried (warning) | the element keeps the class, finds no rules in the space it was dropped into and renders unstyled |
| a page inside a snippet | a snippet is a subtree dropped onto a canvas; a page has nowhere to go |
| a base element with a parent | the base element is the root of what travels |

For a manifest authored elsewhere — exported by the builder, edited by hand — the same gate runs on its own:

```ts
const { valid, errors, warnings } = validateSnippet(snippet);
```

The builder's own "save as snippet" is the other direction and does not go through `authorSnippet`: it starts
from a live schema and cuts a subtree out of it (`FlatMap.flatAsSnippet`), which is a different question — which
of a space's rules and variables belong to this subtree — from the one here, where the answer is simply everything
the declaration carries. Both produce the same artefact, and `validateSnippet` reads either: a definition, the
elements and their variables (`schema.flat`, `schema.variables`), and the style — nothing else of a space travels.

### Dropped into a space

A snippet lands in a space that has names of its own, and **nothing the space already holds is changed by it**:

| What the snippet brings | Where the space already has that name |
| --- | --- |
| an element id | the snippet's element is renamed (`hero` → `hero-2`), and everything in the snippet that pointed at it follows |
| a class | kept and shared when it says the same; otherwise the snippet's is renamed (`card` → `card-2`), on its rule, on the elements that wear it and wherever another of its rules names it as an ancestor — the space's own `.card` is never restyled |
| a rule for an element type | the space's is kept: how every text of the space looks is the space's |
| a token (`variables`) | the space's is kept; one the space lacks is added |

The names are fitted once, where the snippet is dropped (`fitSnippet`, `@plitzi/sdk-schema/helpers/fitSnippet`),
and the editor, the server and every collaborator insert the same ones; the style is added by one rule on all of
them (`mergeSnippetStyle`, `@plitzi/sdk-shared/style/snippetStyle`). A name taken by someone else in between is
refused rather than stored under another one.

## 10. From a document back to code

A space that already exists — exported from the builder, or checked in as JSON — can be read back into the spec that
authors it:

```ts
import { authorSpace, compareSpaces, specFromSpace, specToSource } from '@plitzi/sdk-authoring';

const { spec, corrections } = specFromSpace({ schema, style });
const files = specToSource(spec, { exportName: 'mySite', split: true }); // { 'index.ts': …, 'pages/home.ts': … }
const differences = compareSpaces({ schema, style }, authorSpace(spec)); // [] when nothing observable changed
```

`specToSource` writes what a person would: one factory call per element, the attributes its type already defaults to
left out, stored longhands written back as `padding: 10px 20px`, and each class something names as a `styles()`
declaration held in a variable. A selector only one element uses becomes that element's own `css`; one that is shared,
or spelled out anywhere in the document (a `customCss` rule, a template), stays a class under its own name. An id
nothing refers to is left out and derived again; one that anything names is kept. The output is valid but unformatted
— run it through your formatter.

What an older builder left behind is **repaired, and every repair is reported** in `corrections`: element types that
no longer exist, a hover stored as a class of its own, fields and attributes nothing reads (the attributes an element
takes are `elementAttributeNames`, generated from its types), a link `target` spelled with its underscore, a binding
to a source nothing publishes, a flow with a step that runs nothing, a global callback on the wrong module. A CSS
property the style editor cannot hold is kept in `customCss` under the same selector, so the page still renders it.

`compareSpaces` is the proof. Author the spec again and every observable difference is listed — the tree, the
attributes, the rules that apply to each element whatever its selector is called, bindings, flows, pages, layouts,
settings — and each one should be a repair `corrections` named.

In the builder, **Export** does all three for the space on screen: a JSON copy (`{ schema, style }`), or the
TypeScript — one file to copy into an editor, or a `.zip` with a file per page and layout — with the repairs listed
beside it. It is served by `POST /utils/transform-to-authoring` on the server role, which takes `{ schema, style }`
and answers `{ exportName, files, corrections, differences }`.

## 11. Where to look

| Example | What it shows |
| --- | --- |
| [`examples/shared-space/space.ts`](../../examples/shared-space/space.ts) | the whole shape, small: a page, a palette, a stylesheet |
| [`examples/self-hosting/03-sessions`](../../examples/self-hosting/03-sessions) | two pages on one path, and an auth flow |
| `plitzi-sdk-server/prisma/seeds/spaces/examples/shippingQuote` | a form that runs a server action — whose step is the space's own function — and shows the answer |
| `plitzi-sdk-server/prisma/seeds/spaces/demo/blog` | six pages, a custom element, visitor roles, bindings throughout |
| `plitzi-sdk-server/prisma/seeds/spaces/demo/saasLanding/pricingCard.ts` | a snippet: one subtree and the style it carries, uploaded to a space's CDN |
| `plitzi-sdk-server/prisma/seeds/spaces/demo` | the demo spaces, seeded on every deployment — `comingSoon` read back from JSON with `specFromSpace`, the others written by hand |
