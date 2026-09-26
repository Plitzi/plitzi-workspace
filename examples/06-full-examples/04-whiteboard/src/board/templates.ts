import { connect, drawing, newId, sticky } from './sketch.ts';

import type { BoardElement, Fill } from './model.ts';
import type { Draft } from './sketch.ts';

/**
 * What a new board can start as. Written as a drawing someone could have made — shapes, stickies, connectors fixed to
 * their anchors — so a template is nothing a board could not hold on its own, and everyone edits it the same way.
 */

export const TEMPLATES = ['blank', 'brainstorm', 'retro', 'flowchart', 'kanban'] as const;

export type Template = (typeof TEMPLATES)[number];

export const isTemplate = (value: unknown): value is Template => TEMPLATES.some(template => template === value);

const brainstorm = (): BoardElement[] => {
  const question = newId();

  return drawing([
    {
      id: question,
      type: 'ellipse',
      x: -170,
      y: -80,
      width: 340,
      height: 160,
      fill: 'violet',
      text: 'What should we build next?'
    },
    sticky(-560, -380, 'Every idea is welcome — one per note', 'yellow'),
    sticky(-110, -420, 'Drag fresh notes off the pile ↓', 'green'),
    sticky(360, -380, 'Vote with 👍 on the ones you love', 'blue'),
    sticky(-560, 200, 'Wild idea', 'red'),
    sticky(360, 200, 'Quick win', 'orange'),
    { type: 'stack', x: -100, y: 220, width: 200, height: 200, fill: 'yellow' }
  ]);
};

const retro = (): BoardElement[] => {
  const columns: { title: string; fill: Fill; note: string }[] = [
    { title: 'Went well', fill: 'green', note: 'We shipped on time' },
    { title: 'To improve', fill: 'orange', note: 'Too many meetings' },
    { title: 'Actions', fill: 'blue', note: 'Try async stand-ups' }
  ];

  return drawing([
    { type: 'text', x: -480, y: -470, text: 'Sprint retro' },
    ...columns.flatMap((column, index): Draft[] => {
      const x = -480 + index * 340;

      return [
        { type: 'rectangle', x, y: -380, width: 300, height: 640, text: '' },
        { type: 'text', x: x + 20, y: -360, text: column.title },
        sticky(x + 50, -280, column.note, column.fill),
        { type: 'stack', x: x + 50, y: 20, width: 200, height: 200, fill: column.fill }
      ];
    })
  ]);
};

const flowchart = (): BoardElement[] => {
  const [start, step, decision, yes, no] = [newId(), newId(), newId(), newId(), newId()];

  return drawing([
    { id: start, type: 'ellipse', x: -110, y: -420, width: 220, height: 100, fill: 'green', text: 'Start' },
    { id: step, type: 'rectangle', x: -130, y: -220, width: 260, height: 110, text: 'Do the thing' },
    { id: decision, type: 'diamond', x: -130, y: -10, width: 260, height: 170, fill: 'yellow', text: 'Did it work?' },
    { id: yes, type: 'rectangle', x: 260, y: 20, width: 220, height: 110, fill: 'blue', text: 'Ship it' },
    { id: no, type: 'rectangle', x: -480, y: 20, width: 220, height: 110, fill: 'red', text: 'Try again' },
    connect(start, 's', step, 'n'),
    connect(step, 's', decision, 'n'),
    connect(decision, 'e', yes, 'w'),
    connect(decision, 'w', no, 'e'),
    connect(no, 'n', step, 'w')
  ]);
};

const kanban = (): BoardElement[] => {
  const columns: { title: string; notes: { text: string; fill: Fill }[] }[] = [
    { title: 'To do', notes: [{ text: 'Sketch the landing page', fill: 'yellow' }] },
    { title: 'Doing', notes: [{ text: 'Invite the team', fill: 'orange' }] },
    { title: 'Done', notes: [{ text: 'Start a board', fill: 'green' }] }
  ];

  return drawing([
    ...columns.flatMap((column, index): Draft[] => {
      const x = -520 + index * 360;

      return [
        { type: 'rectangle', x, y: -400, width: 320, height: 760, text: '' },
        { type: 'text', x: x + 20, y: -380, text: column.title },
        ...column.notes.map((note, row) => sticky(x + 60, -300 + row * 230, note.text, note.fill)),
        ...(index === 0
          ? [{ type: 'stack', x: x + 60, y: 120, width: 200, height: 200, fill: 'yellow' } satisfies Draft]
          : [])
      ];
    })
  ]);
};

const BUILD: Record<Template, () => BoardElement[]> = {
  blank: () => [],
  brainstorm,
  retro,
  flowchart,
  kanban
};

/** A template's elements, with ids of their own: two boards from one template share nothing. */
export const templateElements = (template: Template): BoardElement[] => BUILD[template]();

export const TEMPLATE_TITLES: Record<Template, string> = {
  blank: 'Untitled board',
  brainstorm: 'Brainstorm',
  retro: 'Sprint retro',
  flowchart: 'Flowchart',
  kanban: 'Kanban'
};
