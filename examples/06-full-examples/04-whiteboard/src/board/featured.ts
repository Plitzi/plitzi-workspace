import { SHOWCASE } from './showcase.ts';
import { card, column, comment, connect, drawing, loop, newId, scribble, section, sticky } from './sketch.ts';

import type { BoardElement, Fill } from './model.ts';
import type { Draft } from './sketch.ts';

/**
 * The boards a visitor finds already drawn: large, busy, and made of nothing a person could not have drawn by hand —
 * so the first thing anyone sees is what a board can hold, and they can walk in and change it.
 *
 * Their ids are fixed: a link to one keeps working across restarts, and seeding twice seeds nothing.
 */

export type Featured = { id: string; title: string; elements: () => BoardElement[] };

/** A part of a board moved sideways as a whole: its arrows follow their boxes on their own. */
const beside = (dx: number, drafts: readonly Draft[]): Draft[] => drafts.map(draft => ({ ...draft, x: draft.x + dx }));

const heading = (x: number, y: number, text: string): Draft => ({ type: 'text', x, y, text, strokeWidth: 4 });

const caption = (x: number, y: number, text: string): Draft => ({ type: 'text', x, y, text, strokeWidth: 1 });

const launchPlan = (): BoardElement[] => {
  const idea = newId();
  const insights = [newId(), newId(), newId(), newId()];
  const [start, beta, feedback, launch, iterate, party] = [newId(), newId(), newId(), newId(), newId(), newId()];
  const lanes: { title: string; fill: Fill; notes: { text: string; fill: Fill; done?: boolean }[] }[] = [
    {
      title: 'Now',
      fill: 'green',
      notes: [
        { text: 'AI agents join a board as collaborators', fill: 'violet' },
        { text: 'Kanban columns that sort their cards', fill: 'green' }
      ]
    },
    {
      title: 'Next',
      fill: 'blue',
      notes: [
        { text: 'Present a board, frame by frame', fill: 'blue' },
        { text: 'Private boards that expire', fill: 'orange' }
      ]
    },
    {
      title: 'Later',
      fill: 'orange',
      notes: [
        { text: 'Export to PDF', fill: 'yellow' },
        { text: 'Boards across regions', fill: 'red' }
      ]
    },
    {
      title: 'Done',
      fill: 'violet',
      notes: [
        { text: 'Hand-drawn look ✏️', fill: 'violet', done: true },
        { text: 'Comment threads', fill: 'blue', done: true },
        { text: 'Live cursors for everyone', fill: 'green', done: true }
      ]
    }
  ];

  return drawing([
    heading(-1500, -1040, 'Launch plan — Pizarra 2.0'),
    scribble(
      [
        [-1500, -975],
        [-1000, -968],
        [-620, -978]
      ],
      'violet',
      3
    ),
    caption(
      -1500,
      -940,
      'Everything here is an ordinary element: move it, change it, draw on it. Your edits are live for everyone.'
    ),

    // Why: the idea at the middle, the research around it, each connected in.
    heading(-1500, -820, 'Why'),
    {
      id: idea,
      type: 'ellipse',
      x: -1240,
      y: -470,
      width: 420,
      height: 200,
      fill: 'yellow',
      text: 'Make whiteboards feel alive'
    },
    { ...sticky(-1540, -760, '“I never know who else is looking”', 'blue'), id: insights[0] },
    { ...sticky(-900, -760, '“Arrows fall off when I move things”', 'red'), id: insights[1] },
    { ...sticky(-1540, -180, '“Sticky notes are the best part”', 'yellow'), id: insights[2] },
    { ...sticky(-900, -180, '“Let me lock a board for the team”', 'green'), id: insights[3] },
    connect(insights[0], 'e', idea, 'n'),
    connect(insights[1], 'w', idea, 'n'),
    connect(insights[2], 'e', idea, 's'),
    connect(insights[3], 'w', idea, 's'),
    loop(-900, -760, 200, 200, 'red', 11),
    caption(-660, -800, 'loudest ask'),

    // What: a roadmap in four kanban columns — drag a card to another and it takes its place there — and a pile.
    heading(-500, -820, 'Roadmap'),
    ...lanes.flatMap((lane, index): Draft[] =>
      column(
        { x: -500 + index * 330, y: -740, width: 300, height: 760, title: lane.title, fill: lane.fill },
        lane.notes.map(entry => card(entry.text, { fill: entry.fill, done: entry.done === true, author: 'Ana' }))
      )
    ),
    comment(-230, -790, 'Should agents move to Now?', 'Leo', [
      ['Ana', 'Yes — they are the launch'],
      ['Sam', 'Moved it ✅']
    ]),
    { type: 'stack', x: -170, y: 80, width: 200, height: 200, fill: 'yellow' },
    caption(60, 150, '← take a note, add your idea'),
    scribble(
      [
        [55, 170],
        [20, 176],
        [-12, 184]
      ],
      'ink',
      5
    ),

    // How and who: the launch as a flow, with the loop back when feedback says so — and the owners under it, kept clear
    // of the roadmap by one offset rather than by every coordinate.
    ...beside(260, [
      // How: the launch as a flow, with the loop back when feedback says so.
      heading(900, -820, 'Launch flow'),
      { id: start, type: 'ellipse', x: 1000, y: -740, width: 220, height: 100, fill: 'green', text: 'Kick-off' },
      { id: beta, type: 'rectangle', x: 980, y: -560, width: 260, height: 110, text: 'Private beta with 20 teams' },
      {
        id: feedback,
        type: 'diamond',
        x: 980,
        y: -370,
        width: 260,
        height: 180,
        fill: 'yellow',
        text: 'Do they love it?'
      },
      { id: launch, type: 'rectangle', x: 1400, y: -335, width: 250, height: 110, fill: 'blue', text: 'Public launch' },
      {
        id: iterate,
        type: 'rectangle',
        x: 560,
        y: -335,
        width: 250,
        height: 110,
        fill: 'red',
        text: 'Iterate on the top 3 asks'
      },
      { id: party, type: 'ellipse', x: 1400, y: -110, width: 250, height: 110, fill: 'violet', text: 'Celebrate 🎉' },
      connect(start, 's', beta, 'n'),
      connect(beta, 's', feedback, 'n'),
      connect(feedback, 'e', launch, 'w'),
      connect(feedback, 'w', iterate, 'e'),
      connect(iterate, 'n', beta, 'w'),
      connect(launch, 's', party, 'n'),
      caption(1260, -365, 'yes'),
      caption(860, -365, 'not yet'),
      loop(1400, -335, 250, 110, 'violet', 19),
      caption(1680, -300, 'the big day'),

      // Who: the people, as sticky notes — the one part of a plan everyone edits.
      heading(900, 80, 'Owners'),
      sticky(900, 160, 'Ana — design & research', 'violet'),
      sticky(1130, 160, 'Leo — realtime & infra', 'blue'),
      sticky(1360, 160, 'Sam — launch & community', 'orange')
    ])
  ]);
};

