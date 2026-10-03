# When `authorSpace` refuses or warns

<!-- Generated from AUTHORING_CODES (src/schema/codes.ts) by `yarn generate:authoring-errors`. Do not edit. -->

Search this page for the code in brackets — `[class-and-css]` — rather than reading it whole, or ask for one:
`npx @plitzi/cli explain class-and-css`.

`authorSpace` reports everything it cannot write in one run, as a `SpaceRefusedError` whose `refusals` each carry
a `code`, the line of your code that wrote the element (`src/site/home.ts:417`) and the nearest named element
(`"store-footer" › container[1]`). **Do what the message says.** Never cast past a check, silence it, or move the
logic into a plugin to avoid it — the check exists because that declaration renders something other than what it says.

The one exception is a TEST fixture whose subject is the break itself — how the runtime copes with a document no author
would write. It names that break, and only that one: `authorSpace(spec, { allow: [{ code, element, why }] })`. See
[testing](testing.md#spaces-written-for-a-test). A space anybody visits never has an `allow`.

More on a topic: [templates](templates.md), [feature flags](feature-flags.md), [accessibility](accessibility.md),
[components](components.md), [flows](flows.md).

## Refused

The space is not written until these are fixed.

| Code | What was wrong | Write instead |
| --- | --- | --- |
| `action-step-params` | a step with no params in an action whose ways in declare different inputs | the step's params |
| `action-without-entry` | an action with no way in, so nothing can start it | a `trigger` — `{ type: 'call', access }`, or `render`, `webhook`, `custom`, `schedule` |
| `action-without-steps` | an action with no steps | the steps it runs |
| `active-when-constant` | an `activeWhen` condition that reads nothing — always or never true | name what it depends on: `'{{ list_dots.index == state.slide }}'` |
| `ancestor-not-class` | an ancestor condition keyed by something that is not a class name | `[card.name]` for a `styles()` declaration |
| `anchor-duplicate` | one anchor on two elements of the same page (layouts included) | rename all but one |
| `anchor-invalid` | an `anchor` or a link's `hash` that is not lowercase letters, digits and `-` | `anchor: 'plans'`, `hash: 'plans'` — no `#` |
| `anchor-missing` | a link whose `hash` no element on the page it goes to carries — it would land at the top | the anchor the message lists, or give the section that `anchor` |
| `anchor-no-tag` | an anchor on an element that renders no element of its own | the anchor on the element around it, or `subType: 'div'` on the provider |
| `anchor-repeated` | an anchor inside a list row or a component — it would be in the page once per row or instance | the anchor on the list, or on the element around the instance |
| `as-without-from` | `as` with no `from` — `as` is how the source `from` names is shown | `from: 'products.item.price', as: 'price'` |
| `attribute-kind` | text where a flag or a list is read | `disabled: true`, not `'true'`; `items: [ … ]` |
| `attribute-value` | a value outside the attribute's list (`subType: 'h7'`) | one of the listed values |
| `binding-category` | a binding `category` that does not exist | one of the categories it lists |
| `binding-shape` | a binding with no `to` or no `source` | `bind: { content: 'posts.item.title' }`, or `bindTemplate(to, source, template)` |
| `binding-source-out-of-scope` | a source read by an element that is not inside the element publishing it | move the element inside it, or share the value through `state` |
| `binding-source-unknown` | a binding whose source names an element that does not exist, or with its prefix written wrong | the id of the element that publishes it, written alone — the prefix is filled in |
| `binding-target-unknown` | a binding onto an attribute the element does not have — the value arrives and nothing shows it | one it lists (`content`); to follow data with a class, `variantFrom` |
| `callback-key-unknown` | a `setState` / `toggleState` on an element writing a field it does not have | an attribute it lists, or for `category: 'state'` `visibility` / `styleSelectors.<selector>` |
| `callback-not-answered` | a step sending an action the target element never answers to | the element that answers it; for a plugin, `declaredCallback(declaration, 'reset', { on })` |
| `channel-declaration` | a channel whose pattern or access the server cannot read | what the message says: `{ access: { mode: 'public' } }`, a pattern like `room:{id}` |
| `channel-grant` | a topic of a private channel opened with no grant to it | the grant the message names, or a public channel |
| `channel-topic` | a `channel` element with no topic | a topic a channel of the space covers |
| `children-in-leaf` | children on a type that renders only its own attributes (`heading`, `text`, `image`…) | a `container` — for a heading made of parts, `container({ subType: 'h1', children })` |
| `class-and-css` | an element wearing a shared class AND `css` or `states` of its own — it has one base selector | the rules on top of the class: `class: [card, { opacity: '0.5' }]` (needs an `id`) — or into the class |
| `class-and-selector` | an element with a shared class and a `selector` of its own | drop one: a shared class IS its selector |
| `class-conflict` | two different declarations for one class name | rename one, or make them agree |
| `class-listed-under-other-name` | a `styles()` declaration listed in `classes` under another name | list it under its own name |
| `class-undeclared` | a class name the space does not declare | declare it in `classes`, hand the `styles()` declaration itself, or write the rules with `css` |
| `component-duplicate` | two components with one id | a name each |
| `component-id` | a component whose `id` is not a name it can be placed by | a letter first, then letters, digits, `-` and `_` |
| `component-undeclared` | an instance of a component the space does not declare | the id it suggests, or declare it in `components` |
| `computed-name` | a computed value whose name a template cannot read as `computed.x` | letters, digits and `_` |
| `computed-not-template` | a computed value that is not a template | `'{{ state.x * 2 }}'` |
| `computed-reads-element` | a computed value reading an element's source — no element is around the whole space | compute it from the globals and the variables, or bind it on the element |
| `computed-unknown` | a computed value read before it is declared, or never declared | declare it in `computed`, above the one that reads it |
| `css-property-twice` | one property written twice in a rule set — `paddingTop` beside `'padding-top'` — so one would silently win | keep one |
| `css-property-unknown` | a CSS property that does not exist | the property it suggests; a custom property starts with `--` |
| `css-value` | an empty CSS value, or one with `;` or `{}` | one value per property; leave a property out instead of writing it empty |
| `element-load-strategy` | a `loadStrategy` the element does not take | one of the values the message lists |
| `element-rejected` | an element the schema refused to hold | the problem listed with it |
| `element-runtime` | a `runtime` the element does not run in | one of the values the message lists |
| `element-shape` | an element that is not an object with a `type`, `attributes` and a list of `children` | build elements with their factories — `text(…)`, `container(…)` |
| `flag-gate` | an element's or a page's `flag` that is not a flag name | `flag: 'newCheckout'`, or `flag: '!newCheckout'` for "only while off" |
| `flag-name` | a flag whose name a template cannot read as `flags.x` | letters, digits and `_` |
| `flag-rule-shape` | a flag rule that is not `{ when, value }`, or whose `value` is not `true` or `false` | `{ when: { … }, value: true }` |
| `flag-shape` | a flag whose `value` is not `true` or `false` | `{ value: false, rules: [] }` |
| `flag-undeclared` | a gate on a flag the space does not declare — it reads as off, so the element never (or always) renders | declare it in `flags`, or remove the gate |
| `flag-unknown` | a template reading a flag the space does not declare | the declared name it suggests, or declare it |
| `flow-empty` | a flow with no steps | `[onClick(), setState({ … })]` |
| `flow-without-trigger` | a flow whose first step is not the event that runs it | `[onClick(), setState(…)]` |
| `folder-cycle` | a page folder inside itself | a `parent` that leads to the top |
| `folder-undeclared` | a page, a layout or a folder filed in a folder the space does not declare | declare the folder, or the name it suggests |
| `font-invalid` | a font the space cannot load as declared | the field the message names |
| `format-unknown` | an `as` that names no format of the space's `formats` | declare it once — `formats: { price: "{{ source\|currency('USD') }}" }` — or write the template in its place |
| `from-and-bind` | the main attribute bound twice, with `from` and in `bind` | keep `from`, and give `bind` the other attributes |
| `from-without-attribute` | `from` on a type with no one attribute that shows its data (a container, a form) | bind the attribute you mean: `bind: { attribute: 'source' }` |
| `global-callback-module` | a global callback sent to a module other than the one that registers it | the step builder, which knows the module |
| `global-callback-undeclared` | a global-callback step builder naming an action no source declares | one of the actions it lists |
| `id-invalid` | an id a binding, a template or a test cannot name | a letter first, then letters, digits, `-` and `_`: `'hero-title'` |
| `id-shadows-global` | an element named like a global data source (`state`, `navigation`, `auth`…) | another id |
| `id-taken` | two elements with one id — ids are one namespace for the whole space | wrap what a helper builds in `scope('promos', ref => …)`: every id inside is prefixed, `ref('slides')` names one |
| `layout-slot-unknown` | a layout `slot` that is not an element inside that layout | the id of the element in the shell where the body goes |
| `layout-undeclared` | a page or a layout inside a layout the space does not declare | the layout's id, or declare it in `layouts` |
| `list-items-ignored` | a list whose items nothing reads — `source: 'none'` renders its children once | `source: 'controlled'` |
| `list-without-items` | a controlled list with nothing to render | `items: [ … ]` or `bind: { items: 'provider.data.rows' }` |
| `loading-slot-unknown` | an `apiContainer`'s `loadingSlot` that is not the id of one of its children | the id of the child to show until the first answer — `loadingSlot: 'catalog-skeleton'` beside that child |
| `modifier-count` | more than one set of rules in a class list | one set, after the classes: `class: [card, { opacity: '0.5', 'margin-top': '8px' }]` |
| `modifier-without-id` | rules on top of a class on an element with no `id` — the id names the class they become | `id: 'hero-bg'` |
| `no-pages` | a space with no pages | `pages: [{ id: 'home', name: 'Home', slug: '', body: [] }]` |
| `notifications-shape` | `notifications` with a field it does not have, or a value that is not one CSS value | the fields it lists; a colour or a length, like 'var(--card)' or '12px' |
| `outside-ancestor` | an element that reads the state of an element it is not inside | nest it in the element the message names |
| `page-access-level` | an `accessLevel` that is not one the router reads | one of the values the message lists |
| `page-route-reserved` | a page under `/fn`, where the space's functions answer | another slug |
| `page-route-taken` | two pages at one address for the same visitors | another slug — or `accessLevel` `'public'` on one and `'authenticated'` on the other |
| `page-target-unknown` | a link or `navigate` to a page id that does not exist | an existing page id, or a path with its slash (`'/about'`) |
| `page-target-url` | a URL, `mailto:` or `tel:` in a link left in page mode | `mode: 'external'` |
| `page-without-slug` | a page with no `slug` | `slug: ''` for the home page, its path for any other: `'about'`, `'blog/:slug'` |
| `part-missing` | a compound element — a carousel, a tab container, a dropdown — without a part it renders through | the part the message names, inside it (`carousel()` writes its own track) |
| `prop-missing` | an instance without a prop its component requires | `component('card', { props: { name: … } })`, or bind it |
| `prop-name` | a prop whose name a template cannot read as `props.x` | letters, digits and `_` |
| `prop-unknown` | a prop the component does not declare, handed in or read | the prop it suggests, or declare it: `props: { name: { type: 'text' } }` |
| `prop-value` | a prop handed in with a value its declaration does not take | a value of the declared type, or one of its options |
| `props-outside-component` | `props.x` read outside a component | read the source it would have come from |
| `redirect-target-unknown` | a page that sends visitors it is not for to a page the space does not have | a page's id or slug (`''` is the home page), or a full URL |
| `row-and-children` | a list with a `row` and `children` — the row is what it renders | one of the two |
| `row-component` | a list's `row` naming a component the space does not declare, or one with no prop to take the row | a declared component with an `item` prop — or a single prop — for the row |
| `row-outside-list` | `row` on an element that is not a list | a `list` around it |
| `row-without-id` | a list whose `row` is a function, with no `id` — the row's sources are named after it | `list({ id: 'products', items, row: r => … })` |
| `selector-invalid` | a `selector` that is not a CSS class name | letters, digits, `-` and `_` |
| `selector-taken` | a `selector` that is a declared class, or another element's | `class` to share rules; a selector of an element's own is its alone |
| `setting-misplaced` | `settings.computed` or `settings.channels` written inside `settings` | `computed` and `channels` at the top of the space |
| `slot-children` | children handed to an instance outside its slots | `children: { slotName: [ … ] }`; a component with no slots takes no children |
| `slot-unknown` | a component slot that is not an element of its tree | the id of an element inside the component — usually an empty container |
| `source-field-unknown` | a path into a typed source that its sample does not have | read a field the sample has, or add the field to the sample |
| `state-key-list` | `settings.transientState` / `paintedState` that is not a list of top-level state keys | `transientState: ['demoStep']` — a dotted path names its top key |
| `state-painted-and-transient` | a state key both painted (kept for the server) and transient (never kept) | remove it from one of the two |
| `step-duplicate` | two steps with one name in a flow or an action | a name each |
| `step-name` | a step name a later step cannot read as `{{ name.field }}` | a letter first, then letters, digits, `-` and `_` |
| `step-params` | a step param that does not exist, or a value outside its options | the params and values it lists |
| `step-type` | a step `type` that does not exist | the step builders — `setState(…)`, `navigate(…)` — write it |
| `style-state-unknown` | a state a selector does not react to | one of the states it lists (`hover`, `focus`, `active`…) |
| `svg-not-svg` | an `svg` whose `content` is not one `<svg>…</svg>` — it draws nothing | the SVG markup alone; HTML around it goes in a `blockHtml` |
| `template-short-source` | a source named without its prefix inside a template or a step | the full name: `apiContainer_stats`, `list_rows` |
| `template-source-out-of-scope` | a template reading the source of an element it is not inside | move the element inside it, or share the value through `state` |
| `template-text-into-value` | a template, which renders text, feeding an attribute that holds a list or an object | `bindTemplate('items', source, '{{ … }}', { returns: 'value' })` |
| `template-unknown-name` | a name in a template that is not a source, a variable or a route param | the full source name (`list_rows.item`), `navigation.queryParams.x`, or `source` for the bound value |
| `template-unreadable` | a template with an operator, a filter or a function that does not exist, or broken syntax | an operator, a filter or a function the interpreter has — the message names the one it could not read; `matches` never exists |
| `transformer-params` | a transformer param that does not exist, or a value outside its options | the params and values it lists |
| `trigger-interval` | an `onInterval` that never ticks: not a whole number of milliseconds, or below 250 | `onInterval(5000)` |
| `trigger-keys` | an `onKey` shortcut that cannot fire: two keys at once, only modifiers, or a name that is not a key | `onKey('f')`, `onKey('shift+f')`, `onKey('mod+k, escape')` |
| `trigger-never-fired` | a flow on an event the element never fires | the element that fires it; for a plugin, `declaredTrigger(declaration, 'onPick')` |
| `tw-class-conflict` | two classes set the same property and neither is the narrower one (`p-2 p-4`) | keep one |
| `tw-no-equivalent` | a Tailwind class or variant with no exact equivalent in a Plitzi style (`sm:`, `dark:`, `space-x-4`) | what the message names: `md:`/`lg:`/`max-md:`/`max-lg:`, a token with both themes, `gap` |
| `tw-unknown-class` | a class `tw()` does not know as Tailwind | the class it suggests; a colour of the space through `createTw({ colors })`; any CSS as `[property:value]` |
| `UNKNOWN_CSS_PROPERTY` | a property in the style document the style editor cannot read back | the property it suggests |
| `unknown-attribute` | an attribute the element does not have | one it lists; an event (`onClick`) is a flow: `flows: [[onClick(), …]]` |
| `unknown-field` | a field the space, a page, an element, a binding or a step does not have | the field it suggests; an element's attribute goes inside the factory's props (`button({ content })`) |
| `unknown-transformer` | a transformer that does not exist | one of the transformers it lists |
| `utility-module` | a utility sent to a module — a utility takes none | drop the `on` |
| `visibility-as-attribute` | `visibility` bound as an attribute, which no element reads | `visible: { source, template }` |
| `visitor-roles` | `settings.visitorRoles` written in a shape the runtime does not read | the shape the message gives |
| `while-running` | `whileRunning` on a step that is not the trigger, or a mode other than `skip`, `parallel`, `queue` | `[whileRunning('queue', onClick()), …]` |

## Warned

The space renders, and renders something you probably did not mean. Fix every one.

| Code | What was wrong | Write instead |
| --- | --- | --- |
| `click-on-static-element` | a click flow on a container, text, heading, image or list item — no keyboard reaches it | the flow on a `button` (it holds children) or a `link` |
| `colour-without-dark` | a colour token with no dark value | `{ light, dark, default }` |
| `condition-starts-visible` | a computed visibility that shows until its data answers | `visible: { source, template }` |
| `control-in-decorative` | a control inside a `decorative` container — Tab lands on something nothing announces | move it out of the illustration |
| `control-without-name` | a button or a link with no words, or a field nothing names | `title` on the button, `label` on the link, `label` (with `hideLabel: true`) on the field |
| `default-content-beside-children` | a button printing its default "Button" beside its children | `content: ''` |
| `dropdown-without-control` | a dropdown opened from a box or an icon — no keyboard opens it | a `button` as what opens it (`title` if it is only an icon) |
| `embed-without-title` | an `embed` with no `title` — a frame a screen reader cannot describe | say what it shows in `title` |
| `flag-rule-empty` | a flag rule with no conditions — skipped, never read as "always" | give it a condition, or set the flag's `value` instead |
| `flag-unused` | a declared flag nothing gates on and no template reads | gate what it switches (`flag: 'x'`), or remove it once the feature has shipped |
| `FORM_SUBMIT_UNMANAGED` | a form the browser would submit itself, reloading the page | `managedByInteractions: true` |
| `form-control-name-taken` | two controls in one form with one name — one overwrites the other | a name each |
| `form-control-unnamed` | a control in a form with no `name` — its value never reaches `values` | `formControl({ name: 'email', … })` |
| `form-value-compared-to-blank` | a `when` comparing a submitted field to `""` — a field nobody typed in is not sent | `operator: 'empty'` / `'notEmpty'` |
| `heading-level-skipped` | an `h4` right after an `h2` — the outline misses a level | the next level down; size it with its class |
| `image-without-alt` | an image that is not `decorative` and has no `alt` | say what it shows, or `decorative: true` |
| `label-ignored` | a `label` on a container whose tag is named by what it holds (`li`, a heading) | the words inside, or a landmark tag (`nav`, `section`…) |
| `list-item-key-missing` | a list's `itemKey` that some of its items lack, or two of them share — the rows fall back to `id`, then position | a field every item has, once each |
| `overlay-never-opened` | a modal or a dialog that starts hidden and that no step opens | a flow with `openModal('id')` / `openDialog('id')` |
| `overlay-starts-open` | a modal or a dialog open when the page loads | `visible: false`, opened by `openModal` |
| `painted-state-without-keep-state` | `paintedState` without `keepState` — nothing is kept for the server to draw with | `settings.keepState: true`, or remove `paintedState` |
| `provider-without-source` | an `apiContainer` that asks nothing | a `query` (or `action`, `connector`, `resource`) |
| `route-param-undeclared` | `navigation.routeParams.x` read on a page whose slug has no `:x` — always empty | add `:x` to the slug, or read `navigation.queryParams.x` |
| `server-data-without-rsc` | a `runtime: 'server'` provider with a `connector` or `action` in a space that does not turn server data on | `rsc: { enabled: true }` on the space |
| `span-holds-block` | a `container({ subType: 'span' })` holding a heading, a paragraph, a list, a form or prose | a `div` (leave `subType` out), or words: a `text` with `display: inline` in its class |
| `state-key-has-runtime-prefix` | a state key written with `runtime.state.` in front — the state callbacks already write below it | `key: 'cart'`, not `'runtime.state.cart'` |
| `state-toggled-in-branches` | two `setState` of one key, each under a `when` on that key — the second flips back what the first wrote | `toggleState({ key })`; for something shown by default, a key named for hiding it |
| `STYLE_WITHOUT_TAG` | style on a provider that renders no element of its own | `subType: 'div'` on the provider, or style its parent |
| `tablet-rule-skips-mobile` | a tablet rule phones never get — mobile inherits desktop, not tablet | write it under `compact` (tablet and mobile together) |
| `template-never-resolved` | a condition in an attribute, which only resolves `{{ name\|filter }}` — used as written | move it into `bindTemplate` |
| `transient-state-without-keep-state` | `transientState` without `keepState` — nothing is kept in the first place | `settings.keepState: true`, or remove `transientState` |
| `unknown-element-type` | a type no built-in element has | the built-in it suggests; a plugin's declaration goes in `authorSpace(space, { plugins: [declaration] })` |
| `unknown-global-callback` | a global callback no built-in source declares — it runs only if something registers it | the built-in it suggests, or make sure a plugin or module of the space registers it |
| `unknown-utility` | a utility that is not one of the built-in ones | one of the built-in utilities |
| `unknown-variable` | a `var(--x)` nothing in the space declares — the property it is in is dropped | declare it under `variables`, fix the name, or give it a fallback: `var(--x, …)` |

## UPPER_CASE codes

`ORPHANED_ELEMENT`, `DUPLICATE_ELEMENT_ID`, `BROKEN_FLOW_LINK` and the rest of the UPPER_CASE codes come from the
documents' own structure — what `validateSchema` checks of any schema. Authoring derives every id, parent link and
flow chain, so only a hand-written or hand-edited JSON has them: author it instead (see
[snippets and export](snippets-and-export.md) to turn a JSON into code).
