import {
  addNotification,
  bindTemplate,
  button,
  container,
  form,
  formControl,
  list,
  named,
  onClick,
  onSubmit,
  resetForm,
  runServerAction,
  setState,
  styles,
  text,
  toggleState,
  variantFrom,
  when,
  whenFailed
} from '@plitzi/sdk-authoring';

import { CHAT_ACTION } from '../actions.ts';
import { COLLAB_COLOURS } from '../board/people.ts';
import { REACTIONS } from '../board/reactions.ts';
import { BOARD_PASS } from './access.ts';
import { BOARD_PROVIDER } from './ids.ts';
import { BELOW_HEADER, BUTTON_RESET, FLOAT, ICON_BUTTON, icon } from './kit.ts';
import { boardAction } from './stylePanel.ts';

import type { ElementSpec, StepSpec } from '@plitzi/sdk-authoring';

/**
 * The board's chat: what the people on it say to each other, kept with the board — somebody arriving later reads what
 * was said before them. Beside the cursor chat (`/`), which is said where one points and gone a moment later.
 *
 * Kept by the server (`board-chat`), carried on the board's channel like every change, and read as it arrives: the
 * `feed` channel appends each line to the page's state (`chat`), which starts from what the board arrived with. A
 * panel to keep open while working — not a popover: a click on the board does not close it.
 */

const PROVIDER = `apiContainer_${BOARD_PROVIDER}`;

/** What the board arrived with — its own, or for a locked one, what opening it answered. */
const ARRIVED = `(${PROVIDER}.locked ? (state.opened ? state.opened.chat : []) : ${PROVIDER}.chat)`;

/** The lines to show, in a flow: those heard on this board since it was shown, else those it arrived with. */
export const CHAT_LINES = `(state.chat and state.chat.board == ${PROVIDER}.id ? state.chat.lines : ${ARRIVED})`;

/**
 * A line heard on the board's channel: added to what is shown — the last hundred — and counted as unread while the
 * chat is closed.
 */
export const hearChat = (heard: string): StepSpec[] => [
  setState({
    key: 'chat',
    type: 'json',
    value: `{ "board": {{ ${PROVIDER}.id|json_encode }}, "lines": {{ (${CHAT_LINES}|merge([${heard}.data]))|slice(-100)|json_encode }} }`
  }),
  // Unread: somebody else's line, said while the chat is closed — never one's own.
  setState({
    key: 'unread',
    type: 'number',
    value: `{{ (state.unread ?? 0) + (not state.chatOpen and ${heard}.data.by != computed.visitor ? 1 : 0) }}`
  }),
  // And a soft sound for it — somebody else's, never one's own: no sound named is no sound.
  boardAction('chime', { sound: `{{ ${heard}.data.by != computed.visitor ? 'message' : '' }}` })
];

const unreadBadge = styles('unreadBadge', {
  position: 'absolute',
  top: '3px',
  right: '2px',
  'min-width': '16px',
  height: '16px',
  padding: '0px 4px',
  'border-radius': '999px',
  'font-size': '10px',
  'font-weight': '700',
  'line-height': '16px',
  'text-align': 'center',
  color: '#ffffff',
  'background-color': 'var(--danger)',
  'pointer-events': 'none'
});

const chatButtonClass = styles('chatButton', {
  css: ICON_BUTTON,
  states: {
    hover: { 'background-color': 'var(--surface-2)' },
    'focus-visible': { outline: '2px solid var(--accent)', 'outline-offset': '1px' }
  },
  variants: { active: { 'background-color': 'var(--accent-soft)', color: 'var(--accent)' } }
});

export const chatButton = (): ElementSpec =>
  button({
    id: 'chat-open',
    content: '',
    title: 'Chat — talk with everyone on the board',
    class: chatButtonClass,
    bind: [variantFrom(chatButtonClass, 'computed.chatOpen', { template: "{{ source ? 'active' : '' }}" })],
    flows: [[onClick(), toggleState({ key: 'chatOpen' }), setState({ key: 'unread', type: 'number', value: 0 })]],
    children: [
      icon('fa-regular fa-comments'),
      text({
        content: '',
        class: unreadBadge,
        visible: { source: 'computed.unread', template: "{{ source > 0 ? 'true' : 'false' }}" },
        bind: [bindTemplate('content', 'computed.unread', "{{ source > 9 ? '9+' : source }}")]
      })
    ]
  });

