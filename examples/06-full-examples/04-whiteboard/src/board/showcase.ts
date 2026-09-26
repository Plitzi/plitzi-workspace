import { card, column, comment, connect, drawing, loop, newId, scribble, section, sticky } from './sketch.ts';

import type { BoardElement, Fill, Point } from './model.ts';
import type { Draft } from './sketch.ts';

/**
 * The big boards: what Pizarra holds when a team has lived in it for a while — hundreds of elements, every kind of
 * element, frames and columns, threads, votes, drawings in every brush. They are there to be walked into together,
 * and to show where the board — and Plitzi under it — goes.
 */

const heading = (x: number, y: number, text: string): Draft => ({ type: 'text', x, y, text, strokeWidth: 4 });

const label = (x: number, y: number, text: string): Draft => ({ type: 'text', x, y, text, strokeWidth: 2 });

const caption = (x: number, y: number, text: string): Draft => ({ type: 'text', x, y, text, strokeWidth: 1 });

/** Voters, as the ids a visitor keeps: what dot-voting on a finished board looks like. */
const voters = (count: number): string[] =>
  Array.from({ length: count }, (_, index) => `voter${String(index).padStart(4, '0')}`);

const PEOPLE = ['Ana', 'Leo', 'Mia', 'Sam', 'Noa', 'Kai'];

const by = (index: number): string => PEOPLE[index % PEOPLE.length];

// ── How Pizarra is built on Plitzi ───────────────────────────────────────────────────────────────────────────────────

