import {
  bindTemplate,
  button,
  container,
  declaredTrigger,
  defineElement,
  named,
  onClick,
  setState,
  styles,
  text,
  toggleState,
  variantFrom
} from '@plitzi/sdk-authoring';

import { editOnly } from './access.ts';
import { BUTTON_RESET, FLOAT, ICON_BUTTON, divide, icon } from './kit.ts';
import { closeOthers } from './panels.ts';
import { boardAction } from './stylePanel.ts';
import { REACTIONS, STAMPS } from '../board/reactions.ts';
import stackDeclaration from '../plugins/StickyStack/declaration.ts';

import type { StickyStackAttributes } from '../plugins/StickyStack/declaration.ts';
import type { ElementSpec } from '@plitzi/sdk-authoring';

/**
 * The tray at the foot of the board: what a room does together, rather than what a drawing is made of — a pile of
 * sticky notes, stamps that stay on the board, the laser, cursor chat, and reactions that float away.
 *
 * A single note is the toolbar's sticky tool; what only the tray offers is the pile, taken off it (`onPick`) and handed
 * to the canvas (`carry`), which carries it until it is put down — two elements, one flow between them.
 *
 * The reactions are one button until they are wanted: it opens a row of them over the tray (`reactionPicker`), which
 * stays open while somebody cheers and closes like every popover — on a click elsewhere, or Escape. Each is the
 * canvas's `react`: it floats up where this person points, on every screen.
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
      padding: '6px 8px 6px 14px'
    },
    // A phone's foot is the toolbar's: its sticky tool is how a note is made there.
    mobile: { display: 'none' }
  }
});

/** The pads' papers, and the class `css.ts` points them from. */
const stack = styles('stickyStack', { display: 'flex', 'padding-top': '6px' });

const reactButton = styles('reactButton', {
  css: { ...ICON_BUTTON, 'font-size': '18px' },
  states: {
    hover: { 'background-color': 'var(--surface-2)' },
    'focus-visible': { outline: '2px solid var(--accent)', 'outline-offset': '1px' }
  },
  variants: { active: { 'background-color': 'var(--accent-soft)', color: 'var(--accent)' } }
});

const picker = styles('reactionPicker', {
  css: {
    desktop: {
      ...FLOAT,
      position: 'absolute',
      bottom: '72px',
      left: '50%',
      transform: 'translateX(-50%)',
      'z-index': '6',
      display: 'flex',
      gap: '2px',
      padding: '5px',
      'border-radius': '999px'
    },
    mobile: { display: 'none' }
  }
});

const reaction = styles('reaction', {
  css: {
    ...BUTTON_RESET,
    width: '38px',
    height: '38px',
    'border-radius': '50%',
    'font-size': '21px',
    'line-height': '1',
    transition: 'transform 120ms ease'
  },
  states: {
    hover: { 'background-color': 'var(--surface-2)', transform: 'translateY(-3px) scale(1.15)' },
    active: { transform: 'scale(0.9)' },
    'focus-visible': { outline: '2px solid var(--accent)', 'outline-offset': '1px' }
  }
});

/**
 * The tray is for a board that can change: a read-only one — a template, a board its owner closed — is looked at, and
 * its banner says so and offers the laser instead. The keys (K, /) still answer whoever knows them.
 */
export const bottomTray = (): ElementSpec =>
  editOnly([
    container({
      id: 'tray',
      class: tray,
      children: [
        stickyStack({
          id: 'sticky-stack',
          class: stack,
          colors: '',
          flows: [
            [
              named('picked', declaredTrigger(stackDeclaration, 'onPick')),
              boardAction('carry', { fill: '{{ picked.fill }}', kind: '{{ picked.kind }}' })
            ]
          ]
        }),
        button({
          id: 'stamp-open',
          content: '',
          title: 'Stamps — a mark that stays on the board',
          class: reactButton,
          bind: [variantFrom(reactButton, 'computed.stampOpen', { template: "{{ source ? 'active' : '' }}" })],
          flows: [[onClick(), ...closeOthers('stampOpen'), toggleState({ key: 'stampOpen' })]],
          children: [icon('fa-solid fa-stamp')]
        }),
        button({
          id: 'tray-laser',
          content: '',
          title: 'Laser pointer — K',
          class: reactButton,
          bind: [variantFrom(reactButton, 'computed.tool', { template: "{{ source == 'laser' ? 'active' : '' }}" })],
          flows: [
            [
              onClick(),
              setState({ key: 'tool', type: 'text', value: "{{ computed.tool == 'laser' ? 'select' : 'laser' }}" })
            ]
          ],
          children: [icon('fa-solid fa-wand-magic-sparkles')]
        }),
        button({
          id: 'tray-chat',
          content: '',
          title: 'Say something at your cursor — /',
          class: reactButton,
          flows: [[onClick(), boardAction('chat')]],
          children: [icon('fa-regular fa-message')]
        }),
        divide(),
        button({
          id: 'react-open',
          content: '',
          title: 'React — everyone on the board sees it',
          class: reactButton,
          bind: [variantFrom(reactButton, 'computed.reactOpen', { template: "{{ source ? 'active' : '' }}" })],
          flows: [[onClick(), ...closeOthers('reactOpen'), toggleState({ key: 'reactOpen' })]],
          children: [icon('fa-regular fa-face-smile')]
        })
      ]
    })
  ]);

/** The stamps, over the tray while its button is on: each click puts one down, so a row of verdicts is a few clicks. */
export const stampPicker = (): ElementSpec =>
  container({
    id: 'stamp-picker',
    class: picker,
    visible: 'computed.stampOpen',
    children: STAMPS.map((emoji, index) =>
      button({
        id: `stamp-${index}`,
        content: emoji,
        title: `Stamp ${emoji} where you point`,
        class: reaction,
        flows: [[onClick(), boardAction('stamp', { emoji })]]
      })
    )
  });

/** The reactions, over the tray while its button is on. */
export const reactionPicker = (): ElementSpec =>
  container({
    id: 'reaction-picker',
    class: picker,
    visible: 'computed.reactOpen',
    children: REACTIONS.map((emoji, index) =>
      button({
        id: `reaction-${index}`,
        content: emoji,
        title: `React ${emoji}`,
        class: reaction,
        flows: [[onClick(), boardAction('react', { emoji })]]
      })
    )
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
