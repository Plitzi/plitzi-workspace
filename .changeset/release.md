---
'@plitzi/sdk-auth': patch
'@plitzi/sdk-authoring': patch
'@plitzi/sdk-dev-tools': patch
'@plitzi/sdk-elements': patch
'@plitzi/sdk-event-bridge': patch
'@plitzi/sdk-interactions': patch
'@plitzi/sdk-navigation': patch
'@plitzi/sdk-plugins': patch
'@plitzi/sdk-schema': patch
'@plitzi/sdk-shared': patch
'@plitzi/sdk-style': patch
'@plitzi/sdk-variables': patch
'@plitzi/plitzi-builder': patch
'@plitzi/cli': patch
'@plitzi/sdk-mcp': patch
'@plitzi/plitzi-sdk': patch
'@plitzi/sdk-server': patch
---

## The builder's sidebar, one entry per subject

From 21 entries to 9. **Elements** ends with the space's **Components**, one search for both — each is dragged
onto the canvas the same way. **Server** gathers Actions, Functions, Connectors, Credentials and Runtime behind tabs, with
the warning that a space has no server-rendered deployment said once above them. **Variables** holds Feature Flags,
**Assets** holds files and fonts, **Settings** holds Visitors, the Pages panel opens the **Sitemap** in place of the
canvas, and **History** moved to the header beside undo and redo. Each grouped entry remembers the tab left open.

The builder is drawn with the website's design system: Geist and Geist Mono, the `#5b3df5` violet, cool neutrals and
8 / 10 / 14px radii, from the tokens `@plitzi/plitzi-ui/theme.css` now ships. The published SDK stylesheet does not
take them, so a space's own elements look as they did.

The Sitemap is drawn by `TreeCanvas`, a new `@plitzi/plitzi-ui` component: the site laid out as a tree on its own, panned
and zoomed like a design canvas, a page moved by dropping it onto a folder or onto the top level. `@xyflow/react` — and
zustand and d3 with it — is no longer a dependency of the builder.
From the map a page is found (search lights it and the folders leading to it), opened in the canvas (double click,
Enter or its card), and created inside a folder; folders fold away what they hold, remembered between visits; arrows walk
it. Each card says who may open the page, its layout, the flag it exists under, where it sends somebody it refuses, and
marks its dynamic segments and the page being edited. Fixed on the way: a page with no access level was labelled
"Public", which in Plitzi means guests only — it is open to everyone, and now says so.

## Feature flags

- **What they are:** `schema.flags`, a space's switches by name — a default and rules over the environment, the host,
  the URL and the visitor. Read with the document, stored apart from its snapshots: one set per environment, turned
  without a new revision; a snapshot keeps a copy, read only when the environment's flags (and their Redis copy)
  cannot be. See `docs/en/feature-flags.md`.
