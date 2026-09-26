import { card, column, comment, connect, drawing, newId, scribble, section, sticky } from './sketch.ts';

import type { BoardElement, Fill } from './model.ts';
import type { Draft } from './sketch.ts';

/**
 * What a new board can start as. Written as a drawing someone could have made — frames, columns, cards, notes,
 * connectors fixed to their anchors, comments — so a template is nothing a board could not hold on its own, and
 * everyone edits it the same way.
 */

export const TEMPLATES = [
  'blank',
  'kanban',
  'brainstorm',
  'retro',
  'flowchart',
  'mindmap',
  'roadmap',
  'meeting'
] as const;

export type Template = (typeof TEMPLATES)[number];

export const isTemplate = (value: unknown): value is Template => TEMPLATES.some(template => template === value);

const title = (x: number, y: number, text: string): Draft => ({ type: 'text', x, y, text, strokeWidth: 4 });

const note = (x: number, y: number, text: string): Draft => ({ type: 'text', x, y, text, strokeWidth: 1 });

/** A real kanban: column frames that stack their cards — drag one to another column and it takes its place there. */
const kanban = (): BoardElement[] =>
  drawing([
    title(-640, -420, 'Team board'),
    note(-640, -360, 'Drag cards between columns · tick the box when it is done · C for a new card'),
    ...column({ x: -640, y: -300, title: 'Backlog' }, [
      card('Research how teams plan today', { fill: 'violet' }),
      card('Interview five customers'),
      card('Sketch the onboarding', { fill: 'blue' })
    ]),
    ...column({ x: -320, y: -300, title: 'To do', fill: 'yellow' }, [
      card('Write the launch post', { fill: 'orange' }),
      card('Record a 60-second demo')
    ]),
    ...column({ x: 0, y: -300, title: 'Doing', fill: 'blue' }, [card('Pricing page', { fill: 'green' })]),
    ...column({ x: 320, y: -300, title: 'Done', fill: 'green' }, [
      card('Start a board', { done: true }),
      card('Invite the team', { done: true })
    ]),
    comment(270, -250, 'Keep Doing to three cards at most?', 'Ana', [['Leo', 'Agreed — WIP limit of 3']])
  ]);

const brainstorm = (): BoardElement[] => {
  const question = newId();
  const ideas = [newId(), newId(), newId(), newId()];

  return drawing([
    {
      id: question,
      type: 'ellipse',
      x: -170,
      y: -80,
      width: 340,
      height: 160,
      fill: 'violet',
      fillStyle: 'cross',
      text: 'What should we build next?'
    },
    { ...sticky(-560, -380, 'Every idea is welcome — one per note', 'yellow'), id: ideas[0] },
    { ...sticky(-110, -420, 'Drag fresh notes off the pile ↓', 'green'), id: ideas[1] },
    { ...sticky(360, -380, 'Vote with 👍 on the ones you love', 'blue'), id: ideas[2] },
    { ...sticky(-560, 200, 'Wild idea', 'red'), id: ideas[3] },
    connect(ideas[0], 'e', question, 'w'),
    connect(ideas[2], 'w', question, 'e'),
    { type: 'stack', x: -100, y: 220, width: 222, height: 252, fill: 'yellow' },
    ...section({ x: 380, y: 160, width: 460, height: 320, title: 'Parking lot' }, [
      sticky(410, 230, 'Good, but not now', 'orange')
    ]),
    // A highlighter across the question: what the session is about.
    {
      ...scribble(
        [
          [-150, 60],
          [150, 64]
        ],
        'orange',
        4
      ),
      brush: 'highlighter'
    },
    comment(180, -110, 'Time-box this to 15 minutes?', 'Sam', [['Mia', 'Starting the timer ⏱']])
  ]);
};

