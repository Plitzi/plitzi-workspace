import { column, grid, row, styles } from '@plitzi/sdk-authoring';

import type { CssProps, SpaceSpec } from '@plitzi/sdk-authoring';

/**
 * The board's look: one palette in two schemes, and the classes the page wears.
 *
 * Every colour is a variable declared for light AND dark, so the scheme is one decision per token — text that
 * follows the theme never sits on a background that cannot. The status colours carry a tint and an ink each,
 * because a pill is a background with text on it and both halves have to move together.
 */

const status = (light: string, dark: string, inkLight: string, inkDark: string) => ({
  tint: { light, dark, default: light },
  ink: { light: inkLight, dark: inkDark, default: inkLight }
});

const waiting = status('#fef3c7', '#3a2a06', '#92400e', '#fcd34d');
const running = status('#dbeafe', '#0c2548', '#1d4ed8', '#93c5fd');
const done = status('#dcfce7', '#0b2e1a', '#166534', '#86efac');
const failed = status('#fee2e2', '#3b0d0d', '#b91c1c', '#fca5a5');
const idle = status('#f1f5f9', '#1e2530', '#475569', '#94a3b8');

export const variables: SpaceSpec['variables'] = {
  color: {
    bg: { light: '#f6f7f9', dark: '#0b0e13', default: '#f6f7f9' },
    surface: { light: '#ffffff', dark: '#131821', default: '#ffffff' },
    'surface-2': { light: '#f1f3f6', dark: '#1a202b', default: '#f1f3f6' },
    fg: { light: '#0f172a', dark: '#e6e9ef', default: '#0f172a' },
    'fg-muted': { light: '#526077', dark: '#9aa6b8', default: '#526077' },
    line: { light: '#e2e6ec', dark: '#232b38', default: '#e2e6ec' },
    accent: { light: '#4f46e5', dark: '#818cf8', default: '#4f46e5' },
    /** What sits on the accent: white on indigo, and ink on the lighter dark-scheme indigo, where white fails. */
    'on-accent': { light: '#ffffff', dark: '#0b0e13', default: '#ffffff' },
    'waiting-tint': waiting.tint,
    'waiting-ink': waiting.ink,
    'running-tint': running.tint,
    'running-ink': running.ink,
    'done-tint': done.tint,
    'done-ink': done.ink,
    'failed-tint': failed.tint,
    'failed-ink': failed.ink,
    'idle-tint': idle.tint,
    'idle-ink': idle.ink
  }
};

const MONO = "ui-monospace, SFMono-Regular, Menlo, 'Cascadia Mono', monospace";

export const elements: SpaceSpec['elements'] = {
  heading: { base: { color: 'var(--fg)', 'margin-top': '0px', 'margin-bottom': '0px' } },
  paragraph: { base: { color: 'inherit', 'margin-top': '0px', 'margin-bottom': '0px' } },
  text: { base: { color: 'inherit' } }
};

// ── Frame ──────────────────────────────────────────────────────────────────────────────────────────────────────

export const page = styles('page', {
  'min-height': '100vh',
  padding: '32px 20px 64px',
  'background-color': 'var(--bg)',
  color: 'var(--fg)',
  'font-family': "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
});

export const shell = styles('shell', column('24px', { width: '100%', 'max-width': '1180px', margin: '0px auto' }));

export const header = styles('header', {
  desktop: row('16px', { 'justify-content': 'space-between', 'align-items': 'flex-end' }),
  mobile: column('12px', { 'align-items': 'flex-start' })
});

export const headerText = styles('headerText', column('6px'));

export const title = styles('title', { 'font-size': '28px', 'font-weight': '700', 'letter-spacing': '-0.01em' });

export const lede = styles('lede', { 'font-size': '15px', 'line-height': '1.5', color: 'var(--fg-muted)' });

export const headerActions = styles('headerActions', row('12px', { 'align-items': 'center' }));

export const servedBy = styles('servedBy', {
  'font-family': MONO,
  'font-size': '12px',
  'white-space': 'nowrap',
  color: 'var(--fg-muted)'
});

export const themeButton = styles('themeButton', {
  display: 'inline-flex',
  'align-items': 'center',
  'justify-content': 'center',
  width: '36px',
  height: '36px',
  'border-radius': '999px',
  border: '1px solid var(--line)',
  'background-color': 'var(--surface)',
  color: 'var(--fg-muted)',
  cursor: 'pointer'
});

// ── Counters ───────────────────────────────────────────────────────────────────────────────────────────────────

export const stats = styles('stats', {
  desktop: grid('repeat(4, minmax(0, 1fr))', '12px'),
  mobile: grid('repeat(2, minmax(0, 1fr))', '10px')
});

export const stat = styles(
  'stat',
  column('4px', {
    padding: '14px 16px',
    'border-radius': '12px',
    border: '1px solid var(--line)',
    'background-color': 'var(--surface)'
  })
);

export const statValue = styles('statValue', { 'font-size': '26px', 'font-weight': '700', 'font-family': MONO });

export const statLabel = styles('statLabel', {
  'font-size': '12px',
  'text-transform': 'uppercase',
  'letter-spacing': '0.08em',
  color: 'var(--fg-muted)'
});

// ── Columns and panels ─────────────────────────────────────────────────────────────────────────────────────────

export const columns = styles('columns', {
  desktop: grid('minmax(0, 380px) minmax(0, 1fr)', '20px', { 'align-items': 'start' }),
  tablet: grid('minmax(0, 1fr)', '20px'),
  mobile: grid('minmax(0, 1fr)', '16px')
});