- **Caches follow them:** `SSRSpaceDeployment.flagsVersion` (the flags' hash) keys the HTML, RSC and `offlineData`
  caches of `@plitzi/sdk-server`; `createCloudAdapters` probes `flagsHash` and fetches `SpaceFlags` only when it moved
  — a pinned revision included — and keeps the last flags in its shared cache for a cold start with Plitzi down.
- **Who decides:** the space, then the server rendering it (`createServer({ flags })`), then the SDK embedding it (the
  `flags` prop), then a tester (the dev tools' Flags tab, only where debugging is authorized) — each only for flags the
  space declares.
- **Gating:** `definition.flag: { name, is }` renders an element only while the flag agrees — not a visibility: gated
  off, none of it is rendered, on the server or in the browser, and RSC resolves no data for it. A gated page is not
  found. Its declaration still ships with the space's document: a flag switches a feature off, it does not hide it.
- **Reading:** the `flags` global source (`{{ flags.x }}`), `useFlag(name)` for plugins, and `flags` in a server
  action's scope (the `getFlags` action lookup).
- **Builder:** Feature Flags beside the variables (declare, rule, force in the canvas, publish), the gate in an element's tools, a
  marker in the tree. Its own flags come from the platform (`PlatformFlags`) instead of a constant.
- **Authoring and MCP:** `SpaceSpec.flags`, `flag: 'name' | '!name'` on elements and pages, linter codes
  `flag-undeclared`, `flag-unknown`, `flag-unused`, `flag-rule-empty`; MCP `upsertFlag`, `deleteFlag`, `flag` on
  element and page ops, `plitzi://flags/{env}`.
- **Global sources** are one list now (`@plitzi/sdk-shared/dataSource/globalSources`), read by the runtime and the
  authoring validator alike.

## Element templates are Snippets

What the builder saves from a subtree and drops into a page was called a template, the word a space's own starting
point already goes by. It is a **snippet** now, everywhere, with no alias for the old names:

- **Builder:** "Save as snippet" on an element, **Snippets** in the resources list. A snippet has an icon of its own
  (an object group) beside the component's cube, in the canvas overlay and the context menu alike, and each says on
  hover what sets it apart: a component stays linked, a snippet is a copy.
- **CDN:** a snippet is uploaded to `snippets/` in the space's folder, with the resource type `snippet`. A file already
  in `templates/` is no longer listed as one: upload it again.
- **Authoring:** `authorSnippet`, `validateSnippet`, `SnippetSpec` and `AuthoredSnippet`, which returns `{ snippet,
  warnings }`. The validator codes are `SNIPPET_*`.
- **Shared and schema:** the `Snippet` type (`@plitzi/sdk-shared/types/SnippetTypes`), `SpaceAddSnippet` and
  `SPACE_ADD_SNIPPET`, `SCHEMA_ADD_SNIPPET` and `STYLE_ADD_SNIPPET`, `schemaAddSnippet` / `styleAddSnippet` on the
  event bridge, and `FlatMap.flatAsSnippet`.
- **Plugins:** the builder config key `canTemplate` is `canSnippet`.
- **One document, whoever writes it:** a snippet's `schema` is only what travels — `flat` and `variables` — whether
  `authorSnippet` wrote it or the builder saved it. Until now an authored one carried a whole space (`pages: []`, its
  settings), which the builder's preview laid over the space being edited, and one the builder saved failed
  `validateSnippet` (`INVALID_PAGES`).
- **The same snippet, dropped twice:** the second drop renamed its elements in the editor while the server was sent
  the names it arrived with, refused them as taken, and the drop was undone. The names are now fitted where the
  snippet is dropped (`fitSnippet`, `@plitzi/sdk-schema/helpers/fitSnippet`) and carried by the insert to the server
  and every collaborator; `SCHEMA_ADD_SNIPPET` inserts under them and refuses a name taken since, as the server does.
  `SpaceAddSnippet` checks what it is sent against the `SPACE_ADD_SNIPPET` event before applying it.
- **A snippet never restyles the space it lands in:** a class it brings under a name the space uses for something
  else is renamed (`card` → `card-2`) on its rule, its elements and the rules naming it as an ancestor, and its CSS
  recompiled; one that says the same is shared. The space keeps its rules for element types and its tokens, and a
  snippet's tokens the space lacks are now added — the editor merged its rules only, and the server neither
  (`mergeSnippetStyle`, `@plitzi/sdk-shared/style/snippetStyle`; `SnippetStyle`; `STYLE_ADD_SNIPPET` carries `style`).
- **A snippet is known by what it holds:** `isSnippet` (`@plitzi/sdk-shared/schema/snippet`). A JSON uploaded in
  **Assets** that is a snippet goes among the snippets — before, an authored one landed as a plain file — and an upload
  declared a snippet that is not one is refused. A file among the snippets the builder cannot read is shown as such,
  with a way to remove it, instead of breaking the panel.
- **Saving says how it went:** "Save as snippet" announces the snippet once the upload answered, and says why when it
  did not — it used to report it created before knowing, and from the context menu said nothing at all.

Space templates — what a new space starts as — keep their name.

## A link to a section of a page

- **`anchor`** on any element is its `id` in the DOM — the element's own id only ever reached it as `data-id` — so
  `/page#plans` has somewhere to land. Written by `authorSpace` (`anchor: 'plans'`), the builder (the element's
  **Anchor** field), the MCP (`upsertElement` / `patchElement`) and read back by `specFromSpace`.
- **`link` takes `hash`**: `link({ href: 'home', hash: 'plans' })` goes to `/#plans`; a flow's `navigate('home#plans')`
  resolves the page and keeps the fragment.
- **The router scrolls to the fragment** after every client-side navigation and on arrival, and waits up to 3 s for a
  section that renders once its data arrives — a visitor who scrolls first is left where they are.
- **Refused while authoring:** an anchor that is not lowercase letters, digits and `-` (`anchor-invalid`), one on an
  element with no tag (`anchor-no-tag`), inside a list row or a component (`anchor-repeated`), twice on one page with
  its layouts (`anchor-duplicate`), and a link to a section the page does not have (`anchor-missing`).

## Every problem in one run

- **`authorSpace` reports everything it cannot write at once**, as a `SpaceRefusedError` whose `refusals` list each
  one — instead of stopping at the first. An element it cannot write is left out and its siblings carry on; a class
  worn with `css`, `states` or a `selector` of its own is reported and written with the class, so the linter still
  reads the rest of the space and its findings join the same report.
- **Each problem says where:** the line of your own code that called the factory (`src/site/home.ts:417`) and the
  nearest named element with the steps from it (`"store-footer" › container[1]`) — not a path of indices.
- **The project's `npm run author`** prints one line on success, the numbered problems (no stack from inside the
  package) on failure, and one JSON object with `--json`.

## A class, plus one thing

`class: [cover, { opacity: '0.25' }]` puts rules of the element's own on top of the classes it wears — the commonest
shape there is, which until now took a class of its own every time. The rules become the class `<id>--own`, declared
after every shared class so it wins over them, editable in the builder like any class; they take states and
breakpoints as `styles()` does, need the element's `id`, and read back from a document as the same inline object.

## Every few seconds, with no plugin

`onInterval(ms)` is a trigger every element has: a flow that repeats every `ms` milliseconds — an autoplay, a clock, a
refresh — while the element is mounted and the tab is in view, and never in the builder outside preview. Each flow
names its own interval and counts its own ticks (`{{ <step>.count }}`); one below 250 ms is refused (`trigger-interval`).
It is in the builder's flow editor beside `onKey`, and `@plitzi/sdk-shared/helpers/interval` holds the rule all of them
read.

## Data in `public/`, in the page from the first byte

- **`plitzi create --mode server`** writes `public/data/` and passes `publicDir` to `createServer`: `public/data/*.json`
  is served with no change to `src/main.ts`.
- **A server provider reads a file of the server's own:** an `apiContainer` with `runtime: 'server'` and a `query`
  that is a plain path in `publicDir` (`/data/home.json`) is resolved by the page server from disk — no connector or
  action configured — so the page arrives with the section in it rather than fetching it after load. A URL, a path
  outside `publicDir` or a `query` with `{{tokens}}` is left to the browser as before.

## A project's server, findable

- **`npm start` starts beside whatever holds 8080** while developing: the next free port (`freePort`, from
  `@plitzi/sdk-server`), printed and written to `.plitzi/dev-server.json`. With `PORT` set, that port or an error.
- **`/health` answers with the space's name**, and `npm run shot` checks it before taking a picture — another server
  on the port is reported, instead of photographed. `playwright.config.ts` and `shot` read the port from `PORT`, else
  from `.plitzi/dev-server.json`.

## Every document type, from the package you author with

`@plitzi/sdk-authoring` exports the types of what it writes — `Schema`, `Style`, `SpaceFont`, `Element` and the rest
of the documents, plus `SchemaValidationError`, `SchemaValidationOptions` and `SchemaValidationResult` — so a project
types its own helpers without reaching into `@plitzi/sdk-shared`.

## Breakpoint warnings that read `display: none`

`tablet-rule-skips-mobile` no longer warns about a tablet rule the phone hides anyway: an element with
`display: none` under `mobile` never shows the rule it skips. When it does warn, it points to `compact`, which reaches
both.

## An inline container

`container({ subType: 'span' })` renders a `<span>`: a dot before a title, a word dressed apart, a badge in a line of
text — inline by default, and in the builder's container settings as "Span (inline)". A span holding a heading, a
paragraph, a list, a form or prose is warned about (`span-holds-block`).

## Every problem has a code, and a page that cannot miss one

- **Every refusal and warning carries a code** — `[class-and-css]`, `[id-taken]`, `[tablet-rule-skips-mobile]` — in
  the message and in `SpaceRefusedError.refusals[].code`. `AUTHORING_CODES` (exported) is the one table they are raised
  from: whether each is refused or warned, what was wrong and what to write instead. A check raised with a code that is
  not in it does not compile.
- **The skill's `authoring-errors.md` is generated from that table**, as is the website's Authoring errors page
  (`authoringCodesTable`), so neither can miss a code; a test fails when the page and the table disagree.
- `AuthoringError` is what a factory or `authorSpace` throws for one problem on its own, with its `code` and `reason`.

## The skills, packaged for a project

- **A cheatsheet to start from** (`CHEATSHEET.md`): the factories, fields, steps and the problems met most, on one
  page. `SKILL.md` starts there, says what to read for each kind of task, and what never to read whole.
- **Recipes by intent, as files** (`recipes/*.ts`): show data from a file, filter a list, a detail page, link to a
  section, something every few seconds (a carousel), a marquee, a link built from a row, forms and modals, a feature
  flag, a plugin, controls usable without sight, styling, and an embed or an SVG. CI authors each one: a recipe that
  stops authoring fails the build.
- **Every link in a skill resolves inside a project**, and none names a file only the workspace has; a test walks them
  as `plitzi create` copies them. Realtime channels have a reference of their own.
- **Each skill file has a budget** — about 4k tokens for a `SKILL.md`, 3k for a reference — held by a test.
- **When to use the MCP and when the CLI**, in both skills: the MCP for a space that lives on Plitzi, the CLI for one
  that lives in code; a sign-in nobody can give never blocks the second.
- New guidance: animations (keyframes, entering with `visible`, pausing on hover, staggering), a list's `index` as
  text, rows kept by position, a provider around a layout's slot, checking motion in a test.

## A project an agent finds its way around

- **`AGENTS.md` says the port, where data goes, how to look at a page, and what not to read**: the generated
  `space/offline-data.json`, `.sdk-plugins/`, a large `public/data/*.json` and the bundles in `node_modules`.
- **`plitzi data describe <file>`** prints a JSON file's shape — every field, its type, how many rows have it — and one
  row of its longest list; `--json` for a tool.
- **Quiet by default:** the server prints only what goes wrong (`npm start -- --verbose` for every request), and
  `typecheck` one line per error.
- **The welcome space follows the skill's rules:** a box one class owns whole is a shorthand; a test holds it to that.
- `.claude` is left out of a project's lint and formatting.


## Problems over MCP come with their code and their fix

An agent editing a space over MCP has no skill page to look a code up in: each problem a batch meets now leads with its
`[code]` and its hint says what to write instead, from the same `AUTHORING_CODES` row `authorSpace` raises it from
(`authoringCodeEntry(code)` looks one up).

## Scrolling, as steps

- **`scrollBy`, `scrollTo` and `scrollIntoView`** are callbacks every element answers: `scrollBy('cards', { x: '80%' })`
  moves a box by most of what it shows, `scrollTo('cards', { x: 'end' })` to an end or a place, `scrollIntoView` brings
  an element into view. In the builder's flow editor, in authoring and over MCP.
- **`onScroll`** fires as an element's box moves — at most once a frame, and once on mount — with
  `{ x, y, atStart, atEnd }`, so an arrow can hide at the end already reached (recipe: `recipes/scroll-a-row.ts`).

## A list names its rows by the field you choose

`list({ itemKey: 'slug' })` keys each row by that field of its item, so a row's state follows its item when the list is
filtered or reordered, and a row whose item changes mounts again — a one-row list showing the current slide replays its
entrance. Left out, rows follow the items' `id` (when every item has its own), else their position. In the builder it
is the list's "Row key"; `list-item-key-missing` warns when fixed items lack it or share one.

## A skeleton while a provider loads

`apiContainer({ loadingSlot: 'catalog-skeleton' })` names one of its children to show in place of the others until the
first answer arrives — the shape of what is coming — and to drop after it. In the builder every child shows, so the
slot is edited beside what it stands for; `loading-slot-unknown` refuses a slot no child answers to.

## `plitzi create --template blank`

A space written in the project can start empty: tokens for both themes, a layout whose `site-main` the pages render in,
one page, `public/data/` and no example plugin — for a project that is about to be a specific site, where the welcome
tour is the first thing that would be deleted. `emptySpaceSpec` / `emptySpaceSource` in `@plitzi/sdk-authoring`.

## `plitzi add plugin` writes the shape it is told

`--prop interval:number=5000`, `--trigger onTick:count`, `--callback reset` and `--headless` write an element in its
final shape — typed props with defaults, bindable and with a control each in its panel; a `use<Name>Events()` hook that
fires its events with typed payloads; a function per action; and, headless, hidden on a page and a badge in the builder
— instead of the counter example, which is what it writes without them. Flags that cannot make an element (a type that
is not one, an event every element already fires, a name used twice) are refused with how to write them, and the files
are written as the project's Prettier writes them.

## Skills that say their version, and `plitzi skills update`

The skills `plitzi create` copies into a project carry the version of the package they came from (`version:` in
`SKILL.md`). `npm run author` says when the authoring skill is older than the `@plitzi/sdk-authoring` installed, and
`plitzi skills update` replaces each Plitzi skill with the installed package's — whole, leaving any other skill alone.
The CLI skill's references for `create --from` / `pull` and for a space's functions are files of their own now, read
when a task names them.

## `plitzi explain`

What a name means when authoring, in a few lines: an element (its attributes and their values, what it fires and
answers, its slots), a step (its params and the function that writes it), a trigger (what it hands its flow, what fires
it), a problem's code (what was wrong, what to write instead) or a transformer. `--list steps` names every one of a
kind, `--json` answers in one object, and over MCP it is the resource `plitzi://explain/{name}`. Read from the same
catalogues the checks use (`explain`, `explainList`, `explanationText` in `@plitzi/sdk-authoring`).

## `plitzi check` and `plitzi shot`: a page in numbers before pictures

- **`plitzi check / --width 1440,390`** says whether a page of the running project is whole, in text: every element the
  space owes it on screen (or why not), no broken image, no sideways scroll, no text in the colour behind it, no console
  error, no refused request — per width, `--json` for a tool. A space in code is checked against what each page owes;
  any other, against what every page does.
- **`plitzi shot`** takes the picture, and `--compare <url>` puts the same page of another site beside it — the
  differences in red, and the share that differs in each landmark (`section#plans 14%`); `--frames 4 --every 500` says
  what moves; `--wait-for` and `--reduced-motion` set it up. The comparison runs in the browser
  (`comparePictures`, `pageRegions` in `@plitzi/sdk-authoring`), so nothing is installed for it.
- Both use the project's own Playwright and refuse a port that answers as another project. A project `create` writes
  installs `@plitzi/cli` and runs them as `npm run check` / `npm run shot`, which replaces its `scripts/shot.ts`.

## The builder's problems panel says the fix

Each problem in the builder's panel shows what to write instead, from the same `AUTHORING_CODES` row `authorSpace` and
the MCP use — `SpaceIssue.fix` over GraphQL, its code set apart.

## Scroll snap, and anchors under a fixed header

`scroll-snap-type`, `scroll-snap-align` and `scroll-snap-stop` — a row of cards that comes to rest on a card — and
`scroll-padding-top` / `scroll-margin-top` — an anchor that lands below a fixed header rather than under it — are part
of the style vocabulary, with a "Scroll snap" section in the style editor.

## CSS as a React style object, and a value per breakpoint in place

- **camelCase keys and numbers:** `{ paddingTop: 8, fontWeight: 800, WebkitLineClamp: 2 }` is `padding-top: 8px`,
  `font-weight: 800`, `-webkit-line-clamp: 2` — a bare number on a length is pixels. The document keeps kebab-case; one
  property written under both spellings is refused (`css-property-twice`).
- **One property per breakpoint:** `{ fontSize: { desktop: '24px', compact: '18px' }, fontWeight: 700 }` changes the
  size on tablet and phone without splitting the rule set; it mixes with the per-breakpoint form.

## A link's mode follows from its href

`link({ href: '/games/nebula' })` is internal, `link({ href: 'https://…' })` (or `mailto:`, `tel:`) external, and
`link({ href: 'about' })` a page — `mode` is written only to say otherwise. A link that opens another tab gets
`rel="noopener noreferrer"`.

## `from` and `as`: an element shows its data in a line

- **`from`** binds the attribute a type shows its data in — a text's or heading's `content`, an image's `src`, a link's
  `href`, a list's `items` — and leaves it empty until the data answers: `heading({ from: 'site.data.hero.title' })`.
  It writes the same binding `bind` does; `bind` keeps the other attributes.
- **`as`** shows it through a template (`as: '{{ source }} left'`) or a format the space names once:
  `formats: { price: "{{ source|currency('USD', 'en', { trimZeros: true }) }}" }`, then `as: 'price'` anywhere.
- **New template filters:** `currency('USD', locale?, { trimZeros })` and `percent(decimals?)`, in `en` unless told,
  so a server and a browser in different locales write the same text.
- Refused: `from` on a type with no main attribute, the main attribute bound twice, a format nobody declared, `as`
  without `from`.

## A list in one line: `items` and `row`

`list({ id: 'grid', items: 'catalog.data.products', row: 'product-card' })` is a controlled list fed by that source,
placing the component once per item with the row bound to its `item` prop (or its only prop). `row` can also be a
function handed the row's names — `row: r => text({ from: `${r.item}.title` })`, `r.inTemplate.item` for a template.
`items` (an array, or a source's name) and `from` make a list controlled without saying so. Refused: a row and
children at once, a function row on a list with no `id`, a row naming a component that cannot take it.

## `activeWhen`, and a list's index is a number

- **`activeWhen(dot, '{{ list_dots.index == state.slide }}')`** wears a class's `active` variant while a condition
  holds (`idle` otherwise) — the general form of `activeOn`, without a hand-written ternary.
- **`list_<id>.index` is a number** from 0, so a template counts with it (`index + 1`). `==` compares text and numbers
  alike, so templates that compared it as text read the same.

## `cycleState` and `stepState`

`cycleState({ key: 'slide', length: 4 })` moves a number in state round a cycle — after the last the first, `by: -1`
before the first the last — and `stepState({ key: 'shown', by: 40, max: 'apiContainer_site.data.total' })` adds and
stops at its bounds. Both are the `setState` they stand for, with the arithmetic written once; a length or a bound is a
number or a template expression for one.

## `scope()` for what a helper builds

`scope('promos', ref => container({ id: 'panel', … }))` prefixes every `id` given inside it (`promos-panel`), so a
helper that builds the same block twice writes two sets of names instead of being refused `id-taken`. `ref('slides')` is
the full name, for a binding, a step's target or a template; scopes nest. `id-taken` now points at it.

## Typed tokens, and `unknown-variable`

- **`tokens(variables)`** turns the space's variables into the values a rule writes — `t.surface === 'var(--surface)'`
  — so a token that does not exist is a type error where it is written.
- **`unknown-variable`** warns of a bare `var(--x)` nothing declares (a space variable, a selector's variable, a custom
  property a rule sets, or `customCss`): the browser drops the property and the page shows what it inherits. A
  `var(--x, fallback)` is taken as meant.

## Typed sources: `source()` and `twig`

`const site = source('site', home)` names a provider's source from a sample of its answer — the JSON file it reads,
imported — so every path is completed by the editor and checked: `site.data.hero.titel` is a type error, and refused
`source-field-unknown` where the types were not looking. A path is the full source name, so it goes in `from`, `items`,
`bind` and `visible` as it is, and into a template through `` twig`{{ ${site.data.total} + 1 }}` ``. A list fed by a
path hands its `row` the item typed (`row: g => text({ from: g.item.title })`). Nothing of the sample is written into
the space; inside a `scope()` the id is the scoped one.

## `tw()`: Tailwind classes as Plitzi styles

`styles('pill', tw('inline-flex items-center gap-2 px-5 rounded-full bg-slate-950/90 hover:scale-105 md:text-sm'))`
writes the rules the classes mean when the space is authored — Tailwind v4's scales and palette, arbitrary values,
`[property:value]`. Its breakpoints become Plitzi's ranges (`md:` tablet and desktop, `lg:` desktop, `max-md:`,
`max-lg:`), its states the class's states, `group-hover/<class>:` an ancestor's. Composed properties (transform,
filter, gradient, ring and shadow) are put together once. `createTw({ colors: tokens(variables) })` names the space's
tokens. What has no exact equivalent (`sm:`, `dark:`, `space-x-*`, `animate-*`) is refused with what to write instead.

## `create --template catalog`, and a file per part

`npx @plitzi/cli create shop --template catalog` writes a complete small site to read and change: a layout with a menu,
a product card component, `public/data/products.json` read as a typed source, a catalog filtered by category and a page
per product — each part a short file of its own under `src/site/`, assembled by `src/space.ts`. The template is
authored by sdk-authoring's tests, and a generated project authors, typechecks and lints clean. The skills point to it,
and `AGENTS.md` asks for a file per part.

## `embed` and `svg` elements

- **`embed({ src, title })`** puts another page in a frame — a map, a video player — lazily loaded, with `allow`,
  `sandbox` and `referrerPolicy` when it needs them. Only a web address or a path of the site is loaded, and in the
  builder the frame does not swallow the click that selects it. `embed-without-title` warns of one a screen reader
  cannot describe.
- **`svg('<svg …>…</svg>', { label })`** draws SVG markup inside a box its class colours (`currentColor`): checked to be
  one `<svg>` (`svg-not-svg` otherwise) and sanitised as rich text is, plus what only SVG can carry (`foreignObject`,
  animations writing a `javascript:` link). Decorative unless it has a `label`, then `role="img"`. `{{ }}` tokens
  resolve in it like in any attribute.

## Pictures resized by the page server

`createServer({ images: { domains: ['images.example.com'] } })` resizes other sites' pictures at `/_plitzi/img`: an
`image` whose `src` is one of them offers a `srcset` from 320 to 1920 px, in AVIF or WebP when the browser takes them.
Each original is downloaded once and each size made once, both kept on disk; a week on they keep answering while the
original is revalidated with its `ETag` / `Last-Modified`, so an unchanged picture is never resized again. Only the listed hosts (`*.example.com` for subdomains) are fetched, every redirect is
held to the list and to the outbound guard, and SVG is refused. `sharp` is an optional peer: without it pictures are
passed through and kept. `image` also takes `sizes`, and `width`/`height` so the browser keeps the picture's space.

## `plitzi check` says what the page holds

Every `plitzi check` now lists the flows that failed while the page loaded, each with the step that failed and why.
`--state` adds the page's state and every source by its full name (with the shape of what it holds), and `--element
<id>` one element: what it reads, its own state, how many copies, whether it is on screen and its box. Read from the
page's dev tools, which keep the flows a page runs before they mount; in a test, `readDevTools(page)` from
`@plitzi/sdk-authoring` answers the same.

## `carousel`

A structure element for slides that change, a marquee and a row that swipes: `carousel({ id: 'hero', items, row,
autoplay: 5000, children: [arrows, dots] })`. Its `row` is written into a `carouselTrack`, and its other children are
its controls, reading `carousel_<id>.index`, `.count`, `.item` and `.items`. `mode: 'slide'` shows one at a time
(`transition` `slide`, `fade` or `none`, back entering from the left); `'marquee'` scrolls the items past at `speed`
px/s with no seam; `'scroll'` is a snapping row a visitor swipes. Steps `carouselNext`, `carouselPrevious`,
`carouselGoTo`, `carouselPlay` and `carouselPause`; trigger `onChange`. Autoplay holds still under the pointer, with
keyboard focus inside, in a hidden tab and for reduced motion, and never in the builder. Slides are announced as "2
of 5" in a region named by `label`.

## `plitzi fix`: the fixes authoring knows, written in your source

`plitzi fix` shows what authoring would fix — a key the element never reads, `'true'` where a boolean goes, a URL in
page mode, a `state.` prefix on a state key, a binding nothing reads — as a diff of the project's own source: each
edit made in the call that wrote the element (found by the line and column it remembers), and only where the value is
a literal. `--write` writes them, formatted as the project formats, authors the space again in a fresh process and
keeps them only if every fix is gone and no problem was added; one that would add a problem is put back and said with
the reason. `npm run author` says how many of its problems have one fix. From `@plitzi/sdk-authoring`, `planFixes`
returns the plan: every problem, and each fix with its place and edit.

`fixSpace` now reads an element with the linter's own context, so a component instance's props and slot are no longer
taken for attributes nobody reads — it used to remove the binding of a list row to its component's `item`.

`plitzi import <url>` measures a page you own in the project's Playwright and writes it into the project as a place to
start from: `tokens.ts` (the page's custom properties by name, then its dominant colours, each with the value the same
place shows in the dark scheme; repeated corners and shadows; Google fonts), `outline.ts` (`container()`s for its
landmarks and blocks, with their layout per breakpoint as what each narrower width changes), its repeated lists as
`data/*.json`, `assets.json`, a screenshot per width and `IMPORT.md`. Never its words. It imports only a site that is
the person's: a verified domain of one of their spaces covering the host (the `_plitzi` TXT record, asked of the
platform's new `GET /account/domains/covering`), or one served from this machine; `--out`, `--widths`, `--force`,
`--json`, `--api`. From `@plitzi/sdk-authoring`: `importProbe` (runs
in the page), `importedFiles` and `darkScheme`.

A compound element without the part it shows its content through — a `carousel` with no `carouselTrack`, a
`tabContainer` missing its header or body, a `dropdown` with no `dropdownPopup` — is now refused (`part-missing`):
it rendered nothing of what it held, without a word. The parts are read off the declarations (`elementPartTypes`, the
`partTypes` catalog), so the builder's issues and publish gate, the MCP's validate and `authorSpace` all hold to it.
The MCP guide says how a compound element is written.

The dev tools catch up. **Elements** shows what is on screen as the trees it comes from — the layouts around the page,
outermost first, the page, and every component an instance places — at their depth, searched together (a match is kept
with what holds it), each element outlined on the page while it is pointed at. Selected, its **Runtime** tab is the
report `window.__plitzi.element()` and `plitzi check --element` give: own state, what it reads, the component it places
or sits in, copies and box, read again every second. That report now finds an element inside a component, which it
missed. **Logs** has a `realtime` category: the page's connection opening and dropping, each message in (←) and out
(→), and every topic the server refused, with why. One hook outlines an element for every tab.

A `webHook` step that gets no answer at all — offline, refused, blocked by CORS — now fails, with the request and the
reason, so the flow stops and its `onFailure` runs. It used to succeed with an empty response, and the flow carried on
as if the request had been made. Any answer is still the step's result, an error status included: a flow reads
`{{ <step>.response.status }}` to tell a 401 from a 200. `response.data` is typed as what the body parsed to.

The server checks what a deployment's config hands it in one place (`configSeam`): each action document and connector
manifest a lookup returns goes through the validator the builder saves with, as it is read — an action that is not a
document is refused by name, and one in a list is left out and said rather than failing the space's schedule — and the
database drivers and functions config are checked once, as the server starts. Four unchecked casts are gone.

`@plitzi/sdk-shared/helpers/eventTarget` reads an event's target as a node (`nodeOf`, `isNodeTarget`) or an element
(`elementOf`, `isElementTarget`) by its own type rather than `instanceof`, which is false for a target in the builder's
canvas iframe. The builder, the style inspector and the dev tools use it, and type their change and key handlers by
the input they listen on; the casts of `event.target` are gone.

The builder's flag form checks each rule's `when` is a group of conditions before it saves, rather than passing
whatever the field held.

The CLI's commands now work the same way: the answer on stdout and errors and sign-in prompts on stderr, so `--json`
is only the answer (`import --json` printed the sign-in prompt into it); exit 1 whenever a command did not do what it
was asked (`fix --json` with a problem exited 0); and a flag's value checked where the flag is declared, refused with
what it takes — `--width abc` or `--scheme darkk` used to check at no width or in light, saying nothing. One flag means
one thing everywhere: `import --widths` is `--width`, like `check`, and `-o`, `-f` and `-e` are the short forms on
every command that writes, overwrites or names an environment. `import` no longer repeats a sign-in error. `whoami`
and `runtime status` take `--json` too; `functions` and `runtime push` refuse outside a project, as every other command
that works on one does, instead of writing `functions/` into whatever folder they were run from; and every command
says a finished action the same way, in green.

The SDK's production build keeps `console.warn` and `console.error`, and drops only `log`, `info` and `debug`. It used
to drop them all: an override of a flag the space does not declare, or a render that failed, said nothing on a
published site — exactly where nobody can attach a debugger.

A link to the page being shown says so: it carries `aria-current="page"` — read from the address the page was rendered
at, so the first paint has it — and a class dresses it with the new `current` style state (`states: { current: … }`,
a tab in the style editor, folded from `[aria-current="page"]` rules when a space is exported). A site's header now
goes in a layout once, instead of a copy per page to mark the right navigation item.

`notifications` dresses the whole toast, not only its colours: `font`, `fontSize`, `border`, `shadow` and `padding`
join `radius` — the library's variables where it has them, a rule on the toast where it has none. A space no longer
writes `.Toastify__toast { … }` into its `customCss` for them.

A visitor whose machine asks for less motion gets it on every space: the SDK's base layer cuts animations and
transitions to an instant (each still ends where it would) and turns smooth scrolling off. Spaces used to copy that
rule into their own custom CSS, and one that did not moved anyway.

Authoring suggests, beside what it refuses and warns: `authorSpace` returns `suggestions` — a shorter way to the same
page, each with its code, the elements it is about and how many it would save, the largest first. The same header in
every page is a layout (`repeated-on-pages`, which also names the `current` state when the copies differ only in the
active link), one structure copied with other words a component or a list (`repeated-shape`), a `text` alone inside a
button or a link the element's own `content` (`content-attribute`), and `customCss` that a class's states, the SDK or
`notifications` already say (`custom-css-*`). Copies are compared by what they read too — a block reading its own
provider is still one block, two pagers over two lists are not — a block only some pages of a layout carry is offered as
a component rather than a layout of its own, and a text that is a shape drawn inside a button is left alone.
`suggestSpace({ schema, style })` gives them for any document; they never block. `plitzi_validate` and `plitzi_apply`
answer with the ones a batch opened up, `npm run author` prints them under the warnings (and `--json` carries them), and
the authoring skill's new `reference/efficiency.md` teaches the short way first.

A `link` has words of its own: `content`, drawn before or after its children (`contentPlacement`), as a button's — a
link with only a label no longer needs a `text` inside it.

A style that writes its rules beside `states`, `variants` or `ancestors` — `{ desktop: { … }, ancestors: { … } }` — is
refused with what to write (`rule-set-mixed`: the rules go under `css`), instead of reporting `desktop: [object Object]`
as a CSS value it could not read.

`plitzi explain` and `plitzi://explain` name a suggestion's code `suggested`, with its short way, instead of calling it
`warned`. The MCP server's guide teaches the short way first — a link's own `content`, the `current` state for the link
to the page being shown, a component for a block only some pages of a layout carry — and how to read the
`suggestions` `plitzi_validate` and `plitzi_apply` answer with.
