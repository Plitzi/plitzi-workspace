import {
  addNotification,
  bindTemplate,
  button,
  container,
  declaredTrigger,
  defineElement,
  onClick,
  runServerAction,
  setState,
  styles,
  text,
  toggleState
} from '@plitzi/sdk-authoring';

import { TIMER_ACTION } from '../actions.ts';
import countdownDeclaration from '../plugins/Countdown/declaration.ts';
import { BOARD_KEY, ofBoard } from './access.ts';
import { BOARD_PROVIDER } from './ids.ts';
import { BUTTON_RESET, FLOAT, caption, iconAction } from './kit.ts';

import type { CountdownAttributes } from '../plugins/Countdown/declaration.ts';
import type { ElementSpec } from '@plitzi/sdk-authoring';

/**
 * A timer everyone on a board shares — a workshop's five minutes to write ideas, a vote's thirty seconds.
 *
 * Started by anyone (`board-timer`), kept with the board and announced on its channel, so everyone counts down the
 * same five minutes, and somebody arriving in the middle sees what is left.
 */

const countdown = defineElement<CountdownAttributes>(countdownDeclaration);

export const COUNTDOWN_DECLARATION = countdownDeclaration;

const PRESETS: readonly { label: string; seconds: number }[] = [
  { label: '1 min', seconds: 60 },
  { label: '3 min', seconds: 180 },
  { label: '5 min', seconds: 300 },
  { label: '10 min', seconds: 600 }
];

const setTimer = (seconds: number) => [
  runServerAction({
    actionId: TIMER_ACTION,
    input: { board: `{{ apiContainer_${BOARD_PROVIDER}.id }}`, seconds: String(seconds), key: BOARD_KEY },
    invalidateQueries: 'none'
  }),
  setState({ key: 'timerOpen', type: 'boolean', value: false })
];

/**
 * When the board's timer ends: what its channel said last, if it spoke about this board — otherwise what the board
 * was loaded with.
 */
const ENDS_AT = `{{ state.timer and state.timer.board == source.id ? (state.timer.timer.endsAt ?? 0) : (${ofBoard('timer.endsAt', '0')} ?? 0) }}`;

const pill = styles('timerPill', {
  ...FLOAT,
  position: 'absolute',
  top: '68px',
  left: '50%',
  transform: 'translateX(-50%)',
  'z-index': '4',
  padding: '6px 14px',
  'font-size': '20px',
  'font-weight': '700',
  'font-variant-numeric': 'tabular-nums',
  'letter-spacing': '0.02em',
  color: 'var(--ink)'
});

const popover = styles('timerPopover', {
  ...FLOAT,
  position: 'absolute',
  top: '58px',
  right: '120px',
  'z-index': '6',
  display: 'flex',
  'flex-direction': 'column',
  gap: '10px',
  padding: '14px',
  width: '220px'
});

const presets = styles('timerPresets', {
  display: 'grid',
  'grid-template-columns': 'repeat(2, minmax(0px, 1fr))',
  gap: '6px'
});

const preset = styles('timerPreset', {
  css: {
    ...BUTTON_RESET,
    height: '34px',
    'border-radius': '8px',
    'font-weight': '600',
    'font-size': '13px',
    'text-align': 'center',
    'background-color': 'var(--surface-2)'
  },
  states: { hover: { 'background-color': 'var(--accent-soft)', color: 'var(--accent)' } }
});

/** The countdown everyone sees, at the top of the board — shown only while one runs (see `css.ts`). */
export const timerPill = (): ElementSpec =>
  countdown({
    id: 'timer-pill',
    runtime: 'client',
    class: pill,
    bind: [bindTemplate('endsAt', BOARD_PROVIDER, ENDS_AT, { returns: 'value' })],
    flows: [
      [
        declaredTrigger(countdownDeclaration, 'onEnd'),
        addNotification({
          content: '⏰ Time’s up!',
          appearance: 'info',
          placement: 'top-center',
          autoDismissTimeout: 6000
        })
      ]
    ]
  });

export const timerButton = (): ElementSpec =>
  iconAction({
    id: 'timer-open',
    icon: 'fa-regular fa-clock',
    title: 'Timer — for everyone on the board',
    flow: [onClick(), setState({ key: 'shareOpen', type: 'boolean', value: false }), toggleState({ key: 'timerOpen' })]
  });

export const timerPanel = (): ElementSpec =>
  container({
    id: 'timer-panel',
    class: popover,
    visible: 'computed.timerOpen',
    children: [
      text({ content: 'Timer for everyone', class: caption }),
      container({
        class: presets,
        children: PRESETS.map(entry =>
          button({
            id: `timer-${entry.seconds}`,
            content: entry.label,
            class: preset,
            flows: [[onClick(), ...setTimer(entry.seconds)]]
          })
        )
      }),
      button({ id: 'timer-stop', content: 'Stop the timer', class: preset, flows: [[onClick(), ...setTimer(0)]] })
    ]
  });