const panel = styles('chatPanel', {
  css: {
    desktop: {
      ...FLOAT,
      position: 'absolute',
      top: BELOW_HEADER,
      right: '14px',
      // Above the minimap in the corner, which stays in sight while the chat is open.
      bottom: '166px',
      'z-index': '6',
      display: 'flex',
      'flex-direction': 'column',
      width: '320px',
      overflow: 'hidden'
    },
    mobile: { top: '64px', left: '10px', right: '10px', bottom: '10px', width: 'auto' }
  }
});

const head = styles('chatHead', {
  display: 'flex',
  'align-items': 'center',
  'justify-content': 'space-between',
  padding: '12px 12px 10px 16px',
  'border-bottom': '1px solid var(--edge)'
});

const title = styles('chatTitle', { 'font-size': '14px', 'font-weight': '600' });

const closeButton = styles('chatClose', {
  css: { ...ICON_BUTTON, width: '28px', height: '28px', color: 'var(--muted)' },
  states: { hover: { color: 'var(--ink)', 'background-color': 'var(--surface-2)' } }
});

/** Newest at the foot, and the list scrolled to it: `column-reverse` keeps a chat's bottom in view by itself. */
const scroller = styles('chatScroller', {
  flex: '1',
  'min-height': '0px',
  display: 'flex',
  'flex-direction': 'column-reverse',
  'overflow-y': 'auto',
  padding: '12px 16px'
});

const lines = styles('chatLines', {
  display: 'flex',
  'flex-direction': 'column',
  gap: '10px',
  margin: '0px',
  padding: '0px',
  'list-style-type': 'none'
});

const line = styles('chatLine', { display: 'flex', 'flex-direction': 'column', gap: '2px' });

/** A name in the colour its speaker has on the board — a class per colour, like the avatars'. */
const speaker = styles('chatSpeaker', {
  css: { 'font-size': '12px', 'font-weight': '700', color: 'var(--muted)' },
  variants: Object.fromEntries(COLLAB_COLOURS.map(colour => [colour, { color: `var(--collab-${colour})` }]))
});

const agentMark = styles('chatAgent', {
  'margin-left': '6px',
  padding: '1px 5px',
  'border-radius': '4px',
  'font-size': '10px',
  'font-weight': '700',
  color: 'var(--accent)',
  'background-color': 'var(--accent-soft)'
});

const words = styles('chatWords', {
  'font-size': '14px',
  'line-height': '1.45',
  'white-space': 'pre-wrap',
  'overflow-wrap': 'anywhere'
});

const empty = styles('chatEmpty', { 'font-size': '13px', color: 'var(--muted)', 'line-height': '1.5' });

const composer = styles('chatComposer', { display: 'flex', gap: '8px', padding: '6px 12px 10px' });

const field = styles('chatField', { flex: '1', 'min-width': '0px' });

const fieldBox = styles('chatFieldBox', {
  css: {
    display: 'flex',
    'align-items': 'center',
    height: '38px',
    padding: '0px 12px',
    border: '1px solid var(--edge)',
    'border-radius': '10px',
    'background-color': 'var(--surface-2)'
  },
  states: { 'focus-within': { 'border-color': 'var(--accent)', 'background-color': 'var(--surface)' } }
});

const send = styles('chatSend', {
  css: {
    ...BUTTON_RESET,
    width: '38px',
    height: '38px',
    'border-radius': '10px',
    'background-color': 'var(--accent)',
    color: 'var(--on-accent)'
  },
  states: { hover: { filter: 'brightness(1.08)' } }
});

