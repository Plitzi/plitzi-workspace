/* eslint-disable quotes -- the rows quote code, which reads best in the other quotes */
import type { AuthoringCodeEntry } from './entry';

/** Anchors. */
export const ANCHOR_CODES = {
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
    means: 'an anchor inside a component — it would be in the page once per instance',
    fix: 'the anchor on the element around the instance (in a list row, an anchor is the row’s own: that one is fine)'
  },
  'anchor-in-row': {
    kind: 'refused',
    means:
      'a link to an anchor drawn in a list’s rows — each row’s is named after its row, so the link lands at the top',
    fix: "link to one row’s (`hash: 'answer-<row key>'`), the list’s own anchor, or one outside it"
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
  }
} as const satisfies Record<string, AuthoringCodeEntry>;
