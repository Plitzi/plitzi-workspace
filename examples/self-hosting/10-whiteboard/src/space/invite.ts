import {
  addNotification,
  bindTemplate,
  button,
  container,
  declaredTrigger,
  onClick,
  setState,
  styles,
  text,
  toggleState,
  variantFrom
} from '@plitzi/sdk-authoring';

import { copyClass, copyText, COPY_DECLARATION } from './copy.ts';
import { guideLinkFromBoard } from './guide/agents.ts';
import { BOARD_PROVIDER } from './ids.ts';
import { BELOW_HEADER, BUTTON_RESET, FLOAT, ICON_BUTTON, PRESSED, panelMotion } from './kit.ts';
import { closeOthers } from './panels.ts';
import { boardAction } from './stylePanel.ts';

import type { ElementSpec } from '@plitzi/sdk-authoring';

/**
 * Inviting an agent — its own button beside Share, and its own panel: the one line that gives an agent Pizarra (its
 * MCP server, `src/agent`), and the sentence to send it. It joins like anyone — by name, with a cursor — and reads,
 * draws and talks.
 */

const note = styles('inviteNote', { 'font-size': '12px', color: 'var(--muted)', 'line-height': '1.45' });

const copied = (what: string) => [
  declaredTrigger(COPY_DECLARATION, 'onCopied'),
  boardAction('chime', { sound: 'copy' }),
  addNotification({
    content: `${what} copied`,
    appearance: 'success',
    placement: 'bottom-center',
    autoDismissTimeout: 2000
  })
];

/** The key the page opened a locked board with, as the tail of the link an agent is sent: nothing, for an open one. */
const WITH_KEY = "source.locked and state.opened and state.opened.id == source.id ? '#key=' ~ state.opened.key : ''";

const lockedNote = styles('inviteLockedNote', {
  padding: '8px 10px',
  'border-radius': '10px',
  'font-size': '12px',
  'line-height': '1.45',
  color: 'var(--ink)',
  'background-color': 'var(--accent-soft)'
});

const PANEL_MOTION = panelMotion({ from: 'above', origin: 'top right' });

