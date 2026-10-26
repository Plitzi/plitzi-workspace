import type { AuthoringCodeEntry } from './entry';

/** The space and its settings. */
export const SPACE_CODES = {
  'no-pages': {
    kind: 'refused',
    means: 'a space with no pages',
    fix: "`pages: [{ id: 'home', name: 'Home', slug: '', body: [] }]`"
  },
  'withheld-page-invalid': {
    kind: 'refused',
    means: '`settings.withheldPage` naming no page of the space, or one with an `access` of its own',
    fix: "the id or slug of a page every visitor may see: `withheldPage: 'no-access'`"
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
  'state-kept-and-transient': {
    kind: 'refused',
    means: '`keptState` (the only keys kept) and `transientState` (the keys left out) both said',
    fix: 'one of the two: `keptState` when few keys are kept, `transientState` when few are not'
  },
  'state-painted-not-kept': {
    kind: 'refused',
    means: 'a `paintedState` key that `keptState` does not keep — the server draws with what is kept',
    fix: 'add it to `keptState`, or leave it out of `paintedState`'
  },
  'kept-state-without-keep-state': {
    kind: 'warned',
    means: '`keptState` without `keepState` — nothing is kept in the first place',
    fix: '`settings.keepState: true`, or remove `keptState`'
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
  }
} as const satisfies Record<string, AuthoringCodeEntry>;