const underTheHood = (): BoardElement[] => {
  const ids = (count: number): string[] => Array.from({ length: count }, newId);
  const [page, canvas, channel, flows] = ids(4);
  const [ssr, actions, tasks, kv, realtime, hub, middleware, mcp] = ids(8);
  const [balancer, replicaA, replicaB, replicaC] = ids(4);
  const [redisKv, redisPubSub, redisAssets] = ids(3);
  const box = (id: string, x: number, y: number, text: string, extra: Partial<Draft> = {}): Draft => ({
    id,
    type: 'rectangle',
    x,
    y,
    width: 240,
    height: 100,
    edges: 'round',
    sloppiness: 'architect',
    text,
    ...extra
  });

  return drawing([
    heading(-1700, -1180, 'Under the hood — Pizarra on Plitzi'),
    {
      ...scribble(
        [
          [-1700, -1115],
          [-1100, -1108],
          [-620, -1116]
        ],
        'violet',
        31
      ),
      brush: 'marker'
    },
    caption(
      -1700,
      -1080,
      'One space authored in code, one server, two roads for every change — and nothing here a person could not draw.'
    ),

    // The browser.
    ...section({ x: -1700, y: -980, width: 720, height: 820, title: 'In the browser', fill: 'blue' }, [
      box(page, -1640, -900, 'The page — SSR first paint, then React'),
      box(canvas, -1640, -720, 'Board plugin — the canvas (rough.js, perfect-freehand)', {
        fill: 'blue',
        fillStyle: 'solid'
      }),
      box(channel, -1300, -720, 'channel element — presence on room:{id}'),
      box(flows, -1640, -540, 'Flows — onCommit → runServerAction'),
      sticky(-1300, -540, 'Two roads: commits through the server, cursors page to page', 'yellow'),
      comment(-1030, -910, 'Why SSR for a canvas?', 'Kai', [
        ['Ana', 'The board arrives drawn — no spinner, even for late joiners']
      ])
    ]),

    // The server.
    ...section({ x: -880, y: -980, width: 900, height: 820, title: 'On the Plitzi server', fill: 'violet' }, [
      box(ssr, -820, -900, 'SSR render — board-load, a render action'),
      box(actions, -820, -720, 'Server actions — board-apply, board-reply, board-chat…', { fill: 'violet' }),
      box(tasks, -500, -720, 'board.* tasks — validate, merge, keep'),
      { id: kv, type: 'cylinder', x: -200, y: -730, width: 190, height: 140, fill: 'orange', text: 'Action kv' },
      box(realtime, -820, -540, 'realtime.publish — board:{id}, server only'),
      {
        id: hub,
        type: 'hexagon',
        x: -500,
        y: -560,
        width: 240,
        height: 130,
        fill: 'green',
        text: 'Realtime hub /_realtime (WebSocket)'
      },
      box(middleware, -820, -360, 'Middleware — /board-assets, the mark'),
      box(mcp, -500, -360, 'Agent MCP (stdio) — a client like a browser', { fill: 'yellow', fillStyle: 'cross' }),
      comment(-120, -560, 'What stops two commits losing one?', 'Leo', [
        ['Mia', 'A lock in the kv itself — first increment wins'],
        ['Leo', 'Tested: 90 of 90 across three replicas ✅']
      ])
    ]),
    connect(page, 's', canvas, 'n'),
    connect(canvas, 's', flows, 'n'),
    connect(flows, 'e', actions, 'w'),
    connect(actions, 'e', tasks, 'w'),
    connect(tasks, 'e', kv, 'w'),
    connect(actions, 's', realtime, 'n'),
    connect(realtime, 'e', hub, 'w'),
    { ...connect(hub, 'n', channel, 'e'), dash: 'dashed' },
    connect(ssr, 'w', page, 'e'),
    { ...connect(mcp, 'n', hub, 's'), dash: 'dotted' },

    // Replicas.
    ...section({ x: 120, y: -980, width: 820, height: 820, title: 'Several replicas', fill: 'green' }, [
      { id: balancer, type: 'diamond', x: 400, y: -900, width: 240, height: 150, text: 'Round-robin, no affinity' },
      { id: replicaA, type: 'hexagon', x: 170, y: -660, width: 200, height: 110, fill: 'green', text: 'Replica A' },
      { id: replicaB, type: 'hexagon', x: 420, y: -660, width: 200, height: 110, fill: 'green', text: 'Replica B' },
      { id: replicaC, type: 'hexagon', x: 670, y: -660, width: 200, height: 110, fill: 'green', text: 'Replica C' },
      { id: redisKv, type: 'cylinder', x: 180, y: -430, width: 180, height: 140, fill: 'red', text: 'Redis — boards' },
      {
        id: redisPubSub,
        type: 'cylinder',
        x: 430,
        y: -430,
        width: 180,
        height: 140,
        fill: 'red',
        text: 'Redis — pub/sub'
      },
      {
        id: redisAssets,
        type: 'cylinder',
        x: 680,
        y: -430,
        width: 180,
        height: 140,
        fill: 'red',
        text: 'Redis — pictures'
      },
      caption(180, -250, 'REDIS_URL + BOARD_SECRET: every replica agrees on boards, pictures, keys and channels')
    ]),
    connect(balancer, 's', replicaA, 'n'),
    connect(balancer, 's', replicaB, 'n'),
    connect(balancer, 's', replicaC, 'n'),
    ...[replicaA, replicaB, replicaC].flatMap(replica => [
      connect(replica, 's', redisKv, 'n'),
      { ...connect(replica, 's', redisPubSub, 'n'), dash: 'dashed' as const }
    ]),
    connect(replicaC, 's', redisAssets, 'n'),

    // What each side brings, as two columns.
    ...column({ x: -1700, y: -80, width: 380, height: 520, title: 'What Plitzi gives', fill: 'violet' }, [
      card('Authoring a space in code — authorSpace', { fill: 'violet' }),
      card('SSR with server-side data — runtime: server', { fill: 'violet' }),
      card('Server actions with tasks, kv, access rules', { fill: 'violet' }),
      card('Realtime channels — SSE or WebSocket, presence', { fill: 'violet' }),
      card('Plugins — the canvas is one element', { fill: 'violet' }),
      card('Pub/sub adapters — memory or Redis', { fill: 'violet' })
    ]),
    ...column({ x: -1280, y: -80, width: 380, height: 520, title: 'What Pizarra adds', fill: 'blue' }, [
      card('The board model — one file, browser and server', { fill: 'blue' }),
      card('Last write wins per element — version, then nonce', { fill: 'blue' }),
      card('Frames, columns, cards, comments, chat', { fill: 'blue' }),
      card('An MCP server so agents join as people do', { fill: 'blue' }),
      card('Sounds, brushes, minimap, presenting', { fill: 'blue' })
    ]),
    ...section({ x: -860, y: -80, width: 1800, height: 520, title: 'The limits, written down', fill: 'none' }, [
      sticky(-820, 0, '5,000 elements on a board — 500 in one commit', 'yellow'),
      sticky(-600, 0, '40 room messages a second per page — cursors send every 50 ms', 'orange'),
      sticky(-380, 0, '200 boards kept by the demo — the oldest makes room', 'blue'),
      sticky(-160, 0, 'Pictures: 700 KB each, 40 per board', 'green'),
      sticky(60, 0, 'Chat keeps its last 200 lines', 'violet'),
      sticky(280, 0, 'The SSE fallback needs affinity behind a balancer', 'red'),
      sticky(500, 0, 'A locked board’s channels have no name until it is opened', 'yellow'),
      sticky(720, 0, 'Temporary boards are forgotten by the store itself', 'green'),
      loop(280, 0, 200, 200, 'red', 41),
      caption(-820, 240, 'Everything above is enforced on the server — the canvas only shows it.')
    ])
  ]);
};

