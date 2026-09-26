import { container, heading, styles, text } from '@plitzi/sdk-authoring';

import { icon } from '../kit.ts';

import type { CssProps, ElementSpec } from '@plitzi/sdk-authoring';

/**
 * What drawing together feels like, before anyone has tried it: four small scenes that play on their own — a note
 * dragged by one cursor while another wanders, a note peeled off a pile, reactions and words at a cursor, a laser.
 *
 * Plain elements moved by CSS animations (`wb-*` keyframes in `css.ts`). Every animated class is named `motion…`: a
 * visitor who asked for less motion gets every one of them still.
 */

const block = styles('togetherBlock', { display: 'flex', 'flex-direction': 'column', gap: '18px' });

const blockTitle = styles('togetherTitle', {
  margin: '0px',
  'font-family': 'var(--hand)',
  'font-size': '32px',
  'font-weight': '700',
  'line-height': '1.1'
});

const blockLead = styles('togetherLead', { margin: '4px 0px 0px', 'font-size': '14px', color: 'var(--muted)' });

const grid = styles('togetherGrid', {
  css: {
    desktop: { display: 'grid', 'grid-template-columns': 'repeat(4, minmax(0px, 1fr))', gap: '14px' },
    tablet: { 'grid-template-columns': 'repeat(2, minmax(0px, 1fr))' },
    mobile: { 'grid-template-columns': 'minmax(0px, 1fr)' }
  }
});

const card = styles('togetherCard', {
  css: {
    display: 'flex',
    'flex-direction': 'column',
    overflow: 'hidden',
    'border-radius': '16px',
    border: '1px solid var(--edge)',
    'background-color': 'var(--surface)',
    'box-shadow': '0 1px 2px var(--shadow)',
    transition: 'transform 180ms ease, box-shadow 180ms ease'
  },
  states: { hover: { transform: 'translateY(-3px)', 'box-shadow': '0 22px 40px -24px var(--shadow)' } }
});

const stage = styles('togetherStage', {
  position: 'relative',
  height: '150px',
  overflow: 'hidden',
  'border-bottom': '1px solid var(--edge)',
  'background-color': 'var(--paper)',
  'background-image': 'radial-gradient(var(--dots) 1px, transparent 1px)',
  'background-size': '16px 16px'
});

const body = styles('togetherBody', {
  display: 'flex',
  'flex-direction': 'column',
  gap: '4px',
  padding: '12px 16px 16px'
});

const cardTitle = styles('togetherCardTitle', { 'font-weight': '600', 'font-size': '15px' });

const cardText = styles('togetherCardText', { 'font-size': '13px', 'line-height': '1.45', color: 'var(--muted)' });

const at = (place: CssProps): CssProps => ({ position: 'absolute', ...place });

const NOTE: CssProps = {
  display: 'flex',
  padding: '8px',
  width: '64px',
  height: '64px',
  'font-family': 'var(--hand)',
  'font-size': '13px',
  'line-height': '1.1',
  color: '#1f1d1a',
  'box-shadow': '0 6px 12px -8px rgba(0, 0, 0, 0.45)'
};

/** A cursor as the canvas draws one: the pointer in a person's colour, their name in a tag beside it. */
const cursor = (name: string, colour: string, motion: ReturnType<typeof styles>): ElementSpec =>
  container({
    class: motion,
    children: [
      container({
        class: styles(`togetherPointer-${colour}`, { color: `var(--collab-${colour})`, 'font-size': '16px' }),
        children: [icon('fa-solid fa-arrow-pointer')]
      }),
      text({
        content: name,
        class: styles(`togetherTag-${colour}`, {
          display: 'inline-block',
          'margin-left': '10px',
          'margin-top': '-2px',
          padding: '1px 7px',
          'border-radius': '6px',
          'font-size': '11px',
          'font-weight': '600',
          color: '#ffffff',
          'background-color': `var(--collab-${colour})`,
          'white-space': 'nowrap'
        })
      })
    ]
  });

const scene = (title: string, note: string, children: ElementSpec[]): ElementSpec =>
  container({
    class: card,
    children: [
      container({ class: stage, children }),
      container({
        class: body,
        children: [text({ content: title, class: cardTitle }), text({ content: note, class: cardText })]
      })
    ]
  });

// ── Live cursors: one drags a note, the other wanders ───────────────────────────────────────────────────────────────

const cursors = (): ElementSpec =>
  scene('Live cursors', 'Every pointer, name and selection — the moment it moves.', [
    text({
      content: 'Ship it?',
      class: styles('motionNote', {
        ...NOTE,
        ...at({ left: '28%', top: '34px' }),
        'background-color': 'var(--sticky-yellow)',
        outline: '2px solid var(--collab-orchid)',
        'outline-offset': '3px',
        animation: 'wb-note 6s ease-in-out infinite'
      })
    }),
    cursor(
      'Ana',
      'orchid',
      styles('motionHand', {
        ...at({ left: 'calc(28% + 50px)', top: '70px' }),
        animation: 'wb-hand 6s ease-in-out infinite'
      })
    ),
    cursor(
      'Leo',
      'teal',
      styles('motionWander', { ...at({ right: '18%', top: '30px' }), animation: 'wb-wander 7s ease-in-out infinite' })
    )
  ]);

