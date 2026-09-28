import {
  bindTemplate,
  button,
  container,
  formControl,
  named,
  on,
  onClick,
  setState,
  styles,
  text,
  toggleState,
  variantFrom
} from '@plitzi/sdk-authoring';

import { BUTTON_RESET, FLOAT, iconAction, iconButton, panelMotion, PRESSED, RISE, riseAt } from './kit.ts';
import { closeOthers } from './panels.ts';
import { boardAction } from './stylePanel.ts';
import { DUTY_PRESETS } from '../board/duties.ts';
import { DUTY_ROLES } from '../board/model.ts';

import type { DutyRole } from '../board/model.ts';
import type { ElementSpec } from '@plitzi/sdk-authoring';

/**
 * A duty for an agent, set on a frame: a role — scribe, guardian, organizer, or one's own — and what to keep doing
 * there. The frame says so in its title bar, and an agent on the board takes it (`my_duties`, `take_duty`) and keeps at
 * it for as long as the board lives: a scribe's summary stays current, a guardian says when a rule is broken. The
 * people on the board pause it, change it or take it away here.
 *
 * What is being written waits in the page's state (`dutyDraftRole`, `dutyDraft`) until Save: the frame's own duty comes
 * with the selection (`onSelectionChange`) and starts the draft each time a frame is selected.
 */

const PANEL_MOTION = panelMotion({ from: 'above', rest: 'translateX(-50%)' });

const panel = styles('dutyPanel', {
  css: {
    desktop: {
      ...PANEL_MOTION.desktop,
      ...FLOAT,
      position: 'absolute',
      top: '70px',
      left: '50%',
      transform: 'translateX(-50%)',
      'z-index': '6',
      display: 'flex',
      'flex-direction': 'column',
      gap: '12px',
      width: 'min(380px, calc(100vw - 24px))',
      padding: '16px'
    },
    mobile: { ...PANEL_MOTION.mobile, top: '64px' }
  },
  states: PANEL_MOTION.states
});

const heading = styles('dutyHeading', { display: 'flex', 'flex-direction': 'column', gap: '4px' });

const title = styles('dutyTitle', { 'font-size': '15px', 'font-weight': '700' });

const lead = styles('dutyLead', { 'font-size': '13px', 'line-height': '1.45', color: 'var(--muted)' });

const roles = styles('dutyRoles', {
  display: 'grid',
  'grid-template-columns': 'repeat(4, minmax(0px, 1fr))',
  gap: '6px'
});

const role = styles('dutyRole', {
  css: {
    ...BUTTON_RESET,
    height: '32px',
    'border-radius': '8px',
    'font-size': '12px',
    'font-weight': '600',
    border: '1px solid var(--edge)',
    'background-color': 'var(--surface)',
    transition: 'background-color 140ms ease, border-color 140ms ease, color 140ms ease, transform 140ms ease',
    ...RISE
  },
  states: {
    hover: { 'background-color': 'var(--surface-2)' },
    'focus-visible': { outline: '2px solid var(--accent)', 'outline-offset': '2px' },
    active: PRESSED
  },
  variants: {
    chosen: {
      color: 'var(--accent)',
      'border-color': 'var(--accent)',
      'background-color': 'var(--accent-soft)'
    }
  }
});

const instruction = styles('dutyInstruction', { width: '100%' });

const instructionBox = styles('dutyInstructionBox', {
  css: {
    'min-height': '84px',
    padding: '8px 10px',
    'border-radius': '10px',
    border: '1px solid var(--edge)',
    'background-color': 'var(--surface-2)',
    'font-size': '13px',
    'line-height': '1.45'
  }
});

const status = styles('dutyStatus', {
  display: 'flex',
  'align-items': 'center',
  gap: '8px',
  padding: '8px 10px',
  'border-radius': '10px',
  'font-size': '12px',
  'font-weight': '600',
  color: 'var(--accent)',
  'background-color': 'var(--accent-soft)'
});

const actions = styles('dutyActions', { display: 'flex', gap: '8px', 'justify-content': 'flex-end' });

const ACTION = {
  ...BUTTON_RESET,
  height: '32px',
  padding: '0px 12px',
  'border-radius': '8px',
  'font-size': '13px',
  'font-weight': '600'
} as const;