// ── A sprint, lived in ─────────────────────────────────────────────────────────────────────────────────────────────

const sprint = (): BoardElement[] => {
  const colours: Fill[] = ['blue', 'violet', 'green', 'orange', 'red', 'yellow'];
  const lane = (titles: string[], offset: number, done = false, votes = 0) =>
    titles
      .map((text, index) =>
        card(text, {
          fill: colours[(index + offset) % colours.length],
          author: by(index + offset),
          done
        })
      )
      .map((entry, index) => (votes && index < 3 ? { ...entry, votes: voters(votes - index) } : entry));
  const columns: { title: string; fill: Fill; cards: Draft[] }[] = [
    {
      title: 'Backlog',
      fill: 'none',
      cards: lane(
        [
          'Export a board to PDF',
          'Dark mode for exported images',
          'Keyboard-only drawing',
          'Board history — see who changed what',
          'Import from Miro',
          'Templates gallery for teams',
          'Sticky note tags',
          'Mentions in comments',
          'Offline drafts',
          'Emoji picker in chat',
          'Board analytics — who is active',
          'Custom colours per team'
        ],
        0,
        false,
        6
      )
    },
    {
      title: 'Ready',
      fill: 'yellow',
      cards: lane(['Presenter notes', 'Follow a presenter automatically', 'Lock an element', 'Align and distribute'], 1)
    },
    {
      title: 'In progress',
      fill: 'blue',
      cards: lane(['Agents can move cards between columns', 'Sounds for every action', 'Minimap drag to pan'], 2)
    },
    { title: 'Review', fill: 'violet', cards: lane(['Comment threads', 'Temporary boards'], 3) },
    { title: 'QA', fill: 'orange', cards: lane(['Replicas behind a balancer', 'Brushes on touch screens'], 4) },
    {
      title: 'Done',
      fill: 'green',
      cards: lane(
        [
          'Kanban columns that sort themselves',
          'Frames and presenting',
          'Excalidraw-style properties',
          'Eight brushes',
          'Private boards',
          'Chat that stays with the board',
          'Quick connect',
          'Copy and paste between boards'
        ],
        5,
        true
      )
    }
  ];
  const burndown: Point[] = [
    [0, 0],
    [80, 30],
    [160, 45],
    [240, 110],
    [320, 130],
    [400, 190],
    [480, 230],
    [560, 290]
  ];

  return drawing([
    heading(-1300, -760, 'Sprint 14 — “Together”'),
    caption(-1300, -700, 'Goal: make every board feel like a room full of people — and a few agents.'),
    ...columns.flatMap((entry, index) =>
      column(
        { x: -1300 + index * 340, y: -620, width: 320, height: 900, title: entry.title, fill: entry.fill },
        entry.cards
      )
    ),
    comment(-1000, -600, 'Keep In progress to three', 'Noa', [
      ['Kai', 'Agreed'],
      ['Ana', 'Moving the PDF export back to Backlog']
    ]),
    comment(350, -600, 'Can QA use two replicas locally?', 'Sam', [
      ['Leo', 'Yes — REDIS_URL, BOARD_SECRET, two ports']
    ]),

    // The burndown, drawn by hand in a frame beside the board.
    ...section({ x: 800, y: -620, width: 700, height: 460, title: 'Burndown', fill: 'none' }, [
      // The axes: two straight lines — three points would be drawn as one curve through them.
      {
        type: 'line',
        x: 860,
        y: -540,
        points: [
          [0, 0],
          [0, 320]
        ],
        sloppiness: 'architect'
      },
      {
        type: 'line',
        x: 860,
        y: -220,
        points: [
          [0, 0],
          [600, 0]
        ],
        sloppiness: 'architect'
      },
      {
        ...scribble(
          burndown.map(([x, y]): Point => [870 + x, -520 + y]),
          'red',
          51
        ),
        brush: 'marker'
      },
      {
        type: 'line',
        x: 870,
        y: -520,
        points: [
          [0, 0],
          [580, 300]
        ],
        dash: 'dashed',
        stroke: 'green'
      },
      caption(1300, -520, 'ideal'),
      caption(1200, -400, 'us — ahead by a day')
    ]),
    ...section({ x: 800, y: -120, width: 700, height: 400, title: 'Blockers and risks', fill: 'red' }, [
      sticky(840, -40, 'Design review needs a slot', 'red'),
      sticky(1060, -40, 'Touch pens drop points on old iPads', 'orange'),
      sticky(1280, -40, 'Waiting on the Redis upgrade', 'yellow'),
      {
        ...scribble(
          [
            [1070, 175],
            [1250, 172]
          ],
          'orange',
          61
        ),
        brush: 'highlighter'
      }
    ])
  ]);
};

