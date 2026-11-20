import type { AuthoringCodeEntry } from './entry';

/** Audiences (`audience`). */
export const AUDIENCE_CODES = {
  'audience-variants': {
    kind: 'refused',
    means: 'an `audience` holding no `audienceVariant`, or something else beside them — never shown',
    fix: '`audience({ children: [audienceVariant({ when, children }), audienceVariant([…])] })`'
  },
  'audience-rule': {
    kind: 'refused',
    means: "an `audienceVariant`'s `when` that is not a rule group",
    fix: "`when: { combinator: 'and', rules: [{ field: 'visitor.device', operator: '=', value: 'mobile' }] }`"
  },
  'audience-unreachable': {
    kind: 'warned',
    means: 'an `audienceVariant` after one with no conditions, which takes everybody left — it is never shown',
    fix: 'move the variant with no conditions last, or give it a rule'
  },
  'audience-no-fallback': {
    kind: 'warned',
    means: 'an `audience` whose every variant has a rule: a visitor matching none is shown nothing',
    fix: 'end it with an `audienceVariant` with no `when`, for everybody else'
  }
} as const satisfies Record<string, AuthoringCodeEntry>;