const panel = styles('agentPanel', {
  css: {
    desktop: {
      ...PANEL_MOTION.desktop,
      ...FLOAT,
      position: 'absolute',
      top: BELOW_HEADER,
      right: '14px',
      'z-index': '6',
      width: '384px',
      padding: '16px',
      display: 'flex',
      'flex-direction': 'column',
      gap: '10px'
    },
    mobile: { ...PANEL_MOTION.mobile, right: '10px', left: '10px', width: 'auto' }
  },
  states: PANEL_MOTION.states
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

/**
 * Where an agent comes from: the app it lives in decides how Pizarra is added to it. Every one of them is given the
 * same thing — this Pizarra's agent, at `/mcp` on the address the page is at — and nothing to install or run.
 */
const APPS = [
  {
    id: 'claude-code',
    label: 'Claude Code',
    how: 'In a terminal, once — for every folder. Then start claude (a new session: it reads its tools as it starts) and send it the board.',
    copy: 'claude mcp add --scope user --transport http pizarra {origin}/mcp'
  },
  {
    id: 'opencode',
    label: 'OpenCode',
    how: 'In a terminal — then start opencode and send it the board.',
    copy: 'opencode mcp add pizarra --url {origin}/mcp'
  },
  {
    id: 'claude-app',
    label: 'Claude app',
    how: 'Settings → Connectors → Add custom connector, named Pizarra, at this address. Claude reaches it from the Internet: it has to be a public https address.',
    copy: '{origin}/mcp'
  },
  {
    id: 'chrome',
    label: 'Chrome',
    how: 'Claude in Chrome, the browser extension: nothing to add. Open Claude beside this board and paste this, with what you want done. It works on this page as you — through the List view — so what it changes is yours, and it stays only while you ask.',
    copy: 'This is a Pizarra whiteboard. Open its List view (the list button in the bottom bar, or Shift+L) — every frame, card and note is there, with buttons to add, edit, tick off and move them — and help us: '
  },
  {
    id: 'other',
    label: 'Other',
    how: 'Any app that speaks MCP — Cursor, VS Code, Codex… — as a remote (HTTP) server at this address.',
    copy: '{origin}/mcp'
  }
] as const;

// Each as wide as its name, and the room left shared: "Claude Code" is longer than "Other". What does not fit on one
// line goes on to the next, whole — a name cut short is a tab nobody can find.
const apps = styles('agentApps', {
  display: 'flex',
  'flex-wrap': 'wrap',
  gap: '2px',
  padding: '3px',
  'border-radius': '10px',
  'background-color': 'var(--surface-2)'
});

const app = styles('agentApp', {
  css: {
    ...BUTTON_RESET,
    flex: '1 1 auto',
    height: '30px',
    padding: '0px 6px',
    'border-radius': '8px',
    'font-size': '12px',
    'font-weight': '600',
    'white-space': 'nowrap',
    overflow: 'hidden',
    'text-overflow': 'ellipsis',
    color: 'var(--muted)',
    transition: 'background-color 140ms ease, color 140ms ease, transform 140ms ease'
  },
  states: {
    hover: { color: 'var(--ink)' },
    'focus-visible': { outline: '2px solid var(--accent)', 'outline-offset': '1px' },
    active: PRESSED
  },
  variants: {
    chosen: { color: 'var(--ink)', 'background-color': 'var(--surface)', 'box-shadow': '0 1px 3px var(--shadow)' }
  }
});

const howTo = styles('agentHow', { display: 'flex', 'flex-direction': 'column', gap: '8px' });

/** An app that reaches the board through `/mcp` — every one but Claude in Chrome, which works on the page itself. */
const THROUGH_MCP = { source: 'computed.agentApp', template: "{{ source != 'chrome' }}" };

const chosenApp = (id: string) => ({ source: 'computed.agentApp', template: `{{ source == '${id}' }}` });

/** Two steps: give the agent Pizarra, once, from the app it lives in; then send it this board. */
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
          'It joins like a person: its name among the avatars, a cursor you watch move, notes and cards it adds, lines in the chat. It answers when you talk to it.',
        class: note,
        visible: THROUGH_MCP
      }),
      text({ content: '1 · Add Pizarra to your agent — once', class: step, visible: THROUGH_MCP }),
      text({ content: '1 · Ask Claude, beside this board', class: step, visible: chosenApp('chrome') }),
      container({
        class: apps,
        children: APPS.map(entry =>
          button({
            id: `agent-app-${entry.id}`,
            content: entry.label,
            class: app,
            bind: [
              variantFrom(app, 'computed.agentApp', { template: `{{ source == '${entry.id}' ? 'chosen' : '' }}` })
            ],
            flows: [[onClick(), setState({ key: 'agentApp', type: 'text', value: entry.id })]]
          })
        )
      }),
      ...APPS.map(entry =>
        container({
          id: `agent-how-${entry.id}`,
          class: howTo,
          visible: chosenApp(entry.id),
          children: [
            copyText({
              id: `agent-command-${entry.id}`,
              class: copyClass,
              text: entry.copy,
              label: 'Copy',
              flows: [
                copied(entry.id === 'chrome' ? 'Message' : entry.copy.startsWith('{origin}') ? 'Address' : 'Command')
              ]
            }),
            text({ content: entry.how, class: note })
          ]
        })
      ),
      text({ content: '2 · Send it this board', class: step, visible: THROUGH_MCP }),
      copyText({
        id: 'agent-prompt',
        class: copyClass,
        text: 'Join this Pizarra board and help us: {url}',
        label: 'Copy',
        // A board with a password: the link carries the key this page opened it with, and the agent opens it with that.
        bind: [bindTemplate('text', BOARD_PROVIDER, `Join this Pizarra board and help us: {url}{{ ${WITH_KEY} }}`)],
        visible: THROUGH_MCP,
        flows: [copied('Message')]
      }),
      text({
        content:
          'This board has a password. The message carries a key that opens it, so your agent does not need the password — send it only to your agent. Or send the password instead: “… help us: <link> password: <the password>”.',
        class: lockedNote,
        visible: { source: BOARD_PROVIDER, template: "{{ source.locked and computed.agentApp != 'chrome' }}" }
      }),
      text({
        content:
          'Added once, it can be invited to any board on this Pizarra. It shows up under its app’s name — Claude, OpenCode… — and stays while you work: it leaves when you ask it to, when nobody is on the board, or after the quiet set in Board settings.',
        class: note,
        visible: THROUGH_MCP
      }),
      guideLinkFromBoard()
    ]
  });
