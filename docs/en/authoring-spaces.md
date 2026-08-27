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
import { authorSpace, container, css, heading, image, onClick, setState } from '@plitzi/sdk-server/authoring';
```

The surface is assembled from the packages that own each piece of it, and re-exported whole from two places:

| Import from | For |
| --- | --- |
| `@plitzi/sdk-server/authoring` | a server, a seed, a migration, a build script — anything running in Node |
| `@plitzi/plitzi-sdk/authoring` | a browser bundle authoring its own space (see `05-with-server-actions/03-no-server`) |

Both export the same names, and a test in `sdk-server` fails if they ever stop doing so. Nothing in either one
loads React, so importing it from a seed costs a few hundred kilobytes of data and no renderer.

Under those two entries the pieces live with what they describe, and can be imported directly when only one is
wanted:

| Fragment | Owns |
| --- | --- |
| `@plitzi/sdk-style/authoring` | the CSS vocabulary: `css`, shorthand expansion, `column`/`row`/`grid`, `styles` |
| `@plitzi/sdk-elements/authoring` | a factory per element, `element`, `defineElement`, triggers, `updateElement` |
| `@plitzi/sdk-interactions/authoring` | what a step can do: `setState`, `navigate`, `runServerAction`, `delay`… |
| `@plitzi/sdk-shared/authoring` | the shape a declared param has, and the binding transformers |
| `@plitzi/sdk-schema/authoring` | assembly and validation: `authorSpace`, `validateSpace`, the spec types |

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
| `idRef` | the name the rest of the space calls this element by. Derived positionally when left out |
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
and a test fails the build if one ever declares one. The single name that overlaps — `label`, which a link and a
form control both carry — belongs to the **attribute**, because that is the one an author means.

Two shorthands, for the two things a page is mostly made of:

```ts
text('Wildlife, close up');            // a string is the content
container([hero, grid]);               // an array is the children
```

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

A source names **the idRef you gave the element**, and the prefix is filled in:

```ts
bind: { content: 'posts.title' }        // → apiContainer_posts.title
bind: { src: 'postList.item.cover' }    // → list_postList.item.cover
bind: { content: 'auth.username' }      // a global: variables, navigation, auth, state
```

Only half of a source name is yours. The other half is the kind of source the ELEMENT publishes, and it is not
always the word you can see — **a `form` publishes under `apiContainer`**, because what it offers its descendants
is a record like any other provider's. Assembled by hand from the type you wrote, `form_signup.values` names a
source nothing registers.

Written in full it still works, and is now checked against the same table: a prefix that does not match the
element it names is refused, and so is an idRef nothing answers to. **Name anything something else refers to** —
derived idRefs are positional, so adding an element above renumbers every one below it and each binding that named
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

The `!` is the `not` transformer, which is available to any binding (`transformers: [{ action: 'not', params: {} }]`).
It reads a boolean that travelled as TEXT — `"false"` and `"0"`, which JavaScript calls true — and treats an empty
array as false. An empty object is true, because a data source answers `{}` both for "no record" and for a record
with no fields.

Only for a real inverse. `cannotEdit: Boolean(post) && !canEdit` is three states, not two — the page shows nothing
at all when there is no post — and a condition like that still belongs where the data is made.

---

## 6. Flows

A flow is a list of steps, and each step is a function:

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

Three things go wrong when a step is written as a literal, and the builders answer all three:

- **Where it runs.** A global callback registers under its source MODULE (`state`, `auth`, `actions`), an element
  callback under an element's idRef, and a utility under nothing at all. A step naming the wrong one resolves to
  no function and the flow silently stops. The builders fill it in; a trigger and an untargeted element callback
  are filled with the element the flow was declared on.
- **Which `setState`.** There are two: the global one writes `runtime.state.<key>`, and `updateElement` changes
  one element's own attribute. They take different params.
- **What it takes.** Params are typed, from the same declaration the builder's own panel is drawn from.

`named(id, step)` is how a later step reads an earlier one: a running flow keeps its scope keyed by node id, so
`{{quote.output.summary}}` resolves only when the step that produced it is called `quote`. Unnamed steps get a
derived id — unique, and nothing you can write down.

---

## 7. What is refused

`sdk-schema` is the only thing in the SDK that writes a schema document, and it is the only thing that says
whether one is valid. Everything else — the style vocabulary, the element factories, the step builders — produces
inert specs. That is what keeps every guarantee about the finished document in one place.

`authorSpace` puts its own output through the same gate anything else goes through, and throws on:

- a CSS property the style editor could not read back
- a `class` or a `slot` naming a class the space does not declare (with the name you probably meant)
- an element asking for a shared class AND rules of its own — an element has one base selector
- one class name declared twice with rules that disagree
- a binding source naming an idRef nothing answers to, or one whose prefix is not what that element publishes
- an idRef that shadows a global data source (`variables`, `navigation`, `auth`, `state`)
- a step target naming an element that is not there
- two elements answering to one idRef
- a flow whose chain points at a node that is not there
- everything `validateSchema` already checked: orphans, cycles, broken parent/root links, pages

Documents you did NOT author here go through the same door:

```ts
import { validateSpace } from '@plitzi/sdk-server/authoring';

const { valid, errors, warnings } = validateSpace({ schema, style });
```

Worth running over an export from the builder, a JSON somebody edited by hand, or anything a self-hosted
deployment is about to serve.

---

## 8. Agents

An agent working in a consumer's project sees only what npm installed — not this repository. Everything it needs
is inside the packages:

- **The types.** Every factory, spec field and step builder carries its documentation in the published `.d.ts`
  (`node_modules/@plitzi/sdk-elements/dist/authoring/`, `.../sdk-schema/dist/authoring/types.d.ts`). Attribute
  types come from each element's own component, so `subType: 'h7'` is a compile error in the consumer's project,
  not a page that renders wrong.
- **The skill.** `@plitzi/sdk-server` ships this guidance as an Agent Skill, so it installs with the package:

  ```bash
  cp -R node_modules/@plitzi/sdk-server/skills/plitzi-authoring ~/.claude/skills/
  ```

## 9. Where to look

| Example | What it shows |
| --- | --- |
| [`examples/shared-space/space.ts`](../../examples/shared-space/space.ts) | the whole shape, small: a page, a palette, a stylesheet |
| [`examples/02-with-users/01-sessions`](../../examples/02-with-users/01-sessions) | two pages on one path, and an auth flow |
| [`examples/05-with-server-actions/01-actions`](../../examples/05-with-server-actions/01-actions) | a form that runs a server action and shows the answer |
| [`examples/06-full-examples/01-blog`](../../examples/06-full-examples/01-blog) | six pages, a custom element, bindings throughout |
| `plitzi-sdk-server/prisma/mongo/seeds/spaces` | five demo spaces, seeded on every deployment |
