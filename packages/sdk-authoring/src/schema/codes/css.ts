/* eslint-disable quotes -- the rows quote code, which reads best in the other quotes */
import type { AuthoringCodeEntry } from './entry';

/** CSS. */
export const CSS_CODES = {
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
  'shorthand-ambiguous': {
    kind: 'refused',
    means:
      'a shorthand one of whose parts is a bare `var(--x)` — `background: var(--surface)` — which longhand it is depends on what the variable holds',
    fix: "the longhand it is: `'background-color': 'var(--x)'` for a colour, `'background-image'` for a gradient or a picture"
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
  'style-part-shape': {
    kind: 'refused',
    means:
      "a condition or a pseudo-element given `variants`, `ancestors` or `conditions` — it holds its selector's own `css`, its `states` and (a condition) its `pseudos`",
    fix: "the class's own `css` under the condition — `{ 'motion-reduce': { css: { transition: 'none' } } }` drops what an ancestor's or a variant's rule would animate — or the rule under `ancestors`/`variants` at the top of the class"
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
  }
} as const satisfies Record<string, AuthoringCodeEntry>;
