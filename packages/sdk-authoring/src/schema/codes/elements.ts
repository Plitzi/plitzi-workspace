/* eslint-disable quotes -- the rows quote code, which reads best in the other quotes */
import type { AuthoringCodeEntry } from './entry';

/** Elements and their attributes. */
export const ELEMENT_CODES = {
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
    means:
      "a `container` with `subType: 'span'` holding a block, or with `'p'` holding anything that renders a `<div>` (a `text`, a plain `container`) — which the browser closes the paragraph before",
    fix: 'a `div` (leave `subType` out), or words and inline elements: `paragraph(…)`, a `span` container, a `link`'
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
  'source-name-missing': {
    kind: 'refused',
    means: 'a source named by nothing — most often a field read off a list row that has no types',
    fix: "write the row's field as text (`${r.item}.field`), or give the list `items` a typed source's path"
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
  }
} as const satisfies Record<string, AuthoringCodeEntry>;