const architecture = (): BoardElement[] => {
  const [web, mobile, cdn, balancer, gateway, auth, boards, realtime, search, postgres, redis, files] = Array.from(
    { length: 12 },
    newId
  );

  return drawing([
    heading(-1300, -900, 'System architecture'),
    scribble(
      [
        [-1300, -835],
        [-900, -830]
      ],
      'blue',
      9
    ),
    caption(
      -1300,
      -800,
      'How a board travels from a browser to the database and back — every arrow is fixed to its boxes.'
    ),

    // Four sections, left to right, each a frame: move one and its boxes and arrows come along.
    ...section({ x: -1300, y: -700, width: 420, height: 900, title: 'Clients', fill: 'blue' }, [
      { id: web, type: 'rectangle', x: -1220, y: -560, width: 260, height: 110, edges: 'round', text: 'Web app' },
      { id: mobile, type: 'rectangle', x: -1220, y: -320, width: 260, height: 110, edges: 'round', text: 'Mobile app' }
    ]),
    ...section({ x: -760, y: -700, width: 380, height: 900, title: 'Edge', fill: 'green' }, [
      { id: cdn, type: 'rectangle', x: -700, y: -600, width: 260, height: 100, text: 'CDN (assets)' },
      { id: balancer, type: 'diamond', x: -700, y: -400, width: 260, height: 180, text: 'Load balancer' }
    ]),
    ...section({ x: -260, y: -700, width: 780, height: 900, title: 'Services', fill: 'violet' }, [
      {
        id: gateway,
        type: 'hexagon',
        x: -210,
        y: -410,
        width: 260,
        height: 140,
        fill: 'violet',
        fillStyle: 'solid',
        text: 'API gateway'
      },
      { id: auth, type: 'rectangle', x: 200, y: -620, width: 240, height: 100, sloppiness: 'architect', text: 'Auth' },
      {
        id: boards,
        type: 'rectangle',
        x: 200,
        y: -460,
        width: 240,
        height: 100,
        sloppiness: 'architect',
        text: 'Boards'
      },
      {
        id: realtime,
        type: 'rectangle',
        x: 200,
        y: -300,
        width: 240,
        height: 100,
        sloppiness: 'architect',
        text: 'Realtime hub'
      },
      {
        id: search,
        type: 'rectangle',
        x: 200,
        y: -140,
        width: 240,
        height: 100,
        sloppiness: 'architect',
        text: 'Search'
      }
    ]),
    ...section({ x: 640, y: -700, width: 460, height: 900, title: 'Data', fill: 'orange' }, [
      { id: postgres, type: 'cylinder', x: 770, y: -620, width: 200, height: 150, fill: 'blue', text: 'Postgres' },
      { id: redis, type: 'cylinder', x: 770, y: -400, width: 200, height: 150, fill: 'red', text: 'Redis pub/sub' },
      { id: files, type: 'cylinder', x: 770, y: -180, width: 200, height: 150, fill: 'green', text: 'Object storage' }
    ]),

    connect(web, 'e', cdn, 'w'),
    connect(web, 'e', balancer, 'w'),
    connect(mobile, 'e', balancer, 'w'),
    connect(balancer, 'e', gateway, 'w'),
    connect(gateway, 'e', auth, 'w'),
    connect(gateway, 'e', boards, 'w'),
    connect(gateway, 'e', realtime, 'w'),
    connect(gateway, 'e', search, 'w'),
    connect(boards, 'e', postgres, 'w'),
    // The async road: dashed.
    { ...connect(realtime, 'e', redis, 'w'), dash: 'dashed' },
    connect(boards, 'e', files, 'w'),

    loop(200, -300, 240, 100, 'red', 23),
    caption(460, -345, 'new!'),
    comment(452, -250, 'Does the hub scale out?', 'Leo', [['Ana', 'Yes — Redis fans every message to every replica']]),

    // The notes a team leaves on a diagram: questions, decisions, what is left to do.
    sticky(-1300, 280, 'Why Redis? Every replica hears every board — pub/sub across the fleet', 'yellow'),
    sticky(-1060, 280, 'Sessions rotate every 15 minutes; the gateway renews them', 'green'),
    sticky(-820, 280, 'TODO: rate-limit per workspace, not per IP', 'red'),
    sticky(-580, 280, 'Search indexes titles and sticky text only', 'blue'),
    { type: 'stack', x: -300, y: 280, width: 200, height: 200, fill: 'yellow' },
    caption(-60, 350, '← questions? take a note')
  ]);
};

export const FEATURED: readonly Featured[] = [
  ...SHOWCASE,
  { id: 'launchplan', title: 'Launch plan — Pizarra 2.0', elements: launchPlan },
  { id: 'systemmaps', title: 'System architecture', elements: architecture }
];
