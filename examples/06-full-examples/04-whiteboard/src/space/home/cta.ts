import { button, container, heading, paragraph, styles, text } from '@plitzi/sdk-authoring';

import { newBoardFlow } from '../board.ts';
import { BUTTON_RESET, icon } from '../kit.ts';

import type { ElementSpec } from '@plitzi/sdk-authoring';

/**
 * The page's last word before the boards themselves: a band in the cursors' colours that says what to do next, and a
 * button that does it — with a few notes stuck to it, the board's own things again.
 */

const band = styles('ctaBand', {
  css: {
    desktop: {
      position: 'relative',
      overflow: 'hidden',
      display: 'grid',
      'grid-template-columns': 'minmax(0px, 1.4fr) minmax(0px, 1fr)',
      'align-items': 'center',
      gap: '32px',
      padding: '52px 56px',
      'border-radius': '28px',
      color: '#ffffff',
      'background-image': 'linear-gradient(120deg, var(--collab-indigo), var(--collab-orchid) 55%, var(--collab-rose))',
      'box-shadow': '0 36px 64px -36px color-mix(in srgb, var(--collab-orchid) 70%, transparent)'
    },
    compact: { 'grid-template-columns': 'minmax(0px, 1fr)', padding: '36px 28px' }
  }
});

/** Light caught in the band's corner: the gradient is not flat. */
const sheen = styles('ctaSheen', {
  position: 'absolute',
  inset: '0px',
  'pointer-events': 'none',
  'background-image':
    'radial-gradient(60% 80% at 90% 0%, rgba(255, 255, 255, 0.28), transparent 60%), radial-gradient(40% 60% at 0% 100%, rgba(255, 255, 255, 0.14), transparent 60%)'
});

const words = styles('ctaWords', {
  position: 'relative',
  display: 'flex',
  'flex-direction': 'column',
  'align-items': 'flex-start',
  gap: '16px'
});

const title = styles('ctaTitle', {
  css: {
    desktop: {
      margin: '0px',
      'font-family': 'var(--hand)',
      'font-size': '52px',
      'font-weight': '700',
      'line-height': '1'
    },
    mobile: { 'font-size': '38px' }
  }
});

const lead = styles('ctaLead', {
  margin: '0px',
  'max-width': '460px',
  'font-size': '17px',
  'line-height': '1.5',
  color: 'rgba(255, 255, 255, 0.88)'
});

const go = styles('ctaGo', {
  css: {
    ...BUTTON_RESET,
    display: 'inline-flex',
    'align-items': 'center',
    gap: '10px',
    height: '48px',
    padding: '0px 22px',
    'border-radius': '12px',
    'font-size': '15px',
    'font-weight': '700',
    color: '#3b2f8f',
    'background-color': '#ffffff',
    'box-shadow': '0 12px 24px -12px rgba(0, 0, 0, 0.45)',
    transition: 'transform 180ms ease'
  },
  states: {
    hover: { transform: 'translateY(-2px)' },
    'focus-visible': { outline: '2px solid #ffffff', 'outline-offset': '3px' }
  }
});

const small = styles('ctaSmall', { 'font-size': '13px', color: 'rgba(255, 255, 255, 0.75)' });

/** The notes on the band's other side — only where there is room for them. */
const pile = styles('ctaPile', {
  css: { desktop: { position: 'relative', height: '200px' }, compact: { display: 'none' } }
});

const NOTE = {
  position: 'absolute',
  width: '128px',
  height: '118px',
  padding: '14px',
  'font-family': 'var(--hand)',
  'font-size': '20px',
  'line-height': '1.1',
  color: '#1f1d1a',
  'box-shadow': '0 18px 30px -16px rgba(0, 0, 0, 0.5)'
} as const;

const noteIn = (name: string, place: Record<string, string>, paper: string, tilt: string) =>
  styles(`ctaNote-${name}`, { ...NOTE, ...place, 'background-color': paper, transform: `rotate(${tilt})` });

const NOTES: readonly { name: string; words: string; place: Record<string, string>; paper: string; tilt: string }[] = [
  { name: 'plan', words: 'Plan it', place: { left: '4%', top: '34px' }, paper: '#fff3bf', tilt: '-7deg' },
  { name: 'sketch', words: 'Sketch it', place: { left: '36%', top: '0px' }, paper: '#d3f9d8', tilt: '4deg' },
  { name: 'ship', words: 'Ship it! 🚀', place: { left: '64%', top: '62px' }, paper: '#ffdeeb', tilt: '-3deg' }
];

export const callToAction = (): ElementSpec =>
  container({
    class: band,
    children: [
      container({ class: sheen, children: [] }),
      container({
        class: words,
        children: [
          heading({ content: 'Your team is one link away', subType: 'h2', class: title }),
          paragraph({
            content:
              'Start a board, send the link, and draw together — cursors, notes, kanban and an agent or two, right away.',
            class: lead
          }),
          button({
            id: 'cta-new-board',
            content: 'Start a blank board',
            class: go,
            flows: [newBoardFlow],
            children: [icon('fa-solid fa-plus')]
          }),
          text({ content: 'No account · free · the link is the invitation', class: small })
        ]
      }),
      container({
        class: pile,
        children: NOTES.map(note =>
          text({ content: note.words, class: noteIn(note.name, note.place, note.paper, note.tilt) })
        )
      })
    ]
  });