export const stack = styles('stack', column('20px', { 'min-width': '0px' }));

export const panel = styles(
  'panel',
  column('14px', {
    padding: '18px',
    'border-radius': '14px',
    border: '1px solid var(--line)',
    'background-color': 'var(--surface)'
  })
);

export const panelTitle = styles('panelTitle', { 'font-size': '16px', 'font-weight': '700' });

export const hint = styles('hint', { 'font-size': '13px', 'line-height': '1.5', color: 'var(--fg-muted)' });

export const empty = styles('empty', {
  padding: '14px',
  'border-radius': '10px',
  border: '1px dashed var(--line)',
  'font-size': '13px',
  color: 'var(--fg-muted)',
  'text-align': 'center'
});

// ── Controls ───────────────────────────────────────────────────────────────────────────────────────────────────

export const remindForm = styles('remindForm', column('10px'));

export const fieldInput = styles('fieldInput', {
  width: '100%',
  padding: '8px 10px',
  'border-radius': '8px',
  border: '1px solid var(--line)',
  'background-color': 'var(--surface-2)',
  color: 'var(--fg)',
  'font-size': '14px'
});

const buttonBase: CssProps = {
  padding: '9px 14px',
  'border-radius': '8px',
  'font-size': '14px',
  'font-weight': '600',
  'text-align': 'left',
  cursor: 'pointer'
};

export const primaryButton = styles('primaryButton', {
  css: {
    ...buttonBase,
    border: '1px solid var(--accent)',
    'background-color': 'var(--accent)',
    color: 'var(--on-accent)'
  },
  states: { hover: { opacity: '0.9' } }
});

export const secondaryButton = styles('secondaryButton', {
  css: {
    ...buttonBase,
    border: '1px solid var(--line)',
    'background-color': 'var(--surface-2)',
    color: 'var(--fg)'
  },
  states: { hover: { 'border-color': 'var(--accent)' } }
});

export const notice = styles('notice', { 'min-height': '20px', 'font-size': '13px', color: 'var(--accent)' });

// ── Rows ───────────────────────────────────────────────────────────────────────────────────────────────────────

export const rows = styles('rows', column('8px', { padding: '0px', margin: '0px', 'list-style': 'none' }));

export const scheduleRow = styles(
  'scheduleRow',
  column('4px', {
    padding: '10px 12px',
    'border-radius': '10px',
    'background-color': 'var(--surface-2)'
  })
);

export const jobRow = styles('jobRow', {
  desktop: grid('96px minmax(0, 1fr) auto', '12px', {
    'align-items': 'start',
    padding: '12px',
    'border-radius': '10px',
    'background-color': 'var(--surface-2)'
  }),
  mobile: grid('minmax(0, 1fr)', '8px', {
    padding: '12px',
    'border-radius': '10px',
    'background-color': 'var(--surface-2)'
  })
});

export const rowMain = styles('rowMain', column('3px', { 'min-width': '0px' }));

export const rowName = styles('rowName', { 'font-size': '14px', 'font-weight': '600' });

export const rowMeta = styles('rowMeta', {
  'font-family': MONO,
  'font-size': '12px',
  color: 'var(--fg-muted)',
  'overflow-wrap': 'anywhere'
});

export const rowError = styles('rowError', { 'font-size': '12px', color: 'var(--failed-ink)' });

export const rowActions = styles('rowActions', row('6px', { 'flex-wrap': 'wrap', 'justify-content': 'flex-end' }));

export const rowButton = styles('rowButton', {
  css: {
    padding: '5px 10px',
    'border-radius': '6px',
    border: '1px solid var(--line)',
    'background-color': 'var(--surface)',
    color: 'var(--fg)',
    'font-size': '12px',
    'font-weight': '600',
    cursor: 'pointer'
  },
  states: { hover: { 'border-color': 'var(--accent)' } }
});

export const missed = styles('missed', { 'font-size': '12px', 'font-weight': '600', color: 'var(--waiting-ink)' });

const pill = (tint: string, ink: string): CssProps => ({
  'background-color': `var(--${tint})`,
  color: `var(--${ink})`
});

/**
 * The status, coloured by the job's own status — a VARIANT per status rather than a class per status, because it is
 * one pill that changes as the job moves, and a variant is part of the same selector. The page binds the variant to
 * the status field; the value names one of these.
 */
export const statusPill = styles('statusPill', {
  css: {
    'justify-self': 'start',
    padding: '3px 9px',
    'border-radius': '999px',
    'font-size': '12px',
    'font-weight': '700',
    'white-space': 'nowrap',
    ...pill('idle-tint', 'idle-ink')
  },
  variants: {
    pending: pill('waiting-tint', 'waiting-ink'),
    running: pill('running-tint', 'running-ink'),
    succeeded: pill('done-tint', 'done-ink'),
    failed: pill('failed-tint', 'failed-ink'),
    dead: pill('failed-tint', 'failed-ink'),
    cancelled: pill('idle-tint', 'idle-ink')
  }
});

export const activityRow = styles('activityRow', {
  desktop: grid('96px 92px minmax(0, 1fr)', '10px', { 'align-items': 'baseline', 'font-size': '13px' }),
  mobile: grid('84px 74px minmax(0, 1fr)', '8px', { 'align-items': 'baseline', 'font-size': '12px' })
});

export const replicaTag = styles('replicaTag', { 'font-family': MONO, 'font-size': '11px', color: 'var(--accent)' });
