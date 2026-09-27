import {
  addNotification,
  bindTemplate,
  container,
  declaredTrigger,
  heading,
  link,
  onPageLoad,
  styles,
  text
} from '@plitzi/sdk-authoring';

import { copyClass, copyText, COPY_DECLARATION } from '../copy.ts';
import { page, shell, siteBar } from '../home/chrome.ts';
import { eyebrowIn, sectionBlock, sectionHead, sectionLead } from '../home/section.ts';
import { identity } from '../state.ts';

import type { CollabColour } from '../../board/people.ts';
import type { ElementSpec, PageSpec } from '@plitzi/sdk-authoring';

/**
 * How to bring an AI agent onto a board, for the people who use Pizarra — who have a browser and their own agent, and
 * nothing of this repository. Served by Pizarra itself (`/agents`), linked from the invite panel on every board and
 * from the front page, and written with this Pizarra's own address in every command (`{origin}`, filled in by the
 * browser). Claude first; OpenCode and anything else that speaks MCP after it; and what to do when it does not work.
 */

const GUIDE_PATH = '/agents';

const MCP = '{origin}/mcp';

const intro = styles('guideIntro', {
  css: {
    desktop: { display: 'flex', 'flex-direction': 'column', gap: '14px', 'max-width': '760px' },
    mobile: { gap: '10px' }
  }
});

const title = styles('guideTitle', {
  css: {
    desktop: {
      margin: '0px',
      'font-family': 'var(--hand)',
      'font-size': '52px',
      'font-weight': '700',
      'line-height': '1.02'
    },
    mobile: { 'font-size': '38px' }
  }
});

const steps = styles('guideSteps', { display: 'flex', 'flex-direction': 'column', gap: '14px', 'max-width': '860px' });

const stepCard = styles('guideStep', {
  css: {
    desktop: {
      display: 'grid',
      'grid-template-columns': '36px minmax(0px, 1fr)',
      gap: '16px',
      padding: '20px 22px',
      'border-radius': '18px',
      border: '1px solid var(--edge)',
      'background-color': 'var(--surface)',
      'box-shadow': '0 1px 2px var(--shadow), 0 12px 28px -20px var(--shadow)'
    },
    mobile: { 'grid-template-columns': 'minmax(0px, 1fr)', gap: '10px', padding: '16px' }
  }
});

const stepNumber = styles('guideStepNumber', {
  display: 'inline-flex',
  'align-items': 'center',
  'justify-content': 'center',
  width: '32px',
  height: '32px',
  'border-radius': '10px',
  'font-weight': '700',
  color: 'var(--on-accent)',
  'background-color': 'var(--accent)'
});

const stepBody = styles('guideStepBody', {
  display: 'flex',
  'flex-direction': 'column',
  gap: '10px',
  'min-width': '0px'
});

const stepTitle = styles('guideStepTitle', { margin: '0px', 'font-size': '17px', 'font-weight': '700' });

const words = styles('guideWords', {
  margin: '0px',
  'font-size': '15px',
  'line-height': '1.55',
  color: 'var(--ink)'
});

const quiet = styles('guideQuiet', {
  margin: '0px',
  'font-size': '14px',
  'line-height': '1.55',
  color: 'var(--muted)'
});

const faq = styles('guideFaq', {
  css: {
    desktop: { display: 'grid', 'grid-template-columns': 'repeat(2, minmax(0px, 1fr))', gap: '14px' },
    mobile: { 'grid-template-columns': 'minmax(0px, 1fr)' }
  }
});

const faqCard = styles('guideFaqCard', {
  display: 'flex',
  'flex-direction': 'column',
  gap: '8px',
  padding: '18px 20px',
  'border-radius': '16px',
  border: '1px solid var(--edge)',
  'background-color': 'var(--surface)'
});

const pill = styles('guidePill', {
  css: {
    display: 'inline-flex',
    'align-items': 'center',
    gap: '6px',
    height: '36px',
    padding: '0px 14px',
    'border-radius': '999px',
    border: '1px solid var(--edge)',
    'background-color': 'var(--surface)',
    color: 'var(--ink)',
    'font-size': '13px',
    'font-weight': '600',
    'text-decoration': 'none',
    'white-space': 'nowrap',
    transition: 'border-color 140ms ease, color 140ms ease'
  },
  states: {
    hover: { 'border-color': 'var(--accent)', color: 'var(--accent)' },
    'focus-visible': { outline: '2px solid var(--accent)', 'outline-offset': '2px' }
  }
});

const copied = [
  declaredTrigger(COPY_DECLARATION, 'onCopied'),
  addNotification({ content: 'Copied', appearance: 'success', placement: 'bottom-center', autoDismissTimeout: 2000 })
];

