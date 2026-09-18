---
name: plitzi-authoring
description: >-
  Write a Plitzi space or a publishable template in TypeScript — pages, elements, CSS, data bindings and flows —
  instead of hand-writing schema JSON. Use whenever the task is to create, extend or re-theme a space: adding a
  page or a section, styling one, binding an element to server data, wiring what happens on click, authoring a
  template to host, or turning an exported JSON into something maintainable.
---

# Authoring Plitzi spaces

A Plitzi space is two documents — a schema and a style — of deeply cross-referenced ids. **Do not write them by
hand.** Every id, class name, parent/root link, breakpoint map and interaction chain is derived from a much
smaller declaration, and the surface that derives them also refuses a declaration that would not render.

```ts
import { authorSpace, container, heading, text } from '@plitzi/sdk-authoring';

const { schema, style, warnings } = authorSpace({
  name: 'My space',
  permanentUrl: 'my-space',
  classes: { page: { desktop: { display: 'flex', 'flex-direction': 'column', padding: '96px 24px', gap: '16px' } } },
  pages: [
    { name: 'Home', slug: '', class: 'page', body: [heading('Hello', { subType: 'h1' }), text('A paragraph.')] }
  ]
});
```

Serve it with the adapters the page server already takes:

```ts
createServer({ port: 3001, adapters: createJsonAdapters({ offlineData: { schema, style } }) });
```

One package, and it installs nothing: `@plitzi/sdk-authoring` has an empty dependency tree, no React and nothing
that touches a browser, so a seed, a migration, a build script or a project that only publishes templates depends
on it alone.

## The types are the reference

Every factory, spec field and step builder carries its documentation in the published `.d.ts`. Read it rather
than guessing — `node_modules/@plitzi/sdk-authoring/dist/index.d.ts` is the whole surface in one file. Attribute
types come from each element's own component, so an editor completes them and a wrong value is a compile error.

## Elements

One factory per element, named after it. Attributes and the authoring fields go in ONE flat object:

```ts
heading({ content: 'Fieldnotes', subType: 'h2', class: 'title' })
image({ src: '/fox.jpg', alt: 'A fox', css: { 'aspect-ratio': '3/2' } })
container({ class: 'card', children: [ … ] })
text('Wildlife, close up')      // a string is the content
container([hero, grid])         // an array is the children
```

| Authoring field | What it does |
| --- | --- |
| `id` | the ONE name this element answers to — its key in the document, a binding's source, a step's target. **Name anything something else refers to**: a derived `<type>-<n>` is positional |
| `class` | a shared class: a name from the space's `classes`, or a `styles()` declaration. Exclusive with `css` |
| `css` | rules of this element's own: one set, or one per breakpoint (`{ desktop, tablet, mobile }`) |
| `variant` | a style variant of the element's own vocabulary |
| `slots` | a class for one of the element's OTHER selectors — a form control's `input`, `label`, `error` |
| `bind` | where a value comes from |
| `visible` | show it only while this source is true; `!source` for the inverse |
| `flows` | what happens on click, on submit, on load |
| `runtime` | `'server'` resolves this element's data on the server |
| `children` | the tree |
| `meta` | `meta.label` is the element's name in the builder's tree |

Anything else in the object is an **attribute**. `label` belongs to the attribute (a link and a form control both
have one); the builder's name for the element is `meta.label`.

A type this SDK does not ship — a plugin, one the deployment brings — is authored the same way:

```ts
const speciesStatus = defineElement<{ status?: string }>({ type: 'speciesStatus', content: { … } });
element<{ status?: string }>('speciesStatus', { status: 'vulnerable' });   // or one at a time
elementsFromManifest(manifest);                                            // or a whole plugin manifest
```

## Style

Write CSS the way you write CSS, shorthands included — they are expanded before they reach the document, because
Plitzi's style editor reads a closed list of longhand properties:

```ts
css({ padding: '96px 24px', border: '1px solid var(--line)', 'border-radius': '12px' })
```

You rarely call `css` yourself: `authorSpace` runs every rule set through it. What you get is the refusal — a
property outside the vocabulary is an error naming the correct key (`paddingTop` → `padding-top`).

- `column(gap, extra?)`, `row(gap, extra?)`, `grid(columns, gap, extra?)` for the three layouts every space repeats.
- **Breakpoints are ranges, not a cascade.** `tablet` is 48–64rem and `mobile` is below 48rem, and each inherits
  only from `desktop` — a rule written for `tablet` never reaches a phone. A grid that collapses to one column at
  tablet and should stay collapsed says so in `mobile` too. `authorSpace` warns (`tablet-rule-skips-mobile`) when it
  does not.
- **Fonts are declared, not assumed.** A `font-family` loads only if the space lists the face in `fonts`
  (`{ source: 'google', family: 'Fraunces', fallback: 'Georgia, serif', weights: [400, 600], styles: ['normal'] }`);
  the page server writes exactly that list into the document, and anything else renders in the fallback.
