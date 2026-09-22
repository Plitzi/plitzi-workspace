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
space (see `05-with-server-actions/03-no-server`) and a project that only publishes templates all depend on that
one name.

Everything it exports is inside it — there is no second place to look:

| Part | What it is |
| --- | --- |
| the CSS vocabulary | `css`, shorthand expansion, `column`/`row`/`grid`, `styles` |
| the element factories | one per element, plus `element`, `defineElement`, `elementsFromManifest`, triggers |
| the interaction vocabulary | what a step can do: `setState`, `navigate`, `runServerAction`, `delay`… |
| the binding transformers | and the shape a declared param has |
| assembly and validation | `authorSpace`, `authorTemplate`, `validateSpace`, `validateTemplate`, the spec types |

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

`states` takes the states the editor has tabs for — `hover`, `active`, `focus`, `disabled`, `checked`, `visited` — and
each one, like `css`, may be written per breakpoint. An element's own `states` sit beside its own `css`, and are
refused next to a shared `class` for the same reason `css` is. An element type's defaults (`elements`) take the same
`states` and `variants`, and `slots` for the type's other selectors — a modal's `rootContainer`, a form control's
`input` — so every element of the type is dressed at once.

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

**A source read inside a flow is named in full.** A binding completes the prefix for you (`jobRows.item.id` becomes
`list_jobRows.item.id`); a step's params are templates the runtime reads as written, so there the short name
resolves to nothing — the button posts an empty id and every layer below reports success. `authorSpace` refuses
it and says the full name:

```ts
list({ id: 'jobRows', source: 'controlled', bind: { items: 'board.jobs' }, children: [
  button({ content: 'Retry', flows: [[
    onClick(),
    runServerAction({ actionId: 'job-retry', input: { jobId: '{{ list_jobRows.item.id }}' } })  // the row clicked
  ]] })
] })
```

The list publishes one scope per row, so `list_jobRows.item` is the row whose button was pressed, not the first one.
A root that is a step of the same flow is that step's result and is left alone.

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

The same refresh `performQuery` runs, so it works for either runtime: a browser request is sent again, a server
provider asks the server for its own slice again. It pauses while the tab is hidden and never starts a refresh while
the last one is still in flight. `0`, the default, never does.

A refused request (`4xx`/`5xx`) is shown but never kept. Server-driven providers (`runtime: 'server'`) are not
part of this: their data arrives with the page. The dev-tools' Store tab lists what the cache holds under
"Queries", with how long each answer has left and a button to expire it.

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
- a binding source naming an element nothing answers to, or one whose prefix is not what that element publishes
- a flow template reading an element's source by its short name (`{{ jobRows.item.id }}` for `list_jobRows`)
- a name that shadows a global data source (`variables`, `navigation`, `auth`, `state`)
- a step target naming an element that is not there
- two elements answering to one name
- a flow whose chain points at a node that is not there
- everything `validateSchema` already checked: orphans, cycles, broken parent/root links, pages

Documents you did NOT author here go through the same door:

```ts
import { validateSpace } from '@plitzi/sdk-authoring';

const { valid, errors, warnings } = validateSpace({ schema, style });
```

Worth running over an export from the builder, a JSON somebody edited by hand, or anything a self-hosted
deployment is about to serve.

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

## 9. Templates

A **template** is the other artefact this surface produces, and it is not a space: one subtree, the style that
dresses it and a name, published as a JSON. Somebody fetches it by URL, it appears in the builder's Resources
panel, and dragging it onto a canvas instantiates a copy of the subtree in a space you never see.

```ts
import { authorTemplate } from '@plitzi/sdk-authoring';
import { writeFile } from 'node:fs/promises';

const { template, warnings } = authorTemplate({
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

await writeFile('pricing-card.json', JSON.stringify(template, null, 2));
```

That file is the whole deliverable. Host it anywhere, and add it to a space as an `application/json` resource —
uploading it lands it in `templates/` on that space's CDN, and the Resources panel picks it up from there.

`root` is a single element and its subtree: the root is the template's `baseElementId`, so nobody writes an id.
Everything else — `classes`, `elements`, `variables`, `schemaVariables` — is declared exactly as a space declares
it, and for the same reason it matters more here: **what the template names, the template has to carry**.

Two checks exist only for templates, because a template leaves the space it was written in:

| Refused / warned | Why |
| --- | --- |
| a binding whose source is outside the subtree | the element publishing it stays behind, so the binding resolves to nothing wherever the template lands — bring the provider into the template, or bind to a global (`variables`, `navigation`, `auth`, `state`) |
| a class named but not carried (warning) | the element keeps the class, finds no rules in the space it was dropped into and renders unstyled |
| a page inside a template | a template is a subtree dropped onto a canvas; a page has nowhere to go |
| a base element with a parent | the base element is the root of what travels |

For a manifest authored elsewhere — exported by the builder, edited by hand — the same gate runs on its own:

```ts
const { valid, errors, warnings } = validateTemplate(template);
```

The builder's own "save as template" is the other direction and does not go through `authorTemplate`: it starts
from a live schema and cuts a subtree out of it (`FlatMap.flatAsTemplate`), which is a different question — which
of a space's rules and variables belong to this subtree — from the one here, where the answer is simply everything
the declaration carries. Both produce the same artefact, and `validateTemplate` reads either.

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
| [`examples/02-with-users/01-sessions`](../../examples/02-with-users/01-sessions) | two pages on one path, and an auth flow |
| [`examples/05-with-server-actions/01-actions`](../../examples/05-with-server-actions/01-actions) | a form that runs a server action and shows the answer |
| [`examples/06-full-examples/01-blog`](../../examples/06-full-examples/01-blog) | six pages, a custom element, bindings throughout |
| [`examples/07-templates/01-authoring`](../../examples/07-templates/01-authoring) | a template authored and written out, in a project with one dependency |
| `plitzi-sdk-server/prisma/mongo/seeds/spaces` | the demo spaces, seeded on every deployment — `website1` and `comingSoon` read back from JSON with `specFromSpace` |
