/* eslint-disable quotes -- the rows quote code, which reads best in the other quotes */
import type { AuthoringCodeEntry } from './entry';

/** Feature flags. */
export const FLAG_CODES = {
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
  }
} as const satisfies Record<string, AuthoringCodeEntry>;
