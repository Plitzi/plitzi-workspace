import {
  addNotification,
  button,
  container,
  declaredTrigger,
  defineElement,
  onClick,
  styles,
  text,
  toggleState,
  variantFrom
} from '@plitzi/sdk-authoring';

import copyDeclaration from '../plugins/CopyText/declaration.ts';
import { BELOW_HEADER, FLOAT, ICON_BUTTON } from './kit.ts';
import { closeOthers } from './panels.ts';
import { boardAction } from './stylePanel.ts';

import type { CopyTextAttributes } from '../plugins/CopyText/declaration.ts';
import type { ElementSpec } from '@plitzi/sdk-authoring';

/**
 * Inviting an agent — its own button beside Share, and its own panel: the one line that gives an agent Pizarra (its
 * MCP server, `src/agent`), and the sentence to send it. It joins like anyone — by name, with a cursor — and reads,
 * draws and talks.
 */

const copyText = defineElement<CopyTextAttributes>(copyDeclaration);

export const COPY_DECLARATION = copyDeclaration;

const note = styles('inviteNote', { 'font-size': '12px', color: 'var(--muted)', 'line-height': '1.45' });

/** The card's colours, and — in `css.ts` — where its `--copy-*` are pointed at the space's tokens. */
const copyClass = styles('copyText', { color: 'var(--ink)' });

const copied = (what: string) => [
  declaredTrigger(copyDeclaration, 'onCopied'),
  boardAction('chime', { sound: 'copy' }),
  addNotification({
    content: `${what} copied`,
    appearance: 'success',
    placement: 'bottom-center',
    autoDismissTimeout: 2000
  })
];

const panel = styles('agentPanel', {
  css: {
    desktop: {
      ...FLOAT,
      position: 'absolute',
      top: BELOW_HEADER,
      right: '14px',
      'z-index': '6',
      width: '340px',
      padding: '16px',
      display: 'flex',
      'flex-direction': 'column',
      gap: '10px'
    },
    mobile: { right: '10px', left: '10px', width: 'auto' }
  }
});

const head = styles('agentHead', { display: 'flex', 'align-items': 'center', gap: '10px' });

const spark = styles('agentSpark', {
  display: 'inline-flex',
  'align-items': 'center',
  'justify-content': 'center',
  width: '32px',
  height: '32px',
  'border-radius': '10px',
  'font-size': '16px',
  color: '#ffffff',
  'background-image': 'linear-gradient(135deg, #6d5dfc, #9b4dea)'
});

const title = styles('agentTitle', { 'font-size': '15px', 'font-weight': '700' });

const step = styles('agentStep', { 'font-size': '13px', 'font-weight': '600', color: 'var(--ink)' });

const agentButton = styles('agentButton', {
  // A phone's corner has room for the people and Share; an agent is invited from a desktop.
  css: {
    desktop: {
      ...ICON_BUTTON,
      color: 'var(--accent)',
      'font-size': '16px'
    },
    mobile: { display: 'none' }
  },
  states: {
    hover: { 'background-color': 'var(--accent-soft)' },
    'focus-visible': { outline: '2px solid var(--accent)', 'outline-offset': '1px' }
  },
  variants: { active: { 'background-color': 'var(--accent-soft)' } }
});

/** The ✦ beside Share: where an agent is invited from — in plain sight, not at the foot of another panel. */
export const agentButtonFor = (): ElementSpec =>
  button({
    id: 'agent-open',
    content: '✦',
    title: 'Invite an AI agent — it joins as a collaborator',
    class: agentButton,
    bind: [variantFrom(agentButton, 'computed.agentOpen', { template: "{{ source ? 'active' : '' }}" })],
    flows: [[onClick(), ...closeOthers('agentOpen'), toggleState({ key: 'agentOpen' })]]
  });

/** Two steps: give the agent Pizarra, once; then send it this board. */
export const agentPanel = (): ElementSpec =>
  container({
    id: 'agent-panel',
    class: panel,
    visible: 'computed.agentOpen',
    children: [
      container({
        class: head,
        children: [text({ content: '✦', class: spark }), text({ content: 'Invite an AI agent', class: title })]
      }),
      text({
        content:
          'An agent joins like a person: its name among the avatars, a cursor you watch move, notes and cards it adds, lines in the chat. It answers when you talk to it.',
        class: note
      }),
      text({ content: '1 · Give your agent Pizarra — once, from this repository', class: step }),
      copyText({
        id: 'agent-command',
        class: copyClass,
        text: 'claude mcp add pizarra -- node examples/06-full-examples/04-whiteboard/src/agent/main.ts',
        label: 'Copy',
        flows: [copied('Command')]
      }),
      text({ content: '2 · Send it this board', class: step }),
      copyText({
        id: 'agent-prompt',
        class: copyClass,
        text: 'Join this Pizarra board and help us: {url}',
        label: 'Copy',
        flows: [copied('Message')]
      }),
      text({
        content: 'Any MCP client works — Claude Desktop, Cursor… — with the same command as a local server.',
        class: note
      })
    ]
  });