const primary = styles('dutySave', {
  css: { ...ACTION, color: 'var(--on-accent)', 'background-color': 'var(--accent)' },
  states: { hover: { filter: 'brightness(1.08)' } }
});

const secondary = styles('dutySecondary', {
  css: { ...ACTION, 'background-color': 'var(--surface-2)' },
  states: { hover: { 'background-color': 'var(--edge)' } }
});

/** A role's own instruction, as twig: what the field suggests while nothing is written in it. */
const suggestions = `{{ {${DUTY_ROLES.map(
  name => `'${name}': '${DUTY_PRESETS[name].instruction.replace(/'/g, "\\'")}'`
).join(', ')}}[source] ?? '' }}`;

const close = setState({ key: 'dutyOpen', type: 'boolean', value: false });

const roleButton = (name: DutyRole, index: number): ElementSpec =>
  button({
    id: `duty-role-${name}`,
    content: DUTY_PRESETS[name].label,
    class: [role, riseAt(index)],
    bind: [variantFrom(role, 'computed.dutyDraftRole', { template: `{{ source == '${name}' ? 'chosen' : '' }}` })],
    flows: [[onClick(), setState({ key: 'dutyDraftRole', type: 'text', value: name })]]
  });

/** In a frame's tools: the duty's panel, lit while the frame has one. */
export const dutyButton = (): ElementSpec =>
  iconAction({
    id: 'duty-open',
    icon: 'fa-solid fa-robot',
    title: 'Agent duty — a job an agent keeps doing in this frame',
    bind: [variantFrom(iconButton, 'computed.hasDuty', { template: "{{ source ? 'active' : '' }}" })],
    flow: [onClick(), ...closeOthers('dutyOpen'), toggleState({ key: 'dutyOpen' })]
  });

export const dutyPanel = (): ElementSpec =>
  container({
    id: 'duty-panel',
    class: panel,
    visible: 'computed.dutyOpen',
    // Kept once opened, so it leaves whole: its field follows the draft, which each selected frame starts again.
    loadStrategy: 'lazy',
    children: [
      container({
        class: heading,
        children: [
          text({ content: 'A duty for an agent', class: title }),
          text({
            content:
              'Something an agent keeps doing in this frame for as long as the board lives. An agent on the board takes it and says so here.',
            class: lead
          })
        ]
      }),
      container({ class: roles, children: DUTY_ROLES.map((name, index) => roleButton(name, index)) }),
      formControl({
        id: 'duty-instruction',
        name: 'instruction',
        subType: 'textarea',
        label: '',
        required: false,
        maxLength: 600,
        class: instruction,
        slots: { input: instructionBox },
        bind: [
          bindTemplate('defaultValue', 'computed.dutyDraft', '{{ source }}'),
          bindTemplate('placeholder', 'computed.dutyDraftRole', suggestions)
        ],
        flows: [
          [named('written', on('onChange')), setState({ key: 'dutyDraft', type: 'text', value: '{{ written.value }}' })]
        ]
      }),
      text({
        content: '',
        class: status,
        visible: 'computed.hasDuty',
        bind: [
          bindTemplate(
            'content',
            'computed.dutyAgent',
            "{{ computed.dutyPaused ? 'Paused — the agent waits until it is resumed' : (source ? '✦ ' ~ source ~ ' is on it' : 'Waiting for an agent to take it — invite one with ✦ in the corner') }}"
          )
        ]
      }),
      container({
        class: actions,
        children: [
          container({
            visible: 'computed.hasDuty',
            class: styles('dutyWhenSet', { display: 'contents' }),
            children: [
              button({
                id: 'duty-remove',
                content: 'Remove',
                class: secondary,
                flows: [[onClick(), boardAction('clearDuty'), close]]
              }),
              button({
                id: 'duty-pause',
                content: '',
                class: secondary,
                bind: [bindTemplate('content', 'computed.dutyPaused', "{{ source ? 'Resume' : 'Pause' }}")],
                flows: [[onClick(), boardAction('toggleDutyPause')]]
              })
            ]
          }),
          button({
            id: 'duty-save',
            content: 'Save',
            class: primary,
            flows: [
              [
                onClick(),
                boardAction('setDuty', {
                  role: '{{ computed.dutyDraftRole }}',
                  instruction: '{{ computed.dutyDraft }}'
                }),
                close
              ]
            ]
          })
        ]
      })
    ]
  });