/**
 * A line of the guide. One that names this Pizarra's address (`{origin}`) reads it from where the page is — the
 * address people reach it by, which only the browser knows for certain.
 */
const line = (content: string, cls: typeof words): ElementSpec =>
  content.includes('{origin}')
    ? text({
        content: content.replaceAll('{origin}', ''),
        class: cls,
        bind: [bindTemplate('content', 'navigation.origin', content.replaceAll('{origin}', '{{ source }}'))]
      })
    : text({ content, class: cls });

/** A line to paste somewhere, with this Pizarra's address in it and a button that copies it. */
const command = (id: string, line: string): ElementSpec =>
  copyText({ id: `guide-${id}`, class: copyClass, text: line, label: 'Copy', flows: [copied] });

type Step = { title: string; says: string[]; copy?: { id: string; line: string }; after?: string };

const step = (number: number, { title: named, says, copy, after }: Step): ElementSpec =>
  container({
    class: stepCard,
    children: [
      text({ content: String(number), class: stepNumber }),
      container({
        class: stepBody,
        children: [
          heading({ content: named, subType: 'h3', class: stepTitle }),
          ...says.map(said => line(said, words)),
          ...(copy ? [command(copy.id, copy.line)] : []),
          ...(after ? [line(after, quiet)] : [])
        ]
      })
    ]
  });

const section = (tone: CollabColour, eyebrow: string, named: string, lead: string, body: ElementSpec[]) =>
  container({ class: sectionBlock, children: [sectionHead({ tone, eyebrow, title: named, lead }), ...body] });

const CLAUDE_CODE: Step[] = [
  {
    title: 'Add Pizarra to Claude Code — once',
    says: ['In a terminal, on the computer you run Claude Code on:'],
    copy: { id: 'claude-add', line: `claude mcp add --scope user --transport http pizarra ${MCP}` },
    after:
      '--scope user makes Pizarra available in every folder. Without it, Claude only has it in the folder you ran the command in — and a Claude opened anywhere else says it has no Pizarra tools.'
  },
  {
    title: 'Check that it answers',
    says: ['Still in the terminal:'],
    copy: { id: 'claude-list', line: 'claude mcp list' },
    after: `It should list "pizarra: ${MCP} (HTTP) - ✔ Connected". Inside a Claude session, /mcp shows the same.`
  },
  {
    title: 'Start a new Claude session',
    says: [
      'Run claude. It reads its tools as a session starts: a session that was already open before you added Pizarra does not have it — close it and start another.'
    ],
    copy: { id: 'claude-start', line: 'claude' }
  },
  {
    title: 'Send it the board',
    says: [
      'Adding Pizarra does not put Claude on any board: it joins the one you give it. Copy the board’s link — from ✦ Invite an AI agent on the board, or the address bar — or just its code, beside the board’s name, and say so:'
    ],
    copy: { id: 'claude-join', line: 'Join this Pizarra board and help us: <the board’s link>' },
    after:
      'On the board you see it arrive: "Claude Code" among the avatars, a cursor that glides to what it works on, its lines in the chat marked AI.'
  },
  {
    title: 'A board with a password',
    says: [
      'Copy the message from ✦ Invite an AI agent on the board: on a board with a password its link carries a key that opens it (#key=…), so the agent gets in without the password. Send it only to your agent.',
      'Or give it the password in the same message:'
    ],
    copy: {
      id: 'claude-password',
      line: 'Join this Pizarra board and help us: <the board’s link> password: <the password>'
    },
    after: 'If the password changes, the agent leaves the board — send it the new one.'
  },
  {
    title: 'Work with it',
    says: [
      'Ask it the way you would ask a teammate at the board. It says what it is about to do, then does it — everyone sees the notes, cards and arrows appear.',
      '“Sort these notes into themes, with a title over each.” · “Turn the Ideas frame into a kanban.” · “Stay on the board and answer us in the chat.” · “Run a retro with us.” · “Keep a card in Decisions with what we decided.”'
    ],
    after:
      'To keep it answering while you work, ask it to stay: “stay on the board and answer us in the chat”. It listens, and goes on listening.'
  }
];

const WATCHING: Step[] = [
  {
    title: 'What it is doing',
    says: [
      'Beside its cursor, and around its avatar: working (one of its tools running), thinking (reading what came back and deciding what next — the dots move), listening (waiting for you to say something: a steady green ring), or nothing, when it is idle — on the board, waiting to be asked again in its app.'
    ]
  },
  {
    title: 'How long it stays',
    says: [
      'It stays while you work, however long its app goes without asking it anything. You can talk to it while it works — it hears you between its steps — and ■ on its avatar stops what it is doing. It leaves by itself when you ask it to — in the chat, or with ✕ on its avatar — when nobody else is on the board for two minutes, when nothing happens on the board for the time set in Board settings (30 minutes unless changed), or when the board’s password changes. It says why in the chat.'
    ]
  }
];