const retro = (): BoardElement[] => {
  const columns: { title: string; fill: Fill; notes: string[] }[] = [
    { title: 'Went well', fill: 'green', notes: ['We shipped on time', 'Pairing on the hard parts'] },
    { title: 'To improve', fill: 'orange', notes: ['Too many meetings'] },
    { title: 'Actions', fill: 'blue', notes: [] }
  ];

  return drawing([
    title(-520, -470, 'Sprint retro'),
    note(-520, -410, 'Add notes from the piles · then turn "Actions" into cards'),
    ...columns.flatMap((entry, index): Draft[] => {
      const x = -520 + index * 360;

      return [
        ...column(
          { x, y: -350, width: 320, height: 620, title: entry.title, fill: entry.fill },
          index === 2
            ? [card('Try async stand-ups', { fill: 'blue' }), card('Demo every Friday')]
            : entry.notes.map(text => sticky(0, 0, text, entry.fill))
        ),
        { type: 'stack', x: x + 49, y: 300, width: 222, height: 252, fill: entry.fill }
      ];
    })
  ]);
};

/** A flowchart with a flowchart's shapes: a start, steps, a decision, a database — and an error path, dashed. */
const flowchart = (): BoardElement[] => {
  const [start, step, decision, save, database, retry, done] = Array.from({ length: 7 }, newId);

  return drawing([
    { id: start, type: 'ellipse', x: -110, y: -480, width: 220, height: 100, fill: 'green', text: 'Start' },
    {
      id: step,
      type: 'rectangle',
      x: -130,
      y: -300,
      width: 260,
      height: 110,
      edges: 'round',
      text: 'Fill in the form'
    },
    {
      id: decision,
      type: 'diamond',
      x: -130,
      y: -110,
      width: 260,
      height: 170,
      fill: 'yellow',
      text: 'Is it valid?'
    },
    { id: save, type: 'hexagon', x: -120, y: 140, width: 240, height: 120, fill: 'blue', text: 'Save it' },
    { id: database, type: 'cylinder', x: 300, y: 130, width: 190, height: 140, fill: 'violet', text: 'Database' },
    {
      id: retry,
      type: 'rectangle',
      x: -520,
      y: -80,
      width: 220,
      height: 110,
      fill: 'red',
      edges: 'round',
      text: 'Show what is wrong'
    },
    { id: done, type: 'ellipse', x: -110, y: 350, width: 220, height: 100, fill: 'green', text: 'Done' },
    connect(start, 's', step, 'n'),
    connect(step, 's', decision, 'n'),
    connect(decision, 's', save, 'n'),
    connect(save, 'e', database, 'w'),
    connect(save, 's', done, 'n'),
    { ...connect(decision, 'w', retry, 'e'), dash: 'dashed' },
    { ...connect(retry, 'n', step, 'w'), dash: 'dashed' },
    note(-300, -130, 'no'),
    note(20, 80, 'yes')
  ]);
};

/** A mind map: an idea in the middle, branches out of it — click a shape's point to grow another one. */
const mindmap = (): BoardElement[] => {
  const centre = newId();
  const branches: { text: string; fill: Fill; x: number; y: number; leaves: string[] }[] = [
    { text: 'Customers', fill: 'blue', x: -620, y: -300, leaves: ['Teams of 5–50', 'Remote first'] },
    { text: 'Product', fill: 'green', x: 380, y: -300, leaves: ['Live boards', 'Agents that help'] },
    { text: 'Channels', fill: 'orange', x: -620, y: 220, leaves: ['Word of mouth'] },
    { text: 'Risks', fill: 'red', x: 380, y: 220, leaves: ['Too many features?'] }
  ];

  return drawing([
    {
      id: centre,
      type: 'ellipse',
      x: -170,
      y: -80,
      width: 340,
      height: 160,
      fill: 'violet',
      text: 'Our next product'
    },
    ...branches.flatMap((branch): Draft[] => {
      const id = newId();
      const left = branch.x < 0;

      return [
        {
          id,
          type: 'rectangle',
          x: branch.x,
          y: branch.y,
          width: 220,
          height: 90,
          fill: branch.fill,
          edges: 'round',
          text: branch.text
        },
        connect(centre, left ? 'w' : 'e', id, left ? 'e' : 'w'),
        ...branch.leaves.flatMap((leaf, index): Draft[] => {
          const leafId = newId();

          return [
            {
              id: leafId,
              type: 'rectangle',
              x: branch.x + (left ? -260 : 260),
              y: branch.y - 60 + index * 120,
              width: 200,
              height: 80,
              edges: 'round',
              sloppiness: 'architect',
              text: leaf
            },
            connect(id, left ? 'w' : 'e', leafId, left ? 'e' : 'w')
          ];
        })
      ];
    }),
    note(-170, 110, 'Click a shape’s point: a new one, connected')
  ]);
};

