/* eslint-disable quotes -- the rows quote code, which reads best in the other quotes */
/**
 * Every problem `authorSpace` and `lintSpace` report, by its code: whether it is refused or warned, what was wrong, and
 * what to write instead — and every suggestion `suggestSpace` makes, a shorter way to the same page.
 *
 * The one table: a refusal or a warning raised with a code that is not here is a compile error, and the skill's
 * `authoring-errors.md` is generated from it (`yarn generate:authoring-errors`), so the page cannot miss one. The
 * UPPER_CASE codes beside these come from the documents' own structure (`validateSchema`) and only a hand-written or
 * hand-edited JSON has them — the three an authored space can meet are listed here too.
 */

export type AuthoringCodeEntry = {
  /**
   * Refused stops the space from being written; warned writes it, and says it will not do what it says; suggested is
   * not a problem at all — the page renders as written, and a shorter way to the same page exists.
   */
  kind: 'refused' | 'warned' | 'suggested';
  /** What was wrong, in a line. */
  means: string;
  /** What to write instead. */
  fix: string;
};

export const AUTHORING_CODES = {
  // The space and its settings.
  'no-pages': {
    kind: 'refused',
    means: 'a space with no pages',
    fix: "`pages: [{ id: 'home', name: 'Home', slug: '', body: [] }]`"
  },
  'setting-misplaced': {
    kind: 'refused',
    means: '`settings.computed` or `settings.channels` written inside `settings`',
    fix: '`computed` and `channels` at the top of the space'
  },
  'state-key-list': {
    kind: 'refused',
    means: '`settings.transientState` / `paintedState` that is not a list of top-level state keys',
    fix: "`transientState: ['demoStep']` — a dotted path names its top key"
  },
  'state-painted-and-transient': {
    kind: 'refused',
    means: 'a state key both painted (kept for the server) and transient (never kept)',
    fix: 'remove it from one of the two'
  },
  'transient-state-without-keep-state': {
    kind: 'warned',
    means: '`transientState` without `keepState` — nothing is kept in the first place',
    fix: '`settings.keepState: true`, or remove `transientState`'
  },
  'painted-state-without-keep-state': {
    kind: 'warned',
    means: '`paintedState` without `keepState` — nothing is kept for the server to draw with',
    fix: '`settings.keepState: true`, or remove `paintedState`'
  },
  'visitor-roles': {
    kind: 'refused',
    means: '`settings.visitorRoles` written in a shape the runtime does not read',
    fix: 'the shape the message gives'
  },
  'font-invalid': {
    kind: 'refused',
    means: 'a font the space cannot load as declared',
    fix: 'the field the message names'
  },
  'notifications-shape': {
    kind: 'refused',
    means: '`notifications` with a field it does not have, or a value that is not one CSS value',
    fix: "the field it suggests, or one it lists; one CSS value, like 'var(--card)', '12px' or '500'"
  },
  'unknown-field': {
    kind: 'refused',
    means: 'a field the space, a page, an element, a binding or a step does not have',
    fix: "the field it suggests; an element's attribute goes inside the factory's props (`button({ content })`)"
  },

  // Pages, folders, layouts and links.
  'page-without-slug': {
    kind: 'refused',
    means: 'a page with no `slug`',
    fix: "`slug: ''` for the home page, its path for any other: `'about'`, `'blog/:slug'`"
  },
  'page-route-taken': {
    kind: 'refused',
    means: 'two pages at one address for the same visitors',
    fix: "another slug — or `accessLevel` `'public'` on one and `'authenticated'` on the other"
  },
  'page-route-reserved': {
    kind: 'refused',
    means: "a page under `/fn`, where the space's functions answer",
    fix: 'another slug'
  },
  'page-access-level': {
    kind: 'refused',
    means: 'an `accessLevel` that is not one the router reads',
    fix: 'one of the values the message lists'
  },
  'page-target-unknown': {
    kind: 'refused',
    means: 'a link or `navigate` to a page id that does not exist',
    fix: "an existing page id, or a path with its slash (`'/about'`)"
  },
  'page-target-url': {
    kind: 'refused',
    means: 'a URL, `mailto:` or `tel:` in a link left in page mode',
    fix: "`mode: 'external'`"
  },
  'redirect-target-unknown': {
    kind: 'refused',
    means: 'a page that sends visitors it is not for to a page the space does not have',
    fix: "a page's id or slug (`''` is the home page), or a full URL"
  },
  'page-template': {
    kind: 'refused',
    means:
      "a template in a page's `seoTitle`, `seoDescription` or `notFound` that reads what is not there when the server answers — anything but the page's `runtime: 'server'` providers and `navigation` — or cannot be read",
    fix: "read the record from a provider with `runtime: 'server'` on the page or its layout — `'{{ apiContainer_post.title }} — Blog'` — or words of its own"
  },
  'folder-undeclared': {
    kind: 'refused',
    means: 'a page, a layout or a folder filed in a folder the space does not declare',
    fix: 'declare the folder, or the name it suggests'
  },
  'folder-cycle': {
    kind: 'refused',
    means: 'a page folder inside itself',
    fix: 'a `parent` that leads to the top'
  },
  'layout-undeclared': {
    kind: 'refused',
    means: 'a page or a layout inside a layout the space does not declare',
    fix: "the layout's id, or declare it in `layouts`"
  },
  'layout-slot-unknown': {
    kind: 'refused',
    means: 'a layout `slot` that is not an element inside that layout',
    fix: 'the id of the element in the shell where the body goes'
  },

  // Anchors.
  'motion-invalid': {
    kind: 'refused',
    means: 'a `motion` with a preset, a trigger or a timing the page cannot play',
    fix: "`motion: { enter: 'fade-up', on: 'view' }` — the message lists the presets"
  },
  'motion-no-tag': {
    kind: 'refused',
    means: 'a `motion` on an element with no tag of its own — nothing to move',
    fix: 'the motion on what it wraps, or a `subType` on it'
  },
  'anchor-invalid': {
    kind: 'refused',
    means: "an `anchor` or a link's `hash` that is not lowercase letters, digits and `-`",
    fix: "`anchor: 'plans'`, `hash: 'plans'` — no `#`"
  },
  'anchor-no-tag': {
    kind: 'refused',
    means: 'an anchor on an element that renders no element of its own',
    fix: "the anchor on the element around it, or `subType: 'div'` on the provider"
  },
  'anchor-repeated': {
    kind: 'refused',
    means: 'an anchor inside a list row or a component — it would be in the page once per row or instance',
    fix: 'the anchor on the list, or on the element around the instance'
  },
  'anchor-duplicate': {
    kind: 'refused',
    means: 'one anchor on two elements of the same page (layouts included)',
    fix: 'rename all but one'
  },
  'anchor-missing': {
    kind: 'refused',
    means: 'a link whose `hash` no element on the page it goes to carries — it would land at the top',
    fix: 'the anchor the message lists, or give the section that `anchor`'
  },
  'link-current-section': {
    kind: 'warned',
    means: "`current: 'section'` on a link that is never current (an external one) or current everywhere (to `/`)",
    fix: "leave `current` out — `'section'` is for a link to a section's own page, `/automations/runs`"
  },

  // Ids, classes and selectors.
  'id-invalid': {
    kind: 'refused',
    means: 'an id a binding, a template or a test cannot name',
    fix: "a letter first, then letters, digits, `-` and `_`: `'hero-title'`"
  },
  'controls-no-anchor': {
    kind: 'warned',
    means: "a button's `controls` naming no anchor — `aria-controls` points at nothing",
    fix: 'an `anchor` on the element it shows and hides, and `controls` naming it'
  },
  'quiet-unknown': {
    kind: 'refused',
    means: "an element's `quiet` naming something that is not a suggestion's code — a problem is never quieted",
    fix: "the code of the suggestion it was offered: `quiet: ['repeated-shape']`"
  },
  'controls-unknown': {
    kind: 'refused',
    means: "a button's `controls` naming no element of the space",
    fix: "the id of the element it shows and hides: `controls: 'faq-answer'`"
  },
  'id-taken': {
    kind: 'refused',
    means: 'two elements with one id — ids are one namespace for the whole space',
    fix: "a name taken by a page or a layout: a name of its own; a helper called twice: `scope('promos', ref => …)`, every id inside prefixed"
  },
  'id-shadows-global': {
    kind: 'refused',
    means: 'an element named like a global data source (`state`, `navigation`, `auth`…)',
    fix: 'another id'
  },
  'class-undeclared': {
    kind: 'refused',
    means: 'a class name the space does not declare',
    fix: 'declare it in `classes`, hand the `styles()` declaration itself, or write the rules with `css`'
  },
  'element-slot-unknown': {
    kind: 'refused',
    means: 'a `slots` key the element type does not have — its class would dress nothing',
    fix: 'one of the slots `plitzi explain <type>` lists; the element itself takes `class`'
  },
  'class-conflict': {
    kind: 'refused',
    means: 'two different declarations for one class name',
    fix: 'rename one, or make them agree'
  },
  'class-listed-under-other-name': {
    kind: 'refused',
    means: 'a `styles()` declaration listed in `classes` under another name',
    fix: 'list it under its own name'
  },
  'class-and-css': {
    kind: 'refused',
    means: 'an element wearing a shared class AND `css` or `states` of its own — it has one base selector',
    fix: "the rules on top of the class: `class: [card, { opacity: '0.5' }]` — or into the class"
  },
  'class-and-selector': {
    kind: 'refused',
    means: 'an element with a shared class and a `selector` of its own',
    fix: 'drop one: a shared class IS its selector'
  },
  'modifier-count': {
    kind: 'refused',
    means: 'more than one set of rules in a class list',
    fix: "one set, after the classes: `class: [card, { opacity: '0.5', 'margin-top': '8px' }]`"
  },
  'selector-invalid': {
    kind: 'refused',
    means: 'a `selector` that is not a CSS class name',
    fix: 'letters, digits, `-` and `_`'
  },
  'selector-taken': {
    kind: 'refused',
    means: "a `selector` that is a declared class, or another element's",
    fix: "`class` to share rules; a selector of an element's own is its alone"
  },

  // CSS.
  'css-value': {
    kind: 'refused',
    means: 'an empty CSS value, or one with `;` or `{}`',
    fix: 'one value per property; leave a property out instead of writing it empty'
  },
  'css-property-twice': {
    kind: 'refused',
    means: "one property written twice in a rule set — `paddingTop` beside `'padding-top'` — so one would silently win",
    fix: 'keep one'
  },
  'css-property-unknown': {
    kind: 'refused',
    means: 'a CSS property that does not exist',
    fix: 'the property it suggests; a custom property starts with `--`'
  },
  UNKNOWN_CSS_PROPERTY: {
    kind: 'refused',
    means: 'a property in the style document the style editor cannot read back',
    fix: 'the property it suggests'
  },
  'rule-set-mixed': {
    kind: 'refused',
    means: 'a style that writes its rules beside `states`, `variants` or `ancestors` instead of under `css`',
    fix: '`{ css: { desktop: { … } }, states: { hover: { … } } }` — the rules under `css`, each of the others beside it'
  },
  'style-state-unknown': {
    kind: 'refused',
    means: 'a state a selector does not react to',
    fix: 'one of the states it lists (`hover`, `focus`, `active`…)'
  },
  'ancestor-not-class': {
    kind: 'refused',
    means: "an ancestor condition keyed by something that is neither a class name nor `'>'` (the parent)",
    fix: "`[card.name]` for a `styles()` declaration, or `'>'` for the parent whatever it wears"
  },
  'focus-on-field-box': {
    kind: 'warned',
    means:
      "a `focus` or `focus-visible` state on a text field's or a select's `input` slot — the box the field is drawn in, which never takes focus, so no ring is ever shown",
    fix: "`'focus-within'` on the same class, or the state on the `field` slot"
  },
  'heading-level-overridden': {
    kind: 'warned',
    means:
      "a markdown's or richText's `heading` slot and a level's (`heading3`) both setting one property, the general class written later in the stylesheet — the level's value is lost",
    fix: 'set the property on one of the two: the level slot for that level alone, `heading` for every heading'
  },
  'style-pseudo-unknown': {
    kind: 'refused',
    means: 'a pseudo-element a class cannot dress',
    fix: 'one of `before`, `after`, `marker`, `placeholder`, `first-letter`, `first-line`, `selection` — without the `::`'
  },
  'style-pseudo-property': {
    kind: 'refused',
    means: 'a property the pseudo-element ignores — the browser drops it without a word',
    fix: 'one it honours (`::selection` paints, `::marker` and `::placeholder` take text and font), or style the element'
  },
  'style-pseudo-content': {
    kind: 'refused',
    means:
      'a `content` CSS cannot read — text without its quotes draws nothing — or a `before`/`after` with no `content`, which is not there at all',
    fix: 'the text in quotes inside the string — `content: \'"→"\'`, `\'""\'` for an empty box — or a function such as `counter(step)`'
  },
  'style-condition-unknown': {
    kind: 'refused',
    means: "a condition a class's rules cannot hold under",
    fix: '`motion-reduce`, `motion-safe`, or a container width — `container (max-width: 30rem)`, `container card (min-width: 480px)`'
  },
  'keyframes-shape': {
    kind: 'refused',
    means: 'keyframes with a name CSS does not accept or the SDK keeps for itself, or a frame that is not an offset',
    fix: "a plain name (`slide-in`), frames keyed `from`, `to` or a percentage (`'50%'`, `'0%, 100%'`)"
  },
  'animation-name-unknown': {
    kind: 'warned',
    means: '`animation-name` naming keyframes the space does not declare — nothing plays',
    fix: "declare them in the space's `keyframes`, or name one it has"
  },
  'tablet-rule-skips-mobile': {
    kind: 'warned',
    means: 'a tablet rule phones never get — mobile inherits desktop, not tablet',
    fix: 'write it under `compact` (tablet and mobile together)'
  },
  'tw-unknown-class': {
    kind: 'refused',
    means: 'a class `tw()` does not know as Tailwind',
    fix: 'the class it suggests; a colour of the space through `createTw({ colors })`; any CSS as `[property:value]`'
  },
  'tw-no-equivalent': {
    kind: 'refused',
    means: 'a Tailwind class or variant with no exact equivalent in a Plitzi style (`sm:`, `dark:`, `space-x-4`)',
    fix: 'what the message names: `md:`/`lg:`/`max-md:`/`max-lg:`, a token with both themes, `gap`'
  },
  'tw-class-conflict': {
    kind: 'refused',
    means: 'two classes set the same property and neither is the narrower one (`p-2 p-4`)',
    fix: 'keep one'
  },
  'unknown-variable': {
    kind: 'warned',
    means: 'a `var(--x)` nothing in the space declares — the property it is in is dropped',
    fix: 'declare it under `variables`, fix the name, or give it a fallback: `var(--x, …)`'
  },
  'colour-without-dark': {
    kind: 'warned',
    means: 'a colour token with no dark value',
    fix: '`{ light, dark, default }`'
  },
  STYLE_WITHOUT_TAG: {
    kind: 'warned',
    means: 'style on a provider that renders no element of its own',
    fix: "`subType: 'div'` on the provider, or style its parent"
  },

  // Elements and their attributes.
  'element-shape': {
    kind: 'refused',
    means: 'an element that is not an object with a `type`, `attributes` and a list of `children`',
    fix: 'build elements with their factories — `text(…)`, `container(…)`'
  },
  'element-rejected': {
    kind: 'refused',
    means: 'an element the schema refused to hold',
    fix: 'the problem listed with it'
  },
  'unknown-element-type': {
    kind: 'warned',
    means: 'a type no built-in element has',
    fix: "the built-in it suggests; a plugin's declaration goes in `authorSpace(space, { plugins: [declaration] })`"
  },
  'plugin-attribute-reserved': {
    kind: 'warned',
    means: 'a plugin attribute named as one of the element’s own fields — a factory never hands it to the plugin',
    fix: 'rename it in the plugin (`variant` → `kind`)'
  },
  'unknown-variant': {
    kind: 'warned',
    means: 'a variant no class of the element and no style of its type declares — nothing applies',
    fix: 'declare it (`styles(name, { variants: { … } })`), or name one that is'
  },
  'unknown-attribute': {
    kind: 'refused',
    means: 'an attribute the element does not have',
    fix: 'one it lists; an event (`onClick`) is a flow: `flows: [[onClick(), …]]`'
  },
  'attribute-value': {
    kind: 'refused',
    means: "a value outside the attribute's list (`subType: 'h7'`)",
    fix: 'one of the listed values'
  },
  'attribute-kind': {
    kind: 'refused',
    means: 'text where a flag or a list is read',
    fix: "`disabled: true`, not `'true'`; `items: [ … ]`"
  },
  'element-runtime': {
    kind: 'refused',
    means: 'a `runtime` the element does not run in',
    fix: 'one of the values the message lists'
  },
  'element-load-strategy': {
    kind: 'refused',
    means: 'a `loadStrategy` the element does not take',
    fix: 'one of the values the message lists'
  },
  'children-in-leaf': {
    kind: 'refused',
    means: 'children on a type that renders only its own attributes (`heading`, `text`, `image`…)',
    fix: "a `container` — for a heading made of parts, `container({ subType: 'h1', children })`"
  },
  'span-holds-block': {
    kind: 'warned',
    means: "a `container` with `subType: 'span'` or `'p'` holding a heading, a paragraph, a list, a form or prose",
    fix: 'a `div` (leave `subType` out), or words and inline elements: a `text`, a `link`'
  },
  'part-missing': {
    kind: 'refused',
    means: 'a compound element — a carousel, a tab container, a dropdown — without a part it renders through',
    fix: 'the part the message names, inside it (`carousel()` writes its own track)'
  },
  'outside-ancestor': {
    kind: 'refused',
    means: 'an element that reads the state of an element it is not inside',
    fix: 'nest it in the element the message names'
  },
  'default-content-beside-children': {
    kind: 'warned',
    means: 'a button printing its default "Button" beside its children',
    fix: "`content: ''`"
  },
  'loading-slot-unknown': {
    kind: 'refused',
    means: "an `apiContainer`'s `loadingSlot` that is not the id of one of its children",
    fix: "the id of the child to show until the first answer — `loadingSlot: 'catalog-skeleton'` beside that child"
  },
  'row-and-children': {
    kind: 'refused',
    means: 'a list with a `row` and `children` — the row is what it renders',
    fix: 'one of the two'
  },
  'row-without-id': {
    kind: 'refused',
    means: "a list whose `row` is a function, with no `id` — the row's sources are named after it",
    fix: "`list({ id: 'products', items, row: r => … })`"
  },
  'row-outside-list': {
    kind: 'refused',
    means: '`row` on an element that is not a list',
    fix: 'a `list` around it'
  },
  'source-field-unknown': {
    kind: 'refused',
    means: 'a path into a typed source that its sample does not have',
    fix: 'read a field the sample has, or add the field to the sample'
  },
  'svg-not-svg': {
    kind: 'refused',
    means: 'an `svg` whose `content` is not one `<svg>…</svg>` — it draws nothing',
    fix: 'the SVG markup alone; HTML around it goes in a `blockHtml`'
  },
  'row-component': {
    kind: 'refused',
    means: "a list's `row` naming a component the space does not declare, or one with no prop to take the row",
    fix: 'a declared component with an `item` prop — or a single prop — for the row'
  },
  'list-without-items': {
    kind: 'refused',
    means: 'a controlled list with nothing to render',
    fix: "`items: [ … ]` or `bind: { items: 'provider.data.rows' }`"
  },
  'list-row-not-li': {
    kind: 'warned',
    means:
      'a row of a list with `items` that is not an `<li>` — that list is a `<ul>` (or `<ol>`), so the row is a box inside a list, no item to a screen reader',
    fix: "`container({ subType: 'li' })` — or the component's root one, or a wrapper for a link or a button"
  },
  'list-item-key-missing': {
    kind: 'warned',
    means:
      "a list's `itemKey` that some of its items lack, or two of them share — the rows fall back to `id`, then position",
    fix: 'a field every item has, once each'
  },
  'list-items-ignored': {
    kind: 'refused',
    means: "a list whose items nothing reads — `source: 'none'` renders its children once",
    fix: "`source: 'controlled'`"
  },
  'overlay-starts-open': {
    kind: 'warned',
    means: 'a modal or a dialog open when the page loads',
    fix: '`visible: false`, opened by `openModal`'
  },
  'overlay-never-opened': {
    kind: 'warned',
    means: 'a modal or a dialog that starts hidden and that no step opens',
    fix: "a flow with `openModal('id')` / `openDialog('id')`"
  },
  'provider-without-source': {
    kind: 'warned',
    means: 'an `apiContainer` that asks nothing',
    fix: 'a `query` (or `action`, `connector`, `resource`)'
  },
  'action-output-path': {
    kind: 'warned',
    means:
      'a read of `.data` on a provider fed by a server action — it publishes the action’s output at its root, and `.data` is a `query` provider’s answer',
    fix: 'the output’s own field — `apiContainer_feed.stories`, not `apiContainer_feed.data.stories`'
  },
  'path-not-in-data': {
    kind: 'warned',
    means:
      'a binding onto a provider whose answer the author could read (`data`), through a path that answer does not have',
    fix: 'the path the message lists the keys for — `p.data.plans`, not `p.data.landing.plans`'
  },
  'server-provider-in-component': {
    kind: 'refused',
    means:
      "a `runtime: 'server'` element inside a component: the page server resolves a page's and its layouts', never a component's",
    fix: 'put the provider on the page, around the instance, and hand the component its rows as a prop'
  },
  'template-in-value': {
    kind: 'refused',
    means:
      "a `{{ }}` inside an attribute that is an object or a list — a provider's `input`, a list's `items`, a plugin's settings: only an attribute that is text is evaluated",
    fix: "a binding on the attribute (`bindTemplate(name, source, template, { returns: 'value' })`); for a provider's `input`, nothing for a route or query param — the action is already handed them as `input.<name>`"
  },
  'not-found-in-browser': {
    kind: 'refused',
    means:
      '`notFound` on a provider asked from the browser — its answer arrives after the page was sent with its status',
    fix: "`runtime: 'server'` on the provider, or `visible` on the page's \"not found\" part instead"
  },
  'not-found-not-a-template': {
    kind: 'refused',
    means: "`notFound`, a provider's or a page's, that is not one `{{ expression }}` — never `true`, so never a 404",
    fix: "`notFound: '{{ source.found == false }}'`"
  },
  'server-data-in-browser': {
    kind: 'refused',
    means:
      "a provider asking for the project's own data (`/data/…`, read by its server from `src/data/` and never served) from the browser",
    fix: "`runtime: 'server'` on the provider: the page arrives with the data in it"
  },
  'server-data-without-rsc': {
    kind: 'warned',
    means:
      "a `runtime: 'server'` provider — `connector`, `action` or `query` — in a space that turns server data off (`rsc: { enabled: false }`)",
    fix: 'drop `rsc: { enabled: false }`: server data is on unless a space turns it off'
  },
  'route-param-undeclared': {
    kind: 'warned',
    means: '`navigation.routeParams.x` read on a page whose slug has no `:x` — always empty',
    fix: 'add `:x` to the slug, or read `navigation.queryParams.x`'
  },
  'form-control-unnamed': {
    kind: 'warned',
    means: 'a control in a form with no `name` — its value never reaches `values`',
    fix: "`formControl({ name: 'email', … })`"
  },
  'required-message-unused': {
    kind: 'warned',
    means:
      'a `requiredMessage` on a field nothing requires — fields are optional unless `required: true`, so it is never shown and an empty answer is sent',
    fix: '`required: true` on the field, or no message'
  },
  'form-control-name-taken': {
    kind: 'warned',
    means: 'two controls in one form with one name — one overwrites the other',
    fix: 'a name each'
  },
  FORM_SUBMIT_UNMANAGED: {
    kind: 'warned',
    means: 'a form the browser would submit itself, reloading the page',
    fix: '`managedByInteractions: true`'
  },

  // Bindings and templates.
  'from-without-attribute': {
    kind: 'refused',
    means: '`from` on a type with no one attribute that shows its data (a container, a form)',
    fix: "bind the attribute you mean: `bind: { attribute: 'source' }`"
  },
  'from-and-bind': {
    kind: 'refused',
    means: 'the main attribute bound twice, with `from` and in `bind`',
    fix: 'keep `from`, and give `bind` the other attributes'
  },
  'as-without-from': {
    kind: 'refused',
    means: '`as` with no `from` — `as` is how the source `from` names is shown',
    fix: "`from: 'products.item.price', as: 'price'`"
  },
  'format-unknown': {
    kind: 'refused',
    means: "an `as` that names no format of the space's `formats`",
    fix: 'declare it once — `formats: { price: "{{ source|currency(\'USD\') }}" }` — or write the template in its place'
  },
  'binding-shape': {
    kind: 'refused',
    means: 'a binding with no `to` or no `source`',
    fix: "`bind: { content: 'posts.item.title' }`, or `bindTemplate(to, source, template)`"
  },
  'binding-category': {
    kind: 'refused',
    means: 'a binding `category` that does not exist',
    fix: 'one of the categories it lists'
  },
  'binding-source-unknown': {
    kind: 'refused',
    means: 'a binding whose source names an element that does not exist, or with its prefix written wrong',
    fix: 'the id of the element that publishes it, written alone — the prefix is filled in'
  },
  'binding-source-out-of-scope': {
    kind: 'refused',
    means: 'a source read by an element that is not inside the element publishing it',
    fix: 'move the element inside it, or share the value through `state`'
  },
  'binding-target-unknown': {
    kind: 'refused',
    means: 'a binding onto an attribute the element does not have — the value arrives and nothing shows it',
    fix: 'one it lists (`content`); to follow data with a class, `variantFrom`'
  },
  'active-when-constant': {
    kind: 'refused',
    means: 'an `activeWhen` condition that reads nothing — always or never true',
    fix: "name what it depends on: `'{{ list_dots.index == state.slide }}'`"
  },
  'visibility-as-attribute': {
    kind: 'refused',
    means: '`visibility` bound as an attribute, which no element reads',
    fix: '`visible: { source, template }`'
  },
  'unknown-transformer': {
    kind: 'refused',
    means: 'a transformer that does not exist',
    fix: 'one of the transformers it lists'
  },
  'transformer-params': {
    kind: 'refused',
    means: 'a transformer param that does not exist, or a value outside its options',
    fix: 'the params and values it lists'
  },
  'template-text-into-value': {
    kind: 'refused',
    means: 'a template, which renders text, feeding an attribute that holds a list or an object',
    fix: "`bindTemplate('items', source, '{{ … }}', { returns: 'value' })`"
  },
  'template-unreadable': {
    kind: 'refused',
    means: 'a template with an operator, a filter or a function that does not exist, or broken syntax',
    fix: 'an operator, a filter or a function the interpreter has — the message names the one it could not read; `matches` never exists'
  },
  'template-unknown-name': {
    kind: 'refused',
    means: 'a name in a template that is not a source, a variable or a route param',
    fix: 'the full source name (`list_rows.item`), `navigation.queryParams.x`, or `source` for the bound value'
  },
  'template-short-source': {
    kind: 'refused',
    means: 'a source named without its prefix inside a template or a step',
    fix: 'the full name: `apiContainer_stats`, `list_rows`'
  },
  'template-source-out-of-scope': {
    kind: 'refused',
    means: 'a template reading the source of an element it is not inside',
    fix: 'move the element inside it, or share the value through `state`'
  },
  'template-never-resolved': {
    kind: 'warned',
    means: 'a condition in an attribute, which only resolves `{{ name|filter }}` — used as written',
    fix: 'move it into `bindTemplate`'
  },
  'condition-starts-visible': {
    kind: 'warned',
    means: 'a computed visibility that shows until its data answers',
    fix: '`visible: { source, template }`'
  },
  'computed-name': {
    kind: 'refused',
    means: 'a computed value whose name a template cannot read as `computed.x`',
    fix: 'letters, digits and `_`'
  },
  'computed-not-template': {
    kind: 'refused',
    means: 'a computed value that is not a template',
    fix: "`'{{ state.x * 2 }}'`"
  },
  'computed-reads-element': {
    kind: 'refused',
    means: "a computed value reading an element's source — no element is around the whole space",
    fix: 'compute it from the globals and the variables, or bind it on the element'
  },
  'computed-unknown': {
    kind: 'refused',
    means: 'a computed value read before it is declared, or never declared',
    fix: 'declare it in `computed`, above the one that reads it'
  },
  'global-field-unknown': {
    kind: 'refused',
    means:
      'a binding, a template or a `when` reading a field `navigation`, `auth` or `theme` never has — `auth.authenticated`',
    fix: 'the field it suggests: `auth.isAuthenticated`, `auth.details.username`, `navigation.queryParams.next`, `theme.resolved`'
  },

  // Components.
  'component-id': {
    kind: 'refused',
    means: 'a component whose `id` is not a name it can be placed by',
    fix: 'a letter first, then letters, digits, `-` and `_`'
  },
  'component-duplicate': {
    kind: 'refused',
    means: 'two components with one id',
    fix: 'a name each'
  },
  'component-undeclared': {
    kind: 'refused',
    means: 'an instance of a component the space does not declare',
    fix: 'the id it suggests, or declare it in `components`'
  },
  'prop-name': {
    kind: 'refused',
    means: 'a prop whose name a template cannot read as `props.x`',
    fix: 'letters, digits and `_`'
  },
  'prop-type-unknown': {
    kind: 'refused',
    means: 'a prop declared with a type no editor offers and nothing checks a value against',
    fix: 'one of text, textarea, select, boolean, number, scalar, json, elementIds — words are `text`'
  },
  'prop-unknown': {
    kind: 'refused',
    means: 'a prop the component does not declare, handed in or read',
    fix: "the prop it suggests, or declare it: `props: { name: { type: 'text' } }`"
  },
  'prop-missing': {
    kind: 'refused',
    means: 'an instance without a prop its component requires',
    fix: "`component('card', { props: { name: … } })`, or bind it"
  },
  'prop-value': {
    kind: 'refused',
    means: 'a prop handed in with a value its declaration does not take',
    fix: 'a value of the declared type, or one of its options'
  },
  'props-outside-component': {
    kind: 'refused',
    means: '`props.x` read outside a component',
    fix: 'read the source it would have come from'
  },
  'slot-unknown': {
    kind: 'refused',
    means: 'a component slot that is not an element of its tree',
    fix: 'the id of an element inside the component — usually an empty container'
  },
  'slot-children': {
    kind: 'refused',
    means: 'children handed to an instance outside its slots',
    fix: '`children: { slotName: [ … ] }`; a component with no slots takes no children'
  },

  // Feature flags.
  'flag-gate': {
    kind: 'refused',
    means: "an element's or a page's `flag` that is not a flag name",
    fix: "`flag: 'newCheckout'`, or `flag: '!newCheckout'` for \"only while off\""
  },
  'flag-undeclared': {
    kind: 'refused',
    means: 'a gate on a flag the space does not declare — it reads as off, so the element never (or always) renders',
    fix: 'declare it in `flags`, or remove the gate'
  },
  'flag-unknown': {
    kind: 'refused',
    means: 'a template, a binding or a `when` reading a flag the space does not declare',
    fix: 'the declared name it suggests, or declare it'
  },
  'flag-name': {
    kind: 'refused',
    means: 'a flag whose name a template cannot read as `flags.x`',
    fix: 'letters, digits and `_`'
  },
  'flag-shape': {
    kind: 'refused',
    means: 'a flag whose `value` is not `true` or `false`',
    fix: '`{ value: false, rules: [] }`'
  },
  'flag-rule-shape': {
    kind: 'refused',
    means: 'a flag rule that is not `{ when, value }`, or whose `value` is not `true` or `false`',
    fix: '`{ when: { … }, value: true }`'
  },
  'flag-rule-empty': {
    kind: 'warned',
    means: 'a flag rule with no conditions — skipped, never read as "always"',
    fix: "give it a condition, or set the flag's `value` instead"
  },
  'flag-unused': {
    kind: 'warned',
    means: 'a declared flag nothing gates on and no template reads',
    fix: "gate what it switches (`flag: 'x'`), or remove it once the feature has shipped"
  },

  // Flows and steps.
  'flow-empty': {
    kind: 'refused',
    means: 'a flow with no steps',
    fix: '`[onClick(), setState({ … })]`'
  },
  'flow-without-trigger': {
    kind: 'refused',
    means: 'a flow whose first step is not the event that runs it',
    fix: '`[onClick(), setState(…)]`'
  },
  'step-name': {
    kind: 'refused',
    means: 'a step name a later step cannot read as `{{ name.field }}`',
    fix: 'a letter first, then letters, digits, `-` and `_`'
  },
  'step-duplicate': {
    kind: 'refused',
    means: 'two steps with one name in a flow or an action',
    fix: 'a name each'
  },
  'step-type': {
    kind: 'refused',
    means: 'a step `type` that does not exist',
    fix: 'the step builders — `setState(…)`, `navigate(…)` — write it'
  },
  'step-params': {
    kind: 'refused',
    means: 'a step param that does not exist, or a value outside its options',
    fix: 'the params and values it lists'
  },
  'element-ids-target': {
    kind: 'refused',
    means:
      'a step refreshing containers by id (`invalidateElements`, `invalidateQueries({ elements })`) naming one the space does not have, or one that is not an `apiContainer`',
    fix: "the id of the `apiContainer` whose data the step changes: `invalidateElements: ['posts']`"
  },
  'trigger-never-fired': {
    kind: 'refused',
    means: 'a flow on an event the element never fires',
    fix: "the element that fires it; for a plugin, `declaredTrigger(declaration, 'onPick')`"
  },
  'trigger-keys': {
    kind: 'refused',
    means: 'an `onKey` shortcut that cannot fire: two keys at once, only modifiers, or a name that is not a key',
    fix: "`onKey('f')`, `onKey('shift+f')`, `onKey('mod+k, escape')`"
  },
  'trigger-interval': {
    kind: 'refused',
    means: 'an `onInterval` that never ticks: not a whole number of milliseconds, or below 250',
    fix: '`onInterval(5000)`'
  },
  'while-running': {
    kind: 'refused',
    means:
      '`whileRunning` on a step that is not the trigger, or a mode other than `skip`, `parallel`, `queue`, `latest`',
    fix: "`[whileRunning('queue', onClick()), …]`"
  },
  'callback-not-answered': {
    kind: 'refused',
    means: 'a step sending an action the target element never answers to',
    fix: "the element that answers it; for a plugin, `declaredCallback(declaration, 'reset', { on })`"
  },
  'callback-key-unknown': {
    kind: 'refused',
    means: 'a `setState` / `toggleState` on an element writing a field it does not have',
    fix: "an attribute it lists, or for `category: 'state'` `visibility` / `styleSelectors.<selector>`"
  },
  'global-callback-undeclared': {
    kind: 'refused',
    means: 'a global-callback step builder naming an action no source declares',
    fix: 'one of the actions it lists'
  },
  'global-callback-module': {
    kind: 'refused',
    means: 'a global callback sent to a module other than the one that registers it',
    fix: 'the step builder, which knows the module'
  },
  'unknown-global-callback': {
    kind: 'warned',
    means: 'a global callback no built-in source declares — it runs only if something registers it',
    fix: 'the built-in it suggests, or make sure a plugin or module of the space registers it'
  },
  'utility-module': {
    kind: 'refused',
    means: 'a utility sent to a module — a utility takes none',
    fix: 'drop the `on`'
  },
  'unknown-utility': {
    kind: 'warned',
    means: 'a utility that is not one of the built-in ones',
    fix: 'one of the built-in utilities'
  },
  'state-key-has-runtime-prefix': {
    kind: 'warned',
    means: 'a state key written with `runtime.state.` in front — the state callbacks already write below it',
    fix: "`key: 'cart'`, not `'runtime.state.cart'`"
  },
  'state-toggled-in-branches': {
    kind: 'warned',
    means: 'two `setState` of one key, each under a `when` on that key — the second flips back what the first wrote',
    fix: '`toggleState({ key })`; for something shown by default, a key named for hiding it'
  },
  'form-value-compared-to-blank': {
    kind: 'warned',
    means: 'a `when` comparing a submitted field to `""` — a field nobody typed in is not sent',
    fix: "`operator: 'empty'` / `'notEmpty'`"
  },
  'condition-field-unpublished': {
    kind: 'refused',
    means:
      'a `when` asking a step of its flow for a key it never publishes — `whenSucceeded` / `whenFailed` on anything but `runServerAction`',
    fix: "a key the step publishes (`explain <step>`): after `authLogin`, `when({ field: 'signedIn.ok', operator: '=', value: true }, …)`"
  },

  // Server actions.
  'action-without-entry': {
    kind: 'refused',
    means: 'an action with no way in, so nothing can start it',
    fix: "a `trigger` — `{ type: 'call', access }`, or `render`, `webhook`, `custom`, `schedule`"
  },
  'action-without-steps': {
    kind: 'refused',
    means: 'an action with no steps',
    fix: 'the steps it runs'
  },
  'action-step-params': {
    kind: 'refused',
    means: 'a step with no params in an action whose ways in declare different inputs',
    fix: "the step's params"
  },

  // Realtime channels.
  'channel-declaration': {
    kind: 'refused',
    means: 'a channel whose pattern or access the server cannot read',
    fix: "what the message says: `{ access: { mode: 'public' } }`, a pattern like `room:{id}`"
  },
  'channel-topic': {
    kind: 'refused',
    means: 'a `channel` element with no topic',
    fix: 'a topic a channel of the space covers'
  },
  'channel-grant': {
    kind: 'refused',
    means: 'a topic of a private channel opened with no grant to it',
    fix: 'the grant the message names, or a public channel'
  },

  // Accessibility.
  'control-without-name': {
    kind: 'warned',
    means: 'a button or a link with no words, or a field nothing names',
    fix: '`title` on the button, `label` on the link, `label` (with `hideLabel: true`) on the field'
  },
  'embed-without-title': {
    kind: 'warned',
    means: 'an `embed` with no `title` — a frame a screen reader cannot describe',
    fix: 'say what it shows in `title`'
  },
  'image-without-alt': {
    kind: 'warned',
    means: 'an image that is not `decorative` and has no `alt`',
    fix: 'say what it shows, or `decorative: true`'
  },
  'click-on-static-element': {
    kind: 'warned',
    means: 'a click flow on a container, text, heading, image or list item — no keyboard reaches it',
    fix: 'the flow on a `button` (it holds children) or a `link`'
  },
  'heading-level-skipped': {
    kind: 'warned',
    means: 'an `h4` right after an `h2` — the outline misses a level',
    fix: 'the next level down; size it with its class'
  },
  'label-ignored': {
    kind: 'warned',
    means: 'a `label` on a container whose tag is named by what it holds (`li`, a heading)',
    fix: 'the words inside, or a landmark tag (`nav`, `section`…)'
  },
  'dropdown-without-control': {
    kind: 'warned',
    means: 'a dropdown opened from a box or an icon — no keyboard opens it',
    fix: 'a `button` as what opens it (`title` if it is only an icon)'
  },
  'control-in-decorative': {
    kind: 'warned',
    means: 'a control inside a `decorative` container — Tab lands on something nothing announces',
    fix: 'move it out of the illustration'
  },

  // Suggestions: nothing is wrong, and the same page can be written with fewer elements or less CSS.
  'repeated-on-pages': {
    kind: 'suggested',
    means: 'the same block — a header, a footer, a side panel — written into several pages',
    fix: 'a layout holding it once (`layouts`, and `layout: { id, slot }` on each page) — a component when only some pages of a layout carry it; a link marks its own page with the `current` state'
  },
  'repeated-shape': {
    kind: 'suggested',
    means: 'the same structure written again and again with different words — cards, rows, tiles',
    fix: 'a component with props (`components`, `component(id, { props })`), or one `list` when they are rows of data side by side — a few cards a person rewords on the canvas can stay cards'
  },
  'content-attribute': {
    kind: 'suggested',
    means:
      'a button or a link whose children are only its words and an icon — a `text`, a `fontAwesome` — elements more than it needs',
    fix: "its own `content` and `icon` (`link({ href, content: 'Docs', icon: 'fa-solid fa-arrow-right', iconPlacement: 'after' })`); the icon's class goes on the `icon` slot, and what the text's class adds on the box's class, never the class itself"
  },
  'custom-css-class': {
    kind: 'suggested',
    means: 'a `customCss` rule a class can hold — `.card:hover`, `.panel .icon`',
    fix: "the class's own `states` or `ancestors`, where the style editor reads it back and a breakpoint can change it"
  },
  'custom-css-sdk-default': {
    kind: 'suggested',
    means:
      '`customCss` repeating what the SDK already does for every space — less motion when asked, the theme toggle showing one icon',
    fix: 'nothing: remove it'
  },
  'custom-css-slot': {
    kind: 'suggested',
    means:
      "a part of a built-in element dressed in `customCss` by the SDK's markup — a form control's `<input>`, a pager's buttons, a heading inside a markdown",
    fix: 'a class on the slot of that part — `slots: { field: input }`, `elements.<type>.slots` — with its states'
  },
  'custom-css-notifications': {
    kind: 'suggested',
    means: 'the toasts or their icon, close button or progress bar dressed with `.Toastify__*` rules in `customCss`',
    fix: '`notifications: { font, fontSize, fontWeight, minHeight, iconSize, closeColor, progressHeight, … }`'
  },
  'heavy-animation': {
    kind: 'suggested',
    means:
      'keyframes animating what the browser repaints or lays out again on every frame — a size, a position, a blur, a shadow, or a colour in a loop — which stutters whenever the page is busy, most of all while it loads',
    fix: '`opacity` and `transform`: a size or a position is `translate`/`scale`, a blur or a shadow is the `opacity` of a layer carrying it; a loop that must animate anything else starts `paused` and runs under `[data-hydrated]`'
  },
  'unused-class': {
    kind: 'suggested',
    means: 'a class declared in `classes` that no element, binding, flow or other class names',
    fix: 'remove it from `classes` — or wear it where it was meant to go'
  },
  'unused-token': {
    kind: 'suggested',
    means: 'a token of `variables` no `var(--…)` reads — not a class, an element, `customCss` nor another token',
    fix: 'remove it, or write it where its colour is written out'
  },
  'literal-colour': {
    kind: 'suggested',
    means:
      'a colour written out in a class where the space has a token of that value — it stays put in the dark scheme',
    fix: '`var(--token)` when it should follow the scheme; a token of one value of its own when it must stay the same in both'
  },
  'not-found-page': {
    kind: 'suggested',
    means:
      'a space with no page of its own for an address no other page answers — a plain one was added, in the home page’s layout, sent with status 404',
    fix: "a page whose slug is `'*'`: `{ id: 'not-found', name: 'Not found', slug: '*', layout: …, body: [...] }`"
  },
  'unused-component': {
    kind: 'suggested',
    means: 'a component no page, layout or other component places',
    fix: 'remove it from `components`, or place it where it was meant to go'
  },
  'class-overrides-class': {
    kind: 'suggested',
    means:
      "one class's shorthand erasing the longhand another class on the same element writes out — `padding` over `padding-top` — because the stylesheet writes it later: classes in the order they are first met, a breakpoint's rules after the base, never the order of a class list",
    fix: "the longhands the shorthand means instead of it (`padding-left`, `padding-right`), so it leaves the other class's alone — or `quiet: ['class-overrides-class']` when the shorthand is meant to win"
  }
} as const satisfies Record<string, AuthoringCodeEntry>;