const CLAUDE_APP: Step[] = [
  {
    title: 'Add Pizarra as a connector',
    says: [
      'In Claude — the desktop app or claude.ai — open Settings → Connectors → Add custom connector. Name it Pizarra, and give it this address:'
    ],
    copy: { id: 'app-url', line: MCP },
    after:
      'Claude’s app reaches it from the Internet: it works when this Pizarra is on a public https address, not on your own computer (use Claude Code for that).'
  },
  {
    title: 'Turn it on in a chat, and send it the board',
    says: [
      'In a new chat, make sure Pizarra is on in the tools menu under the message box, then send the same line as above: “Join this Pizarra board and help us: <the board’s link>”.'
    ]
  }
];

/**
 * Claude in Chrome drives the page itself, as its person would — a canvas is a picture to it, so it works through the
 * board's List view: the same board as a list, with a button for every change.
 */
const CHROME: Step[] = [
  {
    title: 'Open the board in Chrome, and Claude beside it',
    says: [
      'With the Claude in Chrome extension there is nothing to add: open the board, then Claude from the extension’s icon.'
    ]
  },
  {
    title: 'Point it at the List view',
    says: [
      'Claude sees a canvas as a picture. The List view — the list button in the bottom bar, or Shift+L — is the same board as a list: every frame, column, card and note, with buttons to add, edit, tick off, move and remove them. Start with:'
    ],
    copy: {
      id: 'chrome-prompt',
      line: 'This is a Pizarra whiteboard. Open its List view (the list button in the bottom bar, or Shift+L) and help us: '
    },
    after:
      'It acts as you, on your screen: what it changes is yours, and it works only while you ask. To have an agent of its own on the board — with its own cursor, staying while you work — use Claude Code or the Claude app above.'
  }
];

const OPENCODE: Step[] = [
  {
    title: 'Add Pizarra to OpenCode — once',
    says: ['In a terminal — it is kept for every folder:'],
    copy: { id: 'opencode-add', line: `opencode mcp add pizarra --url ${MCP}` },
    after: 'opencode mcp list should show pizarra as connected.'
  },
  {
    title: 'Start OpenCode and send it the board',
    says: [
      'Run opencode, pick a model that uses tools, and send “Join this Pizarra board and help us: <the board’s link>”. It shows up on the board as OpenCode.'
    ]
  }
];

const TROUBLE: readonly { question: string; answer: string }[] = [
  {
    question: 'Claude says it has no Pizarra tools',
    answer:
      'The session started before Pizarra was added, or it was added without --scope user in another folder. Run claude mcp list where you start Claude, add it again with --scope user if it is missing, and start a new session.'
  },
  {
    question: 'claude mcp list says it failed to connect',
    answer: `Open ${MCP} in a browser: it should say it is Pizarra’s endpoint for AI agents. If it does not, the address is wrong or this Pizarra is not reachable from that computer.`
  },
  {
    question: 'It is connected, but not on the board',
    answer:
      'It joins a board only when you send it the link. Ask it: “Join this Pizarra board: <link>”. It answers with what it found there.'
  },
  {
    question: 'It is on the board, but does not answer',
    answer:
      'It is idle: its app is not asking it anything. Ask it again in its app — “stay on the board and answer us in the chat” keeps it listening. If its app closed or crashed, it leaves the board by itself within a minute.'
  },
  {
    question: 'I see it among the avatars, but not its cursor',
    answer:
      'It is working on another part of the board: its name shows at the edge of your view, with an arrow toward it. Click its avatar to follow it.'
  },
  {
    question: 'It left the board',
    answer:
      'It says why in the chat: asked to, nobody else there, the quiet time in Board settings, or the password changed. When Pizarra restarts its app reconnects by itself. Send it the link again.'
  },
  {
    question: 'It says the board has a password',
    answer:
      'Send it the message from ✦ Invite an AI agent — its link opens the board — or add “password: <the password>” to what you send.'
  },
  {
    question: 'It says the link is to another Pizarra',
    answer:
      'Each Pizarra has its own agent, and joins its own boards. Add that one too — its address is the board’s address with /mcp instead of the path — under another name, and send the link again.'
  },
  {
    question: 'It cannot change anything',
    answer:
      'The board is read-only, or what it was asked to change is locked. It can still read it and talk in the chat; the board’s creator can open it up in Board settings.'
  }
];