- Per element TYPE defaults go in `elements: { heading: { base: …, states: { … }, variants: { … }, slots: { … } } }`
  — `slots` dresses the type's other selectors (a modal's `rootContainer`) for every element of the type.
- **`:hover` is part of the selector, not a rule in `customCss`.** `styles('card', { css: { … }, states: { hover: { … } },
  variants: { active: { … } } })`, and `states` beside an element's own `css`. Written in `customCss` it renders and
  then cannot be read back or edited per breakpoint.

**Share a rule as a class, never as a spread.** Writing a rule set once in a `const` and spreading it into each
element's `css` shares the source and duplicates the document — one selector per element, so re-theming the card
in the builder re-themes one card. `styles()` declares the class where it is used and writes it once:

```ts
const card = styles('card', { padding: '24px', 'border-radius': '12px', 'background-color': 'var(--surface)' });

container({ class: card, children: [ … ] });
```

Accepted anywhere a class name is — `class`, a `slot`, a page's `class` — and collected from wherever the tree
names it. One name declared twice with rules that disagree is refused. `classes` at the top of the space is the
same mechanism for what describes the space rather than one section of it.

An element has exactly ONE base selector, so a look that never changes is its own class over a shared plain object
(`styles('button-primary', { ...base, … })`), never two classes layered on top of each other. A class's `variants`
are for what the page switches while it runs — a binding with the `styleVariant` transformer picks one.

**Shells go in `layouts`.** A header or a sidebar every page shows is a layout the pages name —
`layout: { id: 'app-shell', slot: 'main' }`, the slot being the element in the shell where the body goes — never a
copy on each page. `visible: false` starts an element hidden for a flow to reveal.

## Data

```ts
heading({ bind: { content: 'posts.title' } })            // short form: attributes
paragraph({ visible: 'posts.hasPosts' })                // on screen only while this is true
paragraph({ visible: '!posts.hasPosts' })               // …and its inverse
container({ bind: [{ to: 'content', source: 'x.y', transformers: [ … ] }] })   // full form
```

**A source names the id you gave the element** — `'posts.title'`, `'postList.item.cover'` — and the prefix is
filled in. Only half of a source name is yours: the other half is the kind of source the ELEMENT publishes, and it
is not always the word you can see (a `form` publishes under `apiContainer`). The four globals — `variables`,
`navigation`, `auth`, `state` — are named as themselves. A full name still works and is checked the same way: a
prefix that does not match the element, or a name nothing answers to, is refused when the space is authored. It
is the quietest failure a space can carry.

Server-resolved sections are an `apiContainer` with `runtime: 'server'` naming a connector or an action, and a
space that has any needs `rsc: { enabled: true }`.

**A provider has no box unless you give it a tag.** An `apiContainer` renders no element of its own while its
`subType` is empty — the default, the builder's "Container Tag: None" — so its children sit directly in the parent's
layout. That is usually what you want (the provider stays invisible to the layout), and it means a `class` or `css`
on it styles nothing: the `gap` you wrote between its sections is simply not there. Put the layout on the parent, or
give the provider a tag (`attributes: { subType: 'div' }`) when it should be the box. `validateSpace` — and so
`authorSpace` and the MCP — warns with `STYLE_WITHOUT_TAG`.

**Never ask the data for a field's opposite.** Both sides of one question are `visible: 'x'` and `visible: '!x'` —
not an `x` and a `notX` beside it in the server's answer. The `!` is the `not` transformer, which reads a boolean
that travelled as text (`"false"`, `"0"`) and treats an empty array as false; an empty object is true. Only for a
real inverse — a three-state condition (`Boolean(post) && !canEdit`) still belongs where the data is made.

## Flows

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

Use the step builders — they answer the three things that go wrong silently:

- **Where a step runs.** A global callback registers under its source MODULE (`state`, `auth`, `actions`), an
  element callback under an element's id, a utility under nothing. The builders fill it in; a trigger and an
  untargeted `updateElement` are filled with the element the flow was declared on.
- **Which `setState`.** `setState(…)` writes `runtime.state.<key>`; `updateElement(…)` changes one element's own
  attribute or state. Different params, different node kind. Each has a flip-it counterpart storing the opposite
  of what is there, which is how expand/collapse is ONE step on ONE trigger: `toggleState({ key })` for app state,
  and `toggleElement({ category: 'state', key: 'visibility' }, 'panel')` to show/hide an element (the second
  argument is the element it acts on; omitted, it acts on the one the flow is declared on). Never two branches
  under opposite `when` guards — those read the state as it was when the flow STARTED, so they run a click behind.
- **What it takes.** Params are typed from the same declaration the builder's own panel is drawn from.

