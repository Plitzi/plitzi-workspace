/* eslint-disable quotes -- the rows quote code, which reads best in the other quotes */
import type { AuthoringCodeEntry } from './entry';

/** Components. */
export const COMPONENT_CODES = {
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
  }
} as const satisfies Record<string, AuthoringCodeEntry>;