// ── Sticky piles: a note peeled off, again and again ────────────────────────────────────────────────────────────────

const pileNote = (name: string, place: CssProps): ElementSpec =>
  text({ content: '', class: styles(name, { ...NOTE, ...at(place), 'background-color': 'var(--sticky-green)' }) });

const piles = (): ElementSpec =>
  scene('Sticky piles', 'Put a pile on the board; anyone drags a fresh note off it.', [
    pileNote('togetherPileLow', { left: '22%', top: '46px' }),
    pileNote('togetherPileMid', { left: 'calc(22% - 3px)', top: '43px' }),
    container({
      class: styles('motionPeel', {
        ...NOTE,
        ...at({ left: 'calc(22% - 6px)', top: '40px' }),
        'background-color': 'var(--sticky-green)',
        animation: 'wb-peel 4.5s ease-in-out infinite'
      }),
      children: [
        text({ content: 'Next idea' }),
        cursor('Mia', 'amber', styles('togetherPeelHand', at({ left: '46px', top: '40px' })))
      ]
    })
  ]);

// ── Reactions and words at a cursor ─────────────────────────────────────────────────────────────────────────────────

const rising = (emoji: string, left: string, delay: string): ElementSpec =>
  text({
    content: emoji,
    class: styles(`motionRise-${delay.replace('.', '_')}`, {
      ...at({ left, bottom: '10px' }),
      'font-size': '22px',
      opacity: '0',
      animation: `wb-rise 3.2s ${delay} ease-out infinite`
    })
  });

const reactions = (): ElementSpec =>
  scene('Reactions and chat', 'Cheer from anywhere, or type at your cursor with /.', [
    cursor('Sam', 'coral', styles('togetherChatHand', at({ left: '16%', top: '34px' }))),
    text({
      content: 'Looks great!',
      class: styles('motionBubble', {
        ...at({ left: 'calc(16% + 18px)', top: '62px' }),
        padding: '6px 10px',
        'border-radius': '4px 12px 12px 12px',
        'font-size': '12px',
        'font-weight': '600',
        color: '#ffffff',
        'background-color': 'var(--collab-coral)',
        'transform-origin': 'top left',
        animation: 'wb-bubble 4s ease-out infinite'
      })
    }),
    rising('🎉', '58%', '0s'),
    rising('❤️', '70%', '0.8s'),
    rising('🔥', '82%', '1.6s'),
    rising('👍', '64%', '2.4s')
  ]);

// ── A laser, and a view to follow ───────────────────────────────────────────────────────────────────────────────────

const LASER_CENTRE = at({ left: '50%', top: '50%' });

const trail = (name: string, size: number, delay: string, opacity: string): ElementSpec =>
  text({
    content: '',
    class: styles(name, {
      ...LASER_CENTRE,
      width: `${size}px`,
      height: `${size}px`,
      margin: `-${size / 2}px 0px 0px -${size / 2}px`,
      'border-radius': '50%',
      opacity,
      'background-color': 'var(--laser)',
      'box-shadow': '0 0 12px var(--laser)',
      animation: `wb-orbit 2.4s ${delay} linear infinite`
    })
  });

const laser = (): ElementSpec =>
  scene('Laser, follow, summon', 'Point it out, follow someone’s view, bring everyone to yours.', [
    text({
      content: '',
      class: styles('togetherRing', {
        ...LASER_CENTRE,
        width: '96px',
        height: '96px',
        margin: '-48px 0px 0px -48px',
        'border-radius': '50%',
        border: '2px dashed var(--edge)'
      })
    }),
    trail('motionLaser3', 6, '-0.18s', '0.25'),
    trail('motionLaser2', 8, '-0.09s', '0.5'),
    trail('motionLaser1', 11, '0s', '1'),
    text({
      content: 'Following Mia',
      class: styles('togetherFollow', {
        ...at({ left: '12px', top: '12px' }),
        padding: '3px 9px',
        'border-radius': '999px',
        border: '1px solid var(--accent)',
        'font-size': '11px',
        'font-weight': '600',
        color: 'var(--accent)',
        'background-color': 'var(--surface)'
      })
    })
  ]);

export const together = (): ElementSpec =>
  container({
    class: block,
    children: [
      container({
        children: [
          heading({ content: 'Better together', subType: 'h2', class: blockTitle }),
          text({
            content: 'Everything anyone does shows on every screen, as it happens — no refresh, no “send”.',
            class: blockLead
          })
        ]
      }),
      container({ class: grid, children: [cursors(), piles(), reactions(), laser()] })
    ]
  });
