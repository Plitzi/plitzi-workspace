/* eslint-disable quotes -- the rows quote code, which reads best in the other quotes */
import type { AuthoringCodeEntry } from './entry';

/** Bindings and templates. */
export const BINDING_CODES = {
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
    fix: 'declare it once — `formats: { price: "{{ source|currency(\'USD\') }}" }` — or write the template in its place; words the element always shows are its `content`, with no `from`'
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
    fix: "the full name: `apiContainer_stats`, `list_rows` — a list's row, `r.inTemplate.item`"
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
  }
} as const satisfies Record<string, AuthoringCodeEntry>;