`named(id, step)` is how a later step reads an earlier one — the flow scope is keyed by node id, so
`{{quote.output.summary}}` resolves only when that step is called `quote`. `mode: 'await'` is what puts a run's
answer in the scope at all, and it is the default.

**Pass `input` as an object, not as a line of JSON text.** Both are accepted, and the text form fails silently: an
interpolated value carrying a quotation mark or a newline — a post body, a comment — makes it unparseable, and
unparseable input posts `{}` rather than refusing.

A flow is a list and never a tree, so "only if" is expressed on the step:

```ts
whenSucceeded('quote', navigate({ urlType: 'internal', url: '{{quote.output.url}}' })),
whenFailed('quote', setState({ key: 'notice', type: 'text', value: '{{quote.reason}}' })),
when({ field: 'state.count', operator: '>', value: 3 }, addNotification({ content: 'Enough' }))
```

`whenFailed` matches every outcome that is not `completed` — a run also comes back `skipped` or `aborted`, and
matching only `failed` is how those two end up doing nothing.

## What gets refused

`authorSpace` throws rather than hand back a space that would not render:

- a CSS property the style editor could not read back
- a `class` or a `slot` naming a class the space does not declare (the error names the one you probably meant)
- an element asking for a shared class AND rules of its own — an element has one base selector
- one class name declared twice with rules that disagree
- a binding source naming an element nothing answers to, or one whose prefix is not what that element publishes
- a name that shadows a global data source (`variables`, `navigation`, `auth`, `state`)
- a step target naming an element that is not there
- two elements answering to one name, a broken flow chain, an orphan, a cycle
- a global callback on the wrong module — or on none — and a utility given one. A global callback registers under
  its SOURCE MODULE (`auth`, `state`, `actions`), and the pair is what the runtime resolves a step by, so naming
  either half wrong is a control that does nothing at all with no error anywhere. An action no built-in source
  declares comes back in `warnings` instead of throwing, because a plugin may register a module of its own.

Those last checks need the vocabulary, which only the composed package has. Import `authorSpace` from
`@plitzi/sdk-authoring` — not straight from `@plitzi/sdk-schema` — and you get them.

For documents you did not author here — an export from the builder, a JSON edited by hand — run the same gate
before serving it:

```ts
const { valid, errors, warnings } = validateSpace({ schema, style });
```

## Templates

A template is not a space: it is ONE subtree, the style that dresses it and a name, published as a JSON someone
fetches by URL and drags onto a canvas you will never see.

```ts
import { authorTemplate } from '@plitzi/sdk-authoring';

const { template, warnings } = authorTemplate({
  name: 'Pricing card',
  description: 'A price, a list of features and a call to action.',
  classes: { card: { padding: '24px', 'border-radius': '12px', 'background-color': 'var(--surface)' } },
  root: container({ class: 'card', children: [heading('$19', { subType: 'h3' }), button({ content: 'Start' })] })
});

await writeFile('pricing-card.json', JSON.stringify(template, null, 2));
```

Host that file and add it to a space's resources as an `application/json` — nothing else is required of you.

Everything a space is held to still applies, and two more things apply because a template LEAVES its space:

- **Everything it names, it carries.** A class declared in the space it was cut from does not travel; the element
  keeps the class name, finds no rules wherever it is dropped, and renders unstyled. Declare in `classes` (or with
  `styles()`) every rule the subtree names — `validateTemplate` warns about a name the manifest does not carry.
- **A binding may not point outside the subtree.** A source names an element by id, so binding to a provider
  that stayed behind is dead on arrival — refused. Bring the provider (the `apiContainer`, the `form`) into the
  template, or bind to one of the globals: `variables`, `navigation`, `auth`, `state`.

`validateTemplate(template)` runs the same gate over a manifest you did not author here — one exported by the
builder, or edited by hand — before you publish it.

## From an exported JSON

Never rewrite an exported space by hand. `specFromSpace({ schema, style })` reads it into the spec that authors it,
repairing what an older builder left behind and listing each repair in `corrections`; `specToSource(spec,
{ exportName })` writes that spec as factory calls; `compareSpaces(original, authorSpace(spec))` must list nothing but
what `corrections` explains. The builder's **Export** (and `POST /utils/transform-to-authoring`) does all three. Edit
the code it writes from then on, not the JSON.

## Rules

1. **Never hand-write `flat`, element ids, `styleSelectors`, `beforeNode`/`afterNode`/`flowId`.** They are derived.
   Writing them is how a space half-renders with nothing reporting why.
2. **Name what is referred to.** `id` on any element a binding, a step or a pager addresses.
3. **Read the error.** Every refusal above names the element, the class or the property at fault; it is a bug in
   the declaration, not a reason to work around the check.
4. **Ids are stable.** They are hashes of the path that produced them, so re-authoring an unchanged space writes
   byte-identical documents — a seed can re-run and a diff stays readable.
5. **`warnings` is returned, not printed.** Read it if the space is generated in a build.