// ── A customer journey, mapped by the whole team ─────────────────────────────────────────────────────────────────────

const journey = (): BoardElement[] => {
  const stages: {
    title: string;
    doing: string;
    thinking: string;
    pain: string;
    idea: string;
    feel: number;
    emoji: string;
  }[] = [
    {
      title: 'Discover',
      doing: 'Sees a board shared in a call',
      thinking: '“Is this another tool to learn?”',
      pain: 'Too many whiteboard apps',
      idea: 'A board to try before signing up',
      feel: 40,
      emoji: '🤔'
    },
    {
      title: 'First board',
      doing: 'Starts from the kanban template',
      thinking: '“Oh, the columns sort themselves”',
      pain: 'Where are the columns?',
      idea: 'Kanban group in the toolbar',
      feel: 140,
      emoji: '🙂'
    },
    {
      title: 'Invite',
      doing: 'Sends the link to the team',
      thinking: '“Nobody needs an account”',
      pain: 'Worried about who can see it',
      idea: 'Private boards, passwords',
      feel: 170,
      emoji: '😀'
    },
    {
      title: 'Together',
      doing: 'Draws live with five people',
      thinking: '“I can see everyone’s cursor”',
      pain: 'Hard to follow who says what',
      idea: 'Chat and comments with threads',
      feel: 230,
      emoji: '🤩'
    },
    {
      title: 'Agents',
      doing: 'Invites an agent to sort ideas',
      thinking: '“It just joined like a person”',
      pain: 'Unsure what it will change',
      idea: 'It says what it does first',
      feel: 210,
      emoji: '😮'
    },
    {
      title: 'Every week',
      doing: 'Runs the weekly sync on a board',
      thinking: '“This is our room now”',
      pain: 'Old boards pile up',
      idea: 'Temporary boards that go away',
      feel: 250,
      emoji: '❤️'
    }
  ];
  const width = 440;
  const left = -1200;
  const curve: Point[] = stages.map((stage, index) => [left + index * (width + 20) + width / 2, 520 - stage.feel]);

  return drawing([
    heading(left, -700, 'Customer journey — a team finds Pizarra'),
    caption(
      left,
      -640,
      'Six stages, as the team sees them: what they do, what they think, how they feel, where it hurts.'
    ),
    ...section({ x: left - 480, y: -560, width: 440, height: 700, title: 'Persona', fill: 'violet' }, [
      {
        type: 'ellipse',
        x: left - 390,
        y: -480,
        width: 260,
        height: 160,
        fill: 'violet',
        fillStyle: 'solid',
        opacity: 60,
        text: 'Marta, team lead'
      },
      sticky(left - 460, -290, 'Runs a team of 8, half remote', 'violet'),
      sticky(left - 250, -290, 'Lives in calls and chat', 'blue'),
      {
        ...card('Goal: one place where the team thinks together', { fill: 'violet' }),
        x: left - 460,
        y: -60,
        width: 400
      }
    ]),
    ...stages.flatMap((stage, index) => {
      const x = left + index * (width + 20);

      return section(
        { x, y: -560, width, height: 700, title: `${index + 1}. ${stage.title}`, fill: index % 2 ? 'none' : 'blue' },
        [
          { type: 'hexagon', x: x + 20, y: -480, width: 400, height: 90, sloppiness: 'architect', text: stage.doing },
          sticky(x + 20, -370, stage.thinking, 'blue'),
          sticky(x + 220, -370, stage.pain, 'red'),
          { ...card(stage.idea, { fill: 'green', author: by(index) }), x: x + 20, y: -150, width: 400 }
        ]
      );
    }),
    // How they feel, stage to stage: a line drawn in marker across the whole journey.
    label(left - 400, 330, 'How they feel'),
    { ...scribble(curve, 'violet', 71), brush: 'marker' },
    ...stages.map((stage, index): Draft => ({
      type: 'text',
      x: curve[index][0] - 18,
      y: curve[index][1] - 60,
      text: stage.emoji,
      strokeWidth: 4
    })),
    {
      type: 'line',
      x: left,
      y: 520,
      points: [
        [0, 0],
        [stages.length * (width + 20), 0]
      ],
      dash: 'dotted'
    },
    comment(left + 2 * (width + 20) + 300, -600, 'Private boards need a clearer switch', 'Mia', [
      ['Sam', 'Share → Who can find it'],
      ['Mia', 'Found it — resolving']
    ]),
    loop(left + 3 * (width + 20) + 20, -480, 400, 90, 'orange', 81),
    caption(left + 3 * (width + 20) + 20, -520, 'the moment it clicks')
  ]);
};