type Codes = typeof AUTHORING_CODES;

export type AuthoringCode = keyof Codes;

export type RefusalCode = {
  [Code in AuthoringCode]: Codes[Code]['kind'] extends 'refused' ? Code : never;
}[AuthoringCode];

export type WarningCode = {
  [Code in AuthoringCode]: Codes[Code]['kind'] extends 'warned' ? Code : never;
}[AuthoringCode];

export type SuggestionCode = {
  [Code in AuthoringCode]: Codes[Code]['kind'] extends 'suggested' ? Code : never;
}[AuthoringCode];

const isAuthoringCode = (code: string): code is AuthoringCode => Object.hasOwn(AUTHORING_CODES, code);

/** Whether a code is a suggestion's: what an element's `quiet` may name. */
export const isSuggestionCode = (code: unknown): code is SuggestionCode =>
  typeof code === 'string' && isAuthoringCode(code) && AUTHORING_CODES[code].kind === 'suggested';

/**
 * The row of a code a problem was reported with — what any tool that relays a problem adds to it (the MCP, the CLI),
 * so the fix travels with the code and nobody needs the skill's page to read it. `undefined` for a structural
 * UPPER_CASE code of `validateSchema` the table does not hold.
 */
export const authoringCodeEntry = (code: string): AuthoringCodeEntry | undefined =>
  isAuthoringCode(code) ? AUTHORING_CODES[code] : undefined;

/**
 * A declaration `authorSpace` will not write, with the code its row in `authoring-errors.md` is filed under.
 *
 * `reason` is the sentence alone; `message` leads with the code, so an error that escapes on its own still says where
 * to look it up.
 */
export class AuthoringError extends Error {
  readonly code: RefusalCode;
  readonly reason: string;

  constructor(code: RefusalCode, reason: string, options?: ErrorOptions) {
    super(`[${code}] ${reason}`, options);
    this.name = 'AuthoringError';
    this.code = code;
    this.reason = reason;
  }
}