/** A line said in the chat — typed, or an emoji sent with one click — and, refused, why. */
const sayInChat = (text: string, name: string): StepSpec[] => [
  boardAction('chime', { sound: 'sent' }),
  named(
    name,
    runServerAction({
      actionId: CHAT_ACTION,
      input: {
        board: `{{ ${PROVIDER}.id }}`,
        ...BOARD_PASS,
        name: '{{ computed.name }}',
        color: '{{ computed.color }}',
        text,
        by: '{{ computed.visitor }}'
      },
      invalidateQueries: 'none'
    })
  ),
  whenFailed(
    name,
    addNotification({
      content: `{{ ${name}.error ? ${name}.error : "That could not be sent" }}`,
      appearance: 'danger',
      placement: 'bottom-center',
      autoDismissTimeout: 4000
    })
  )
];

const quick = styles('chatQuick', {
  display: 'flex',
  'flex-wrap': 'wrap',
  gap: '2px',
  padding: '6px 10px 0px',
  'border-top': '1px solid var(--edge)'
});

const quickEmoji = styles('chatQuickEmoji', {
  css: {
    ...BUTTON_RESET,
    width: '32px',
    height: '32px',
    'border-radius': '8px',
    'font-size': '18px',
    'line-height': '1',
    transition: 'transform 120ms ease'
  },
  states: {
    hover: { 'background-color': 'var(--surface-2)', transform: 'scale(1.12)' },
    'focus-visible': { outline: '2px solid var(--accent)' }
  }
});

export const chatPanel = (): ElementSpec =>
  container({
    id: 'chat-panel',
    class: panel,
    visible: 'computed.chatOpen',
    children: [
      container({
        class: head,
        children: [
          text({ content: 'Chat', class: title }),
          button({
            id: 'chat-close',
            content: '✕',
            title: 'Close',
            class: closeButton,
            flows: [[onClick(), setState({ key: 'chatOpen', type: 'boolean', value: false })]]
          })
        ]
      }),
      container({
        class: scroller,
        children: [
          container({
            children: [
              text({
                content:
                  'Say hello — everyone on the board sees it, and it stays with the board for whoever comes next.',
                class: empty,
                visible: {
                  source: BOARD_PROVIDER,
                  template: `{{ ${CHAT_LINES.replaceAll(PROVIDER, 'source')}|length > 0 ? 'false' : 'true' }}`
                }
              }),
              list({
                id: 'chat',
                source: 'controlled',
                class: lines,
                bind: [
                  bindTemplate('items', BOARD_PROVIDER, `{{ ${CHAT_LINES.replaceAll(PROVIDER, 'source')} }}`, {
                    returns: 'value'
                  })
                ],
                children: [
                  container({
                    subType: 'li',
                    class: line,
                    children: [
                      container({
                        children: [
                          text({
                            content: '',
                            class: speaker,
                            bind: [{ to: 'content', source: 'chat.item.name' }, variantFrom(speaker, 'chat.item.color')]
                          }),
                          text({
                            content: 'AI',
                            class: agentMark,
                            visible: { source: 'chat.item.agent', template: "{{ source ? 'true' : 'false' }}" }
                          })
                        ]
                      }),
                      text({ content: '', class: words, bind: { content: 'chat.item.text' } })
                    ]
                  })
                ]
              })
            ]
          })
        ]
      }),
      container({
        class: quick,
        children: REACTIONS.map((emoji, index) =>
          button({
            id: `chat-emoji-${index}`,
            content: emoji,
            title: `Send ${emoji}`,
            class: quickEmoji,
            flows: [[onClick(), ...sayInChat(emoji, `sent_${index}`)]]
          })
        )
      }),
      form({
        id: 'chat-form',
        class: composer,
        managedByInteractions: true,
        noValidate: true,
        flows: [
          [
            named('asked', onSubmit()),
            ...sayInChat('{{ asked.values.text }}', 'said').map(step =>
              when({ field: 'asked.values.text', operator: '!=', value: '' }, step)
            ),
            when({ field: 'said.status', operator: '=', value: 'completed' }, resetForm('chat-form'))
          ]
        ],
        children: [
          formControl({
            id: 'chat-text',
            name: 'text',
            label: '',
            placeholder: 'Message everyone…',
            required: false,
            autoComplete: false,
            class: field,
            slots: { input: fieldBox }
          }),
          button({
            id: 'chat-send',
            subType: 'submit',
            content: '',
            title: 'Send — Enter',
            class: send,
            children: [icon('fa-solid fa-paper-plane')]
          })
        ]
      })
    ]
  });
