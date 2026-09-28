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
  text
} from '@plitzi/sdk-authoring';

import { SESSION_ACTION } from '../actions.ts';
import { BOARD_PASS, ofBoard } from './access.ts';
import { BOARD_PROVIDER } from './ids.ts';
import { BUTTON_RESET, FLOAT, caption, panelMotion, PRESSED, RISE, riseAt } from './kit.ts';
import { boardAction } from './stylePanel.ts';
import { SCRIPT_IDS, SCRIPTS } from '../board/sessions.ts';
import countdownDeclaration from '../plugins/Countdown/declaration.ts';

import type { ScriptId } from '../board/sessions.ts';
import type { CountdownAttributes } from '../plugins/Countdown/declaration.ts';
import type { ElementSpec, StepSpec } from '@plitzi/sdk-authoring';

/**
 * A session with a script, on the page: started from the timer's panel, and while it runs a bar at the top of the board
 * that says which step everyone is at, what it is for and how long it has left — with the next step and the end a
 * click away for whoever runs it (anyone may). The steps themselves are the board's (`board-session`), announced on
 * its channel, so every page is at the same one; the canvas turns the others' notes over during a writing step.
 */

const countdown = defineElement<CountdownAttributes>(countdownDeclaration);

/**
 * The session the board is going through, for the canvas: what its channel said last, if it spoke about this board —
 * otherwise what the board was loaded with. `null` when none runs.
 */
export const SESSION = `{{ state.sessionHeard and state.sessionHeard.board == source.id ? state.sessionHeard.session : (${ofBoard('session', 'null')} ?? null) }}`;

/** A step of the session run on the board, for everyone: `start` (with a script), `next` or `stop`. */
const runSession = (command: 'start' | 'next' | 'stop', script?: ScriptId): StepSpec =>
  runServerAction({
    actionId: SESSION_ACTION,
    input: {
      board: `{{ apiContainer_${BOARD_PROVIDER}.id }}`,
      command,
      ...(script ? { script } : {}),
      host: '{{ computed.name }}',
      ...BOARD_PASS
    },
    invalidateQueries: 'none'
  });

const BAR_MOTION = panelMotion({ from: 'above', rest: 'translateX(-50%)' });

const bar = styles('sessionBar', {
  css: {
    desktop: {
      ...BAR_MOTION.desktop,
      ...FLOAT,
      position: 'absolute',
      top: '68px',
      left: '50%',
      transform: 'translateX(-50%)',
      'z-index': '4',
      display: 'flex',
      'align-items': 'center',
      gap: '12px',
      'max-width': 'calc(100vw - 24px)',
      padding: '6px 6px 6px 14px',
      border: '1px solid var(--accent)'
    },
    mobile: { ...BAR_MOTION.mobile, top: '62px', 'flex-wrap': 'wrap' }
  },
  states: BAR_MOTION.states
});

const stepLabel = styles('sessionStep', {
  display: 'flex',
  'flex-direction': 'column',
  gap: '2px',
  'min-width': '0px'
});

const stepTitle = styles('sessionStepTitle', {
  'font-size': '12px',
  'font-weight': '700',
  'letter-spacing': '0.04em',
  'text-transform': 'uppercase',
  color: 'var(--accent)'
});

const stepSay = styles('sessionStepSay', {
  'max-width': '420px',
  'font-size': '13px',
  overflow: 'hidden',
  'text-overflow': 'ellipsis',
  'white-space': 'nowrap'
});

const clock = styles('sessionClock', {
  'font-size': '18px',
  'font-weight': '700',
  'font-variant-numeric': 'tabular-nums',
  color: 'var(--ink)'
});

const ACTION = {
  ...BUTTON_RESET,
  height: '32px',
  padding: '0px 12px',
  'border-radius': '8px',
  'font-size': '13px',
  'font-weight': '600',
  'white-space': 'nowrap'
} as const;

const next = styles('sessionNext', {
  css: { ...ACTION, color: 'var(--on-accent)', 'background-color': 'var(--accent)' },
  states: { hover: { filter: 'brightness(1.08)' } }
});

const end = styles('sessionEnd', {
  css: { ...ACTION, 'background-color': 'var(--surface-2)' },
  states: { hover: { 'background-color': 'var(--edge)' } }
});

const starts = styles('sessionStarts', { display: 'flex', 'flex-direction': 'column', gap: '6px' });

const startButton = styles('sessionStart', {
  css: {
    ...BUTTON_RESET,
    display: 'flex',
    'flex-direction': 'column',
    'align-items': 'flex-start',
    gap: '2px',
    padding: '8px 10px',
    'border-radius': '8px',
    'text-align': 'left',
    'background-color': 'var(--surface-2)',
    transition: 'background-color 140ms ease, transform 140ms ease',
    ...RISE
  },
  states: { hover: { 'background-color': 'var(--accent-soft)' }, active: PRESSED }
});

const startName = styles('sessionStartName', { 'font-size': '13px', 'font-weight': '600' });

const startSteps = styles('sessionStartSteps', { 'font-size': '11px', color: 'var(--muted)' });

/**
 * In the timer's panel: the scripts, each a click from being run for everyone — rising in after what is above them,
 * from `firstPlace` on.
 */
export const sessionStarts = (firstPlace: number): ElementSpec =>
  container({
    class: starts,
    children: [
      text({ content: 'Or run a session', class: caption }),
      ...SCRIPT_IDS.map((id, index) =>
        button({
          id: `session-${id}`,
          content: '',
          class: [startButton, riseAt(firstPlace + index)],
          flows: [[onClick(), runSession('start', id), setState({ key: 'timerOpen', type: 'boolean', value: false })]],
          children: [
            text({ content: SCRIPTS[id].label, class: startName }),
            text({
              content: SCRIPTS[id].steps.map(step => `${step.kind} ${step.minutes}′`).join(' · '),
              class: startSteps
            })
          ]
        })
      )
    ]
  });

/** The bar at the top of the board while a session runs — what the canvas said of it (`onSessionChange`). */
export const sessionBar = (): ElementSpec =>
  container({
    id: 'session-bar',
    class: bar,
    visible: 'computed.sessionActive',
    children: [
      container({
        class: stepLabel,
        children: [
          text({
            content: '',
            class: stepTitle,
            bind: [
              bindTemplate(
                'content',
                'computed.sessionView',
                "{{ source.label ~ ' · ' ~ source.kind ~ ' · ' ~ source.step ~ '/' ~ source.steps }}"
              )
            ]
          }),
          text({ content: '', class: stepSay, bind: { content: 'computed.sessionView.says' } })
        ]
      }),
      countdown({
        id: 'session-clock',
        runtime: 'client',
        class: clock,
        tickSeconds: 0,
        bind: [bindTemplate('endsAt', 'computed.sessionView', '{{ source.endsAt ?? 0 }}', { returns: 'value' })],
        flows: [
          [
            declaredTrigger(countdownDeclaration, 'onEnd'),
            boardAction('chime', { sound: 'timer' }),
            addNotification({
              content: 'Time for this step is up — move on when you are ready',
              appearance: 'info',
              placement: 'top-center',
              autoDismissTimeout: 5000
            })
          ]
        ]
      }),
      button({ id: 'session-next', content: 'Next step', class: next, flows: [[onClick(), runSession('next')]] }),
      button({ id: 'session-end', content: 'End', class: end, flows: [[onClick(), runSession('stop')]] })
    ]
  });