/** A roadmap: a section per quarter, the work in it as cards — and the milestones between them. */
const roadmap = (): BoardElement[] => {
  const quarters: { title: string; fill: Fill; items: { text: string; fill: Fill; done?: boolean }[] }[] = [
    {
      title: 'Q1 — Foundations',
      fill: 'green',
      items: [
        { text: 'Realtime boards', fill: 'green', done: true },
        { text: 'Templates', fill: 'blue', done: true }
      ]
    },
    {
      title: 'Q2 — Together',
      fill: 'blue',
      items: [
        { text: 'Comments and threads', fill: 'violet' },
        { text: 'Chat on every board', fill: 'blue' }
      ]
    },
    {
      title: 'Q3 — Smarter',
      fill: 'violet',
      items: [
        { text: 'AI agents as collaborators', fill: 'orange' },
        { text: 'Presentations', fill: 'yellow' }
      ]
    },
    { title: 'Q4 — Scale', fill: 'orange', items: [{ text: 'Replicas across regions', fill: 'red' }] }
  ];

  return drawing([
    title(-760, -420, 'Product roadmap'),
    note(-760, -360, 'Present it: open Frames (bottom left) → Present — everyone follows'),
    ...quarters.flatMap((quarter, index) =>
      column({ x: -760 + index * 390, y: -300, width: 360, height: 420, title: quarter.title, fill: quarter.fill }, [
        ...quarter.items.map(item => card(item.text, { fill: item.fill, done: item.done === true }))
      ])
    ),
    {
      ...scribble(
        [
          [-760, 180],
          [-200, 176],
          [400, 184],
          [800, 178]
        ],
        'ink',
        6
      ),
      brush: 'marker'
    },
    note(-560, 200, '▲ Beta'),
    note(160, 200, '▲ Launch'),
    note(620, 200, '▲ 2.0')
  ]);
};

/** A meeting: the agenda as a checklist, notes as they come, and the actions that leave the room with a name. */
const meeting = (): BoardElement[] =>
  drawing([
    title(-560, -420, 'Weekly sync'),
    note(-560, -360, 'Start the timer for each item · tick it off · actions get an owner'),
    ...column({ x: -560, y: -300, width: 320, height: 420, title: 'Agenda' }, [
      card('Wins of the week', { done: true }),
      card('Metrics review — 10 min'),
      card('Hiring update — 5 min'),
      card('Open questions')
    ]),
    ...section({ x: -200, y: -300, width: 460, height: 420, title: 'Notes', fill: 'yellow' }, [
      sticky(-170, -230, 'Sign-ups up 18% this week', 'yellow'),
      sticky(50, -230, 'Churn flat — watch it', 'orange')
    ]),
    ...column({ x: 300, y: -300, width: 320, height: 420, title: 'Actions', fill: 'blue' }, [
      card('Ana — share the metrics deck', { fill: 'violet' }),
      card('Leo — two interviews by Friday', { fill: 'green' })
    ])
  ]);

const BUILD: Record<Template, () => BoardElement[]> = {
  blank: () => [],
  kanban,
  brainstorm,
  retro,
  flowchart,
  mindmap,
  roadmap,
  meeting
};

/** A template's elements, with ids of their own: two boards from one template share nothing. */
export const templateElements = (template: Template): BoardElement[] => BUILD[template]();

export const TEMPLATE_TITLES: Record<Template, string> = {
  blank: 'Untitled board',
  kanban: 'Team board',
  brainstorm: 'Brainstorm',
  retro: 'Sprint retro',
  flowchart: 'Flowchart',
  mindmap: 'Mind map',
  roadmap: 'Product roadmap',
  meeting: 'Weekly sync'
};
