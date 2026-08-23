---
name: plitzi-authoring
description: >-
  Write a Plitzi space in TypeScript — pages, elements, CSS, data bindings and flows — instead of hand-writing
  schema JSON. Use whenever the task is to create, extend or re-theme a space served by @plitzi/sdk-server:
  adding a page or a section, styling one, binding an element to server data, wiring what happens on click, or
  turning an exported JSON into something maintainable.
---

# Authoring Plitzi spaces

A Plitzi space is two documents — a schema and a style — of deeply cross-referenced ids. **Do not write them by
hand.** Every id, class name, parent/root link, breakpoint map and interaction chain is derived from a much
smaller declaration, and the surface that derives them also refuses a declaration that would not render.

```ts
import { authorSpace, container, heading, text } from '@plitzi/sdk-server/authoring';

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

The same surface is exported from `@plitzi/plitzi-sdk/authoring` for a browser bundle. Both are free of React and
of anything a Node script cannot load.

## The types are the reference

Every factory, spec field and step builder carries its documentation in the published `.d.ts`. Read them rather
than guessing — `node_modules/@plitzi/sdk-elements/dist/authoring/`, `.../sdk-schema/dist/authoring/types.d.ts`
and `.../sdk-style/dist/authoring/`. Attribute types come from each element's own component, so an editor
completes them and a wrong value is a compile error.

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
| `idRef` | the name the rest of the space calls this element by. **Name anything something else refers to** — derived refs are positional |
| `class` | a shared class: a name from the space's `classes`, or a `styles()` declaration. Exclusive with `css` |
| `css` | rules of this element's own: one set, or one per breakpoint (`{ desktop, tablet, mobile }`) |
| `variant` | a style variant of the element's own vocabulary |
| `slots` | a class for one of the element's OTHER selectors — a form control's `input`, `label`, `error` |
| `bind` | where a value comes from |
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
- Per element TYPE defaults go in `elements: { heading: { base: …, variants: { … } } }`.

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

An element has exactly ONE base selector, so a variant is its own class over a shared plain object
(`styles('button-primary', { ...base, … })`), never two classes layered on top of each other.

## Data

```ts
heading({ bind: { content: 'posts.title' } })                                 // short form: attributes
paragraph({ bind: [visibleWhen('posts.hasPosts')] })                          // full form: state, transformers, conditions
```

**A source names the idRef you gave the element** — `'posts.title'`, `'postList.item.cover'` — and the prefix is
filled in. Only half of a source name is yours: the other half is the kind of source the ELEMENT publishes, and it
is not always the word you can see (a `form` publishes under `apiContainer`). The four globals — `variables`,
`navigation`, `auth`, `state` — are named as themselves. A full name still works and is checked the same way: a
prefix that does not match the element, or an idRef nothing answers to, is refused when the space is authored. It
is the quietest failure a space can carry.

Server-resolved sections are an `apiContainer` with `runtime: 'server'` naming a connector or an action, and a
space that has any needs `rsc: { enabled: true }`.

**Never ask the data for a field's opposite.** A binding shows an element when its field is true, so both sides of
one question are `visibleWhen(x)` and `hiddenWhen(x)` — not an `x` and a `notX` beside it in the server's answer.
`hiddenWhen` is `visibleWhen` plus the `not` transformer, which reads a boolean that travelled as text (`"false"`,
`"0"`) and treats an empty array as false; an empty object is true. Only for a real inverse — a three-state
condition (`Boolean(post) && !canEdit`) still belongs where the data is made.

## Flows

```ts
button({
  idRef: 'cta',
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
  element callback under an element's idRef, a utility under nothing. The builders fill it in; a trigger and an
  untargeted `updateElement` are filled with the element the flow was declared on.
- **Which `setState`.** `setState(…)` writes `runtime.state.<key>`; `updateElement(…)` changes one element's own
  attribute. Different params, different node kind.
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
- a binding source naming an idRef nothing answers to, or one whose prefix is not what that element publishes
- an idRef that shadows a global data source (`variables`, `navigation`, `auth`, `state`)
- a step target naming an element that is not there
- two elements answering to one idRef, a broken flow chain, an orphan, a cycle
- a global callback on the wrong module — or on none — and a utility given one. A global callback registers under
  its SOURCE MODULE (`auth`, `state`, `actions`), and the pair is what the runtime resolves a step by, so naming
  either half wrong is a control that does nothing at all with no error anywhere. An action no built-in source
  declares comes back in `warnings` instead of throwing, because a plugin may register a module of its own.

Those last checks need the vocabulary, which only the composed entry has. Import `authorSpace` from
`@plitzi/sdk-server/authoring` or `@plitzi/plitzi-sdk/authoring` — not straight from `@plitzi/sdk-schema` — and
you get them.

For documents you did not author here — an export from the builder, a JSON edited by hand — run the same gate
before serving it:

```ts
const { valid, errors, warnings } = validateSpace({ schema, style });
```

## Rules

1. **Never hand-write `flat`, element ids, `styleSelectors`, `beforeNode`/`afterNode`/`flowId`.** They are derived.
   Writing them is how a space half-renders with nothing reporting why.
2. **Name what is referred to.** `idRef` on any element a binding, a step or a pager addresses.
3. **Read the error.** Every refusal above names the element, the class or the property at fault; it is a bug in
   the declaration, not a reason to work around the check.
4. **Ids are stable.** They are hashes of the path that produced them, so re-authoring an unchanged space writes
   byte-identical documents — a seed can re-run and a diff stays readable.
5. **`warnings` is returned, not printed.** Read it if the space is generated in a build.
