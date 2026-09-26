import { container, heading, styles, text } from '@plitzi/sdk-authoring';

import type { CollabColour } from '../../board/people.ts';
import type { CssProps, ElementSpec } from '@plitzi/sdk-authoring';

/**
 * How a section of the front page opens: a word in colour over its title — each section its own colour, the ones the
 * cursors are drawn in — the title in the hand-drawn face, and a line of what it is. One definition, so the sections
 * read as one page.
 */

/**
 * Every card on the front page is one kind of card: a quiet surface with a hairline edge and two soft shadows — one
 * close, one far — that rises a little when pointed at, its edge taking a touch of the accent.
 */
export const HOME_CARD: CssProps = {
  display: 'flex',
  'flex-direction': 'column',
  overflow: 'hidden',
  'border-radius': '18px',
  border: '1px solid var(--edge)',
  'background-color': 'var(--surface)',
  color: 'var(--ink)',
  'box-shadow': '0 1px 2px var(--shadow), 0 12px 28px -20px var(--shadow)',
  transition: 'transform 220ms cubic-bezier(0.2, 0.7, 0.2, 1), box-shadow 220ms ease, border-color 220ms ease'
};

export const HOME_CARD_STATES = {
  hover: {
    transform: 'translateY(-4px)',
    'box-shadow': '0 1px 2px var(--shadow), 0 28px 48px -24px var(--shadow)',
    'border-color': 'color-mix(in srgb, var(--accent) 45%, var(--edge))'
  },
  'focus-visible': { outline: '2px solid var(--accent)', 'outline-offset': '3px' }
};

/** A card's words, under its picture: its name, and a quieter line of what it is. */
export const cardBody = styles('homeCardBody', {
  display: 'flex',
  'flex-direction': 'column',
  gap: '4px',
  padding: '14px 18px 18px'
});

export const cardName = styles('homeCardName', {
  'font-weight': '600',
  'font-size': '15px',
  'letter-spacing': '-0.005em',
  overflow: 'hidden',
  'text-overflow': 'ellipsis',
  'white-space': 'nowrap'
});

export const cardLine = styles('homeCardLine', { 'font-size': '13px', 'line-height': '1.45', color: 'var(--muted)' });

export const sectionBlock = styles('homeBlock', {
  css: {
    desktop: { display: 'flex', 'flex-direction': 'column', gap: '22px' },
    mobile: { gap: '16px' }
  }
});

const EYEBROW = {
  'align-self': 'flex-start',
  display: 'inline-flex',
  'align-items': 'center',
  gap: '6px',
  padding: '4px 10px',
  'border-radius': '999px',
  'font-size': '11px',
  'font-weight': '700',
  'letter-spacing': '0.08em',
  'text-transform': 'uppercase'
} as const;

/** The colour word, in a section's colour: one class per colour, so each is a selector of its own. */
export const eyebrowIn = (tone: CollabColour) =>
  styles(`homeEyebrow-${tone}`, {
    ...EYEBROW,
    color: `var(--collab-${tone})`,
    'background-color': `color-mix(in srgb, var(--collab-${tone}) 14%, transparent)`
  });

const titleClass = styles('homeTitle', {
  css: {
    desktop: {
      margin: '0px',
      'font-family': 'var(--hand)',
      'font-size': '40px',
      'font-weight': '700',
      'line-height': '1.05'
    },
    mobile: { 'font-size': '32px' }
  }
});

export const sectionLead = styles('homeLead', {
  margin: '0px',
  'max-width': '640px',
  'font-size': '16px',
  'line-height': '1.5',
  color: 'var(--muted)'
});

const head = styles('homeHead', { display: 'flex', 'flex-direction': 'column', gap: '8px' });

/** A section's head: its colour word, its title, and a line under it — `lead` as a string, or an element bound to data. */
export const sectionHead = ({
  tone,
  eyebrow: word,
  title,
  lead
}: {
  tone: CollabColour;
  eyebrow: string;
  title: string;
  lead: string | ElementSpec;
}): ElementSpec =>
  container({
    class: head,
    children: [
      text({ content: word, class: eyebrowIn(tone) }),
      heading({ content: title, subType: 'h2', class: titleClass }),
      typeof lead === 'string' ? text({ content: lead, class: sectionLead }) : lead
    ]
  });
