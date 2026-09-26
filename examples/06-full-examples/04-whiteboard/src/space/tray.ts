import {
  bindTemplate,
  button,
  container,
  declaredTrigger,
  defineElement,
  named,
  onClick,
  styles,
  text
} from '@plitzi/sdk-authoring';

import { REACTIONS } from '../board/reactions.ts';
import stackDeclaration from '../plugins/StickyStack/declaration.ts';
import { BUTTON_RESET, FLOAT, divide } from './kit.ts';
import { boardAction } from './stylePanel.ts';

import type { StickyStackAttributes } from '../plugins/StickyStack/declaration.ts';
import type { ElementSpec } from '@plitzi/sdk-authoring';

/**
 * The tray at the foot of the board: pads of sticky notes to drag onto it, and reactions to send to everyone on it.
 *
 * A note is taken off a pad (`onPick`) and handed to the canvas (`carry`), which carries it until it is put down —
 * two elements, one flow between them. A reaction is the canvas's `react`: it floats up where this person points, on
 * every screen.
 */

const stickyStack = defineElement<StickyStackAttributes>(stackDeclaration);

export const STACK_DECLARATION = stackDeclaration;

const tray = styles('tray', {
  css: {
    desktop: {
      ...FLOAT,
      position: 'absolute',
      bottom: '14px',
      left: '50%',
      transform: 'translateX(-50%)',
      'z-index': '3',
      display: 'flex',
      'align-items': 'center',
      gap: '10px',
      padding: '10px 14px 8px'
    },
    // A phone's foot is the toolbar's: its sticky tool is how a note is made there.
    mobile: { display: 'none' }
  }
});

/** The pads' papers, and the class `css.ts` points them from. */
const stack = styles('stickyStack', { display: 'flex', 'padding-top': '6px' });

const reactions = styles('reactions', { display: 'flex', gap: '2px' });

const reaction = styles('reaction', {
  css: {
    ...BUTTON_RESET,
    width: '34px',
    height: '34px',
    'border-radius': '8px',
    'font-size': '19px',
    'line-height': '1',
    transition: 'transform 120ms ease'
  },
  states: {
    hover: { 'background-color': 'var(--surface-2)', transform: 'translateY(-2px) scale(1.12)' },
    active: { transform: 'scale(0.92)' },
    'focus-visible': { outline: '2px solid var(--accent)', 'outline-offset': '1px' }
  }
});

export const bottomTray = (): ElementSpec =>
  container({
    id: 'tray',
    class: tray,
    children: [
      stickyStack({
        id: 'sticky-stack',
        class: stack,
        flows: [
          [
            named('picked', declaredTrigger(stackDeclaration, 'onPick')),
            boardAction('carry', { fill: '{{ picked.fill }}' })
          ]
        ]
      }),
      divide(),
      container({
        class: reactions,
        children: REACTIONS.map((emoji, index) =>
          button({
            id: `reaction-${index}`,
            content: emoji,
            title: `React ${emoji} — everyone on the board sees it`,
            class: reaction,
            flows: [[onClick(), boardAction('react', { emoji })]]
          })
        )
      })
    ]
  });

const banner = styles('followBanner', {
  ...FLOAT,
  position: 'absolute',
  top: '70px',
  left: '50%',
  transform: 'translateX(-50%)',
  'z-index': '4',
  display: 'flex',
  'align-items': 'center',
  gap: '10px',
  padding: '6px 6px 6px 14px',
  'font-size': '13px',
  'font-weight': '600',
  border: '1px solid var(--accent)',
  color: 'var(--accent)'
});

const stopButton = styles('followStop', {
  css: {
    ...BUTTON_RESET,
    height: '28px',
    padding: '0px 10px',
    'border-radius': '6px',
    'font-size': '12px',
    'font-weight': '600',
    'background-color': 'var(--accent)',
    color: 'var(--on-accent)'
  },
  states: { hover: { filter: 'brightness(1.08)' } }
});

/** While this page follows somebody, it says so — and how to stop, which is also touching the board. */
export const followBanner = (): ElementSpec =>
  container({
    id: 'follow-banner',
    class: banner,
    visible: { source: 'computed.following', template: "{{ source ? 'true' : 'false' }}" },
    children: [
      text({ content: '', bind: [bindTemplate('content', 'computed.following', 'Following {{ source }}')] }),
      button({ id: 'follow-stop', content: 'Stop', class: stopButton, flows: [[onClick(), boardAction('unfollow')]] })
    ]
  });