// ── A workshop: a hundred ideas, clustered and voted ─────────────────────────────────────────────────────────────────

const workshop = (): BoardElement[] => {
  const themes: { title: string; fill: Fill; ideas: string[] }[] = [
    {
      title: 'Onboarding',
      fill: 'yellow',
      ideas: [
        'A tour on the first board',
        'Templates by job',
        'Sample board with a demo team',
        'Invite with a QR code',
        'Tips at the cursor',
        'A checklist for day one',
        'Short videos on hover',
        'Import a Miro board',
        'Pick a name and colour',
        'Guided first frame',
        'Keyboard cheat sheet',
        'Suggest a template from the title'
      ]
    },
    {
      title: 'Collaboration',
      fill: 'blue',
      ideas: [
        'Mentions in comments',
        'Voice notes on a card',
        'Follow the presenter',
        'Raise a hand',
        'Private sticky notes',
        'Timer for each agenda item',
        'Reactions on cards',
        'Who is looking where',
        'Pass the laser',
        'Anonymous voting',
        'Breakout frames',
        'A room per frame'
      ]
    },
    {
      title: 'Agents',
      fill: 'violet',
      ideas: [
        'Summarise the board',
        'Cluster the notes',
        'Turn notes into cards',
        'Draft a retro',
        'Answer comments',
        'Explain a diagram',
        'Build a kanban from a doc',
        'Find duplicates',
        'Translate the board',
        'Suggest next steps',
        'Tidy the layout',
        'Write the meeting notes'
      ]
    },
    {
      title: 'Drawing',
      fill: 'green',
      ideas: [
        'Shape libraries',
        'Snap to grid',
        'Align and distribute',
        'Rotate shapes',
        'Curved connectors',
        'Tables',
        'Mind map mode',
        'Brushes on tablets',
        'Stamps',
        'Icons',
        'Swimlanes',
        'Sequence diagrams'
      ]
    },
    {
      title: 'Trust',
      fill: 'orange',
      ideas: [
        'Board history',
        'Undo someone else’s change',
        'Roles on a board',
        'Expiring links',
        'Audit log',
        'Export everything',
        'Backups',
        'Read-only links',
        'Password per frame',
        'Private comments',
        'Data residency',
        'Self-host guide'
      ]
    }
  ];
  const centre = newId();
  const frameWidth = 700;
  const cols = 3;

  return drawing([
    heading(-1800, -1300, 'Ideas workshop — 60 ideas, 5 themes, one vote each'),
    caption(
      -1800,
      -1240,
      'Everyone added notes for 10 minutes, then dot-voted. The top ideas moved to “Next” on the right.'
    ),
    {
      id: centre,
      type: 'ellipse',
      x: -330,
      y: -1250,
      width: 500,
      height: 170,
      fill: 'violet',
      fillStyle: 'solid',
      opacity: 80,
      text: 'What would make Pizarra the tool we open first?'
    },
    ...themes.flatMap((theme, index) => {
      const x = -1800 + (index % 3) * (frameWidth + 40);
      const y = -1000 + Math.floor(index / 3) * 1060;
      const tag = newId();

      return [
        ...section({ x, y, width: frameWidth, height: 1000, title: theme.title, fill: theme.fill }, [
          {
            id: tag,
            type: 'rectangle',
            x: x + 30,
            y: y + 70,
            width: 200,
            height: 60,
            edges: 'round',
            fill: theme.fill,
            fillStyle: 'solid',
            text: theme.title
          },
          ...theme.ideas.map((idea, ideaIndex): Draft => ({
            ...sticky(
              x + 30 + (ideaIndex % cols) * 220,
              y + 160 + Math.floor(ideaIndex / cols) * 210,
              idea,
              theme.fill
            ),
            author: by(ideaIndex + index),
            ...(ideaIndex % 4 === 1 ? { votes: voters(1 + ((ideaIndex + index) % 5)) } : {})
          }))
        ]),
        connect(centre, 's', tag, 'n')
      ];
    }),
    ...column({ x: 520, y: 60, width: 460, height: 1000, title: 'Next — the top voted', fill: 'green' }, [
      card('Summarise the board — agents', { fill: 'violet', author: 'Ana' }),
      card('Board history — trust', { fill: 'orange', author: 'Leo' }),
      card('Align and distribute — drawing', { fill: 'green', author: 'Mia' }),
      card('Mentions in comments — collaboration', { fill: 'blue', author: 'Sam' }),
      card('A tour on the first board — onboarding', { fill: 'yellow', author: 'Noa' })
    ]),
    { type: 'stack', x: 1040, y: 80, width: 222, height: 252, fill: 'yellow' },
    caption(1040, 350, '← one more idea? take a note'),
    comment(980, 40, 'Agents got the most votes by far', 'Kai', [
      ['Ana', 'Let’s start with the summary'],
      ['Leo', 'Card made in Next 👍']
    ]),
    {
      ...scribble(
        [
          [-1780, -40],
          [-1100, -44]
        ],
        'orange',
        91
      ),
      brush: 'highlighter'
    },
    {
      ...scribble(
        [
          [540, 1100],
          [700, 1060],
          [860, 1110],
          [960, 1070]
        ],
        'violet',
        93
      ),
      brush: 'brush'
    }
  ]);
};

