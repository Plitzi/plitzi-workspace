import type { SpaceSpec } from '../../schema';

/**
 * Every colour the page uses, per scheme.
 *
 * `default` is what a browser with no preference gets. No class names a colour directly — they are all `var(--…)` — so
 * switching the palette here re-themes the whole page, in both schemes, without touching a rule.
 */
export const variables = {
  color: {
    background: { light: '#fbfbfd', dark: '#09090b', default: '#fbfbfd' },
    foreground: { light: '#17171c', dark: '#fafafa', default: '#17171c' },
    muted: { light: '#5f5f6e', dark: '#a1a1aa', default: '#5f5f6e' },
    card: { light: '#ffffff', dark: '#111115', default: '#ffffff' },
    'code-bg': { light: '#f4f4f8', dark: '#18181d', default: '#f4f4f8' },
    border: { light: '#e6e6ee', dark: '#27272d', default: '#e6e6ee' },
    primary: { light: '#5b3df5', dark: '#7c66ff', default: '#5b3df5' },
    'primary-hover': { light: '#4a2de0', dark: '#9180ff', default: '#4a2de0' },
    'primary-foreground': { light: '#ffffff', dark: '#ffffff', default: '#ffffff' },
    glow: { light: 'rgba(91, 61, 245, 0.16)', dark: 'rgba(124, 102, 255, 0.24)', default: 'rgba(91, 61, 245, 0.16)' },
    grid: { light: '#0000000d', dark: '#ffffff0d', default: '#0000000d' },
    'tint-violet': { light: '#5b3df5', dark: '#b7a6ff', default: '#5b3df5' },
    'tint-violet-bg': { light: '#efecfe', dark: '#1c1836', default: '#efecfe' },
    'tint-cyan': { light: '#0e7490', dark: '#67d8ef', default: '#0e7490' },
    'tint-cyan-bg': { light: '#e0f5fa', dark: '#0c2a33', default: '#e0f5fa' },
    'tint-amber': { light: '#a45b00', dark: '#f5c169', default: '#a45b00' },
    'tint-amber-bg': { light: '#fcf0dc', dark: '#2e2314', default: '#fcf0dc' },
    'tint-rose': { light: '#c2255c', dark: '#f994bc', default: '#c2255c' },
    'tint-rose-bg': { light: '#fce8f0', dark: '#331623', default: '#fce8f0' },
    'tint-emerald': { light: '#0f7b55', dark: '#64d6a6', default: '#0f7b55' },
    'tint-emerald-bg': { light: '#e0f6ee', dark: '#0e2a21', default: '#e0f6ee' },
    'tint-blue': { light: '#2159c4', dark: '#8ab0f7', default: '#2159c4' },
    'tint-blue-bg': { light: '#e6edfc', dark: '#13203c', default: '#e6edfc' }
  },
  shadow: {
    'shadow-sm': {
      light: '0 1px 2px rgba(12, 12, 20, 0.05)',
      dark: '0 1px 2px rgba(0, 0, 0, 0.5)',
      default: '0 1px 2px rgba(12, 12, 20, 0.05)'
    },
    'shadow-md': {
      light: '0 1px 2px rgba(12, 12, 20, 0.06), 0 8px 20px -8px rgba(91, 61, 245, 0.45)',
      dark: '0 1px 2px rgba(0, 0, 0, 0.6), 0 8px 24px -8px rgba(124, 102, 255, 0.55)',
      default: '0 1px 2px rgba(12, 12, 20, 0.06), 0 8px 20px -8px rgba(91, 61, 245, 0.45)'
    },
    'shadow-lg': {
      light: '0 2px 4px rgba(12, 12, 20, 0.05), 0 24px 48px -20px rgba(12, 12, 20, 0.25)',
      dark: '0 2px 4px rgba(0, 0, 0, 0.6), 0 28px 56px -22px rgba(0, 0, 0, 0.85)',
      default: '0 2px 4px rgba(12, 12, 20, 0.05), 0 24px 48px -20px rgba(12, 12, 20, 0.25)'
    }
  },
  custom: {
    'font-sans':
      'Geist, ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    'font-mono': '"Geist Mono", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace'
  }
} satisfies SpaceSpec['variables'];

/** Loaded by the page itself: a face the space names here is the only one it ever fetches. */
export const fonts: SpaceSpec['fonts'] = [
  {
    family: 'Geist',
    fallback: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    weights: [400, 500, 600, 700],
    styles: ['normal'],
    display: 'swap',
    preload: true,
    source: 'google'
  },
  {
    family: 'Geist Mono',
    fallback: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
    weights: [400],
    styles: ['normal'],
    display: 'swap',
    source: 'google'
  }
];
