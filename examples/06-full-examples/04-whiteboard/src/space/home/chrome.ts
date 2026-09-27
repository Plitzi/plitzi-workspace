import { container, image, link, styles, text, themeToggle } from '@plitzi/sdk-authoring';

import { BRAND_PATH } from '../../board/brand.ts';
import { BUTTON_RESET } from '../kit.ts';

import type { ElementSpec } from '@plitzi/sdk-authoring';

/**
 * What every page outside a board is framed in: the dotted paper, a column of content, and a bar across its top — the
 * mark, which leads home, and whatever the page puts at the other end beside the theme switch.
 */

export const page = styles('galleryPage', {
  'min-height': '100dvh',
  // The hero's glow spills past the edges on purpose; the page never scrolls sideways for it.
  'overflow-x': 'clip',
  'background-color': 'var(--paper)',
  'background-image': 'radial-gradient(var(--dots) 1px, transparent 1px)',
  'background-size': '24px 24px',
  color: 'var(--ink)',
  'font-family': 'var(--ui)',
  'line-height': '1.4'
});

export const shell = styles('shell', {
  css: {
    desktop: {
      'max-width': '1200px',
      margin: '0px auto',
      padding: '24px 32px 64px',
      display: 'flex',
      'flex-direction': 'column',
      gap: '56px'
    },
    mobile: { padding: '16px 16px 48px', gap: '40px' }
  }
});

const topBar = styles('topBar', {
  display: 'flex',
  'align-items': 'center',
  'justify-content': 'space-between',
  gap: '12px'
});

const brand = styles('brand', {
  display: 'inline-flex',
  'align-items': 'center',
  gap: '10px',
  'font-family': 'var(--hand)',
  'font-size': '28px',
  'font-weight': '700'
});

const brandMark = styles('brandMark', {
  display: 'block',
  width: '40px',
  height: '40px',
  transform: 'rotate(-6deg)',
  filter: 'drop-shadow(0 6px 10px rgba(109, 93, 252, 0.35))'
});

const barEnd = styles('barEnd', { display: 'flex', 'align-items': 'center', gap: '14px' });

const themeSwitch = styles('galleryTheme', {
  css: {
    ...BUTTON_RESET,
    display: 'inline-flex',
    width: '40px',
    height: '40px',
    'align-items': 'center',
    'justify-content': 'center',
    'border-radius': '12px',
    'background-color': 'var(--surface)',
    border: '1px solid var(--edge)'
  },
  states: { hover: { 'background-color': 'var(--surface-2)' } }
});

export const footnote = styles('footnote', {
  display: 'block',
  padding: '0px 16px 32px',
  'font-size': '12px',
  color: 'var(--muted)',
  'text-align': 'center'
});

const brandLink = styles('brandLink', {
  css: { color: 'inherit', 'text-decoration': 'none' },
  states: { 'focus-visible': { outline: '2px solid var(--accent)', 'outline-offset': '4px', 'border-radius': '8px' } }
});

/** The bar across the top: the mark, home; `end` and the theme switch at the other side. */
export const siteBar = (id: string, end: ElementSpec[] = []): ElementSpec =>
  container({
    class: topBar,
    children: [
      link({
        href: '/',
        mode: 'internal',
        label: 'Pizarra — all boards',
        class: brandLink,
        children: [
          container({
            class: brand,
            children: [image({ src: BRAND_PATH, decorative: true, class: brandMark }), text({ content: 'Pizarra' })]
          })
        ]
      }),
      container({
        class: barEnd,
        children: [...end, themeToggle({ id: `${id}-theme`, subType: 'switch', class: themeSwitch })]
      })
    ]
  });