// ── A mural: how far one board goes ─────────────────────────────────────────────────────────────────────────────────

/** Letters on a five-by-seven grid, row by row: what the mural spells, in pieces anybody could have put down. */
const FONT: Record<string, readonly string[]> = {
  P: ['11110', '10001', '10001', '11110', '10000', '10000', '10000'],
  I: ['11111', '00100', '00100', '00100', '00100', '00100', '11111'],
  Z: ['11111', '00001', '00010', '00100', '01000', '10000', '11111'],
  A: ['01110', '10001', '10001', '11111', '10001', '10001', '10001'],
  R: ['11110', '10001', '10001', '11110', '10100', '10010', '10001']
};

const mural = (): BoardElement[] => {
  const word = 'PIZARRA';
  const colours: Fill[] = ['violet', 'blue', 'green', 'yellow', 'orange', 'red', 'violet'];
  const piece = 26;
  const pixel = piece * 3 + 6;
  const letter = pixel * 6;
  const left = -((word.length * letter) / 2);
  const top = -520;
  const pieces: Draft[] = [...word].flatMap((character, index) =>
    FONT[character].flatMap((row, rowIndex) =>
      [...row].flatMap((on, columnIndex) =>
        on === '1'
          ? Array.from({ length: 9 }, (_, sub): Draft => ({
              type: 'rectangle',
              x: left + index * letter + columnIndex * pixel + (sub % 3) * (piece + 2),
              y: top + rowIndex * pixel + Math.floor(sub / 3) * (piece + 2),
              width: piece,
              height: piece,
              fill: colours[index],
              fillStyle: 'solid',
              stroke: 'ink',
              strokeWidth: 1,
              edges: 'round',
              sloppiness: 'architect',
              ...(sub === 4 ? {} : { opacity: sub % 2 ? 80 : 60 })
            }))
          : []
      )
    )
  );
  const count = pieces.length;

  return drawing([
    heading(left, top - 260, `A mural — ${count} pieces, put down by 30 people`),
    caption(
      left,
      top - 200,
      'Every square is an ordinary element anyone can move. One board holds up to 5,000; this one is a quarter of that.'
    ),
    ...section(
      {
        x: left - 60,
        y: top - 120,
        width: word.length * letter + 60,
        height: pixel * 7 + 200,
        title: 'The wall',
        fill: 'none'
      },
      pieces
    ),
    ...section(
      {
        x: left - 60,
        y: top + pixel * 7 + 140,
        width: word.length * letter + 60,
        height: 520,
        title: 'What it takes',
        fill: 'violet'
      },
      [
        sticky(left, top + pixel * 7 + 220, `${count} elements, drawn and hit-tested every frame`, 'violet'),
        sticky(left + 240, top + pixel * 7 + 220, 'Each drawn once, then reused while it moves', 'blue'),
        sticky(left + 480, top + pixel * 7 + 220, 'The minimap draws all of it, small', 'green'),
        sticky(left + 720, top + pixel * 7 + 220, 'The front page previews the frames and the last 140', 'yellow'),
        sticky(
          left + 960,
          top + pixel * 7 + 220,
          'A commit carries up to 500 — paste half of the wall at once',
          'orange'
        ),
        sticky(left + 1200, top + pixel * 7 + 220, 'One JSON value in the kv, merged element by element', 'red'),
        {
          ...card('Try it: select a letter with a drag, and move it — everyone sees it move', { fill: 'violet' }),
          x: left,
          y: top + pixel * 7 + 450,
          width: 520
        },
        comment(left + 1480, top + pixel * 7 + 200, 'How long did this take?', 'Mia', [
          ['Kai', 'Ten minutes, thirty people, one timer'],
          ['Ana', 'And an agent filling in the corners ✦']
        ])
      ]
    )
  ]);
};

export const SHOWCASE = [
  { id: 'underhood1', title: 'Under the hood — Pizarra on Plitzi', elements: underTheHood },
  { id: 'sprint1400', title: 'Sprint 14 — “Together”', elements: sprint },
  { id: 'journey001', title: 'Customer journey — a team finds Pizarra', elements: journey },
  { id: 'workshop01', title: 'Ideas workshop — 60 ideas, 5 themes', elements: workshop },
  { id: 'muralboard', title: 'A mural — how far one board goes', elements: mural }
];