/** The way here, from the front page and the invite panel: a pill in their own words. */
export const guideLink = (label = '✦ Invite an AI agent'): ElementSpec =>
  link({ href: GUIDE_PATH, mode: 'internal', label, class: pill, children: [text({ content: label })] });

/** At the foot of a panel: as wide as it, and its words on as many lines as they take — a panel is narrow. */
const panelLink = styles('guidePanelLink', {
  css: {
    display: 'flex',
    'align-items': 'center',
    'justify-content': 'space-between',
    gap: '10px',
    padding: '9px 12px',
    'border-radius': '10px',
    border: '1px solid var(--edge)',
    'background-color': 'var(--surface)',
    color: 'var(--ink)',
    'font-size': '12px',
    'font-weight': '600',
    'line-height': '1.4',
    'text-decoration': 'none',
    transition: 'border-color 140ms ease, color 140ms ease'
  },
  states: {
    hover: { 'border-color': 'var(--accent)', color: 'var(--accent)' },
    'focus-visible': { outline: '2px solid var(--accent)', 'outline-offset': '2px' }
  }
});

/** From a board: the guide in a tab of its own, so nobody leaves the board to read it. */
export const guideLinkFromBoard = (): ElementSpec =>
  link({
    href: GUIDE_PATH,
    mode: 'internal',
    target: 'blank',
    label: 'The guide: setting it up, and what to do when it does not connect — opens in a new tab',
    class: panelLink,
    children: [text({ content: 'Guide: set it up, and what to do if it does not connect' }), text({ content: '↗' })]
  });

export const agentsGuidePage: PageSpec = {
  name: 'Agents',
  slug: 'agents',
  seoTitle: 'Bring an AI agent to your board — Pizarra',
  seoDescription:
    'Invite Claude, OpenCode or any MCP agent onto a Pizarra board: it joins like a person, with a name, a cursor and a place in the chat.',
  class: page,
  flows: [[onPageLoad(), ...identity]],
  body: [
    container({
      class: shell,
      children: [
        siteBar('guide', [guideLink('← All boards')]),
        container({
          class: intro,
          children: [
            text({ content: 'AI agents', class: eyebrowIn('orchid') }),
            heading({ content: 'Bring an AI agent to your board', subType: 'h1', class: title }),
            text({
              content:
                'An agent joins a board the way a person does: its name among the avatars, a cursor you watch move, the notes, cards and arrows it adds, its lines in the chat. It reads what is there, does what you ask, and answers when you talk to it. You bring your own — Claude, OpenCode, anything that speaks MCP — and there is nothing to install on the board’s side.',
              class: sectionLead
            })
          ]
        }),
        section(
          'indigo',
          'Claude Code',
          'With Claude Code',
          'The quickest way, from a terminal. The first three steps are once.',
          [container({ class: steps, children: CLAUDE_CODE.map((entry, index) => step(index + 1, entry)) })]
        ),
        section(
          'lime',
          'While it works',
          'Seeing it work',
          'What the people on the board see of an agent, and when it goes.',
          [container({ class: steps, children: WATCHING.map((entry, index) => step(index + 1, entry)) })]
        ),
        section(
          'orchid',
          'Claude app',
          'In the Claude app',
          'Claude on the desktop or at claude.ai, as a custom connector.',
          [container({ class: steps, children: CLAUDE_APP.map((entry, index) => step(index + 1, entry)) })]
        ),
        section(
          'rose',
          'Claude in Chrome',
          'In Chrome, with Claude beside the board',
          'The browser extension, on the board you have open: nothing to set up.',
          [container({ class: steps, children: CHROME.map((entry, index) => step(index + 1, entry)) })]
        ),
        section('teal', 'OpenCode', 'With OpenCode', 'The same agent, from OpenCode’s terminal app.', [
          container({ class: steps, children: OPENCODE.map((entry, index) => step(index + 1, entry)) })
        ]),
        section(
          'amber',
          'Anything else',
          'Other apps',
          'Cursor, VS Code, Codex and the rest: add a remote MCP server (HTTP, sometimes called streamable HTTP) at this address, then send the link the same way.',
          [command('other-url', MCP)]
        ),
        section('coral', 'When it does not work', 'If it does not show up', 'What goes wrong, and what to do.', [
          container({
            class: faq,
            children: TROUBLE.map(({ question, answer }) =>
              container({
                class: faqCard,
                children: [heading({ content: question, subType: 'h3', class: stepTitle }), line(answer, quiet)]
              })
            )
          })
        ]),
        section(
          'sky',
          'Good to know',
          'What an agent sees and does',
          'It sees the boards you send it, and nothing else; it joins only this Pizarra’s boards. Everything it does is on the board for everyone to see — the same as a person, undone the same way. It never deletes what others made unless you ask.',
          []
        )
      ]
    })
  ]
};
