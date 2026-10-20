import type { AuthoringCodeEntry } from './entry';

/** Accessibility. */
export const ACCESSIBILITY_CODES = {
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
  }
} as const satisfies Record<string, AuthoringCodeEntry>;
