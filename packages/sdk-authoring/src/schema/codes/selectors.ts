/* eslint-disable quotes -- the rows quote code, which reads best in the other quotes */
import type { AuthoringCodeEntry } from './entry';

/** Ids, classes and selectors. */
export const SELECTOR_CODES = {
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
  'controls-other-row': {
    kind: 'refused',
    means: "a button's `controls` naming an element a list draws in its rows, from outside that row",
    fix: 'the button in the same row as what it shows and hides, or `controls` naming an element outside the list'
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
  'slot-not-class': {
    kind: 'refused',
    means: 'a `slots` entry that is not a class — rules written in place, or nothing — which a slot cannot wear',
    fix: 'the rules as a `styles()` declaration, handed to the slot beside its other classes'
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
  }
} as const satisfies Record<string, AuthoringCodeEntry>;
