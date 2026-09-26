import { setState } from '@plitzi/sdk-authoring';

import { boardAction } from './stylePanel.ts';

import type { Tool } from '../plugins/Board/controller.ts';
import type { StepSpec } from '@plitzi/sdk-authoring';

/**
 * Every element a person can put on a board, in one registry: what it is called, what it looks like in the bar, how
 * it is picked — and the category it belongs to. The toolbar and the elements library are both built from this list,
 * so adding an element, or a category, is adding an entry here and nothing else.
 */

export type CategoryId = 'basics' | GroupId;

/** The categories the bar shows as one button each — every one but the basics. */
export type GroupId = 'shapes' | 'lines' | 'draw' | 'notes' | 'kanban';

export type Category = {
  id: CategoryId;
  label: string;
  /** A group in the bar has a key of its own: its first entry's number. */
  hint: string;
};

/**
 * One thing to pick. `icon` is a Font Awesome class — or, for a shape the free set has no icon for, the character that
 * draws it. `tool` is what it puts in hand; `also`, what else picking it does — a brush chosen, a kanban inserted.
 * `keys` pick it from anywhere on the board.
 */
export type ElementEntry = {
  id: string;
  category: CategoryId;
  tool?: Tool;
  icon: string;
  label: string;
  /** What it is for, in the library: a line to tell two things apart. */
  description: string;
  keys: string;
  hint: string;
  also?: StepSpec[];
};

export const CATEGORIES: readonly Category[] = [
  { id: 'basics', label: 'Basics', hint: '' },
  { id: 'shapes', label: 'Shapes', hint: '2' },
  { id: 'lines', label: 'Lines', hint: '3' },
  { id: 'draw', label: 'Draw', hint: '4' },
  { id: 'notes', label: 'Notes', hint: '6' },
  { id: 'kanban', label: 'Kanban', hint: '7' }
];

export const setTool = (tool: Tool): StepSpec => setState({ key: 'tool', type: 'text', value: tool });

/** The pen keeps the brush it had — unless it was the highlighter, which is its own entry. */
const PEN_BRUSH = setState({
  key: 'brush',
  type: 'text',
  value: "{{ computed.brush == 'highlighter' ? 'pizarra' : computed.brush }}"
});

export const ELEMENTS: readonly ElementEntry[] = [
  // Basics: each its own button in the bar, in this order around the groups.
  {
    id: 'hand',
    category: 'basics',
    tool: 'hand',
    icon: 'fa-regular fa-hand',
    label: 'Hand',
    description: 'Pan the board',
    keys: 'h',
    hint: 'H'
  },
  {
    id: 'select',
    category: 'basics',
    tool: 'select',
    icon: 'fa-solid fa-arrow-pointer',
    label: 'Select',
    description: 'Pick up, move, resize',
    keys: 'v, 1',
    hint: '1'
  },
  {
    id: 'text',
    category: 'basics',
    tool: 'text',
    icon: 'fa-solid fa-font',
    label: 'Text',
    description: 'Words, in the hand-drawn face',
    keys: 't, 5',
    hint: '5'
  },
  {
    id: 'frame',
    category: 'basics',
    tool: 'frame',
    icon: 'fa-regular fa-object-group',
    label: 'Frame',
    description: 'A section that holds what is put in it',
    keys: 'f, 8',
    hint: '8'
  },

  // Shapes.
  {
    id: 'rectangle',
    category: 'shapes',
    tool: 'rectangle',
    icon: 'fa-regular fa-square',
    label: 'Rectangle',
    description: 'A box — a step, a screen',
    keys: 'r, 2',
    hint: 'R'
  },
  {
    id: 'ellipse',
    category: 'shapes',
    tool: 'ellipse',
    icon: 'fa-regular fa-circle',
    label: 'Ellipse',
    description: 'A start, an end, an idea',
    keys: 'o',
    hint: 'O'
  },
  {
    id: 'diamond',
    category: 'shapes',
    tool: 'diamond',
    icon: 'fa-solid fa-diamond',
    label: 'Diamond',
    description: 'A decision',
    keys: 'd',
    hint: 'D'
  },
  {
    id: 'triangle',
    category: 'shapes',
    tool: 'triangle',
    icon: 'fa-solid fa-play fa-rotate-270',
    label: 'Triangle',
    description: 'A warning, a direction',
    keys: '',
    hint: ''
  },
  {
    id: 'hexagon',
    category: 'shapes',
    tool: 'hexagon',
    icon: '⬡',
    label: 'Hexagon',
    description: 'A service, a process',
    keys: '',
    hint: ''
  },
  {
    id: 'cylinder',
    category: 'shapes',
    tool: 'cylinder',
    icon: 'fa-solid fa-database',
    label: 'Cylinder',
    description: 'A database',
    keys: '',
    hint: ''
  },
  {
    id: 'star',
    category: 'shapes',
    tool: 'star',
    icon: 'fa-regular fa-star',
    label: 'Star',
    description: 'What matters most',
    keys: '',
    hint: ''
  },

  // Lines.
  {
    id: 'arrow',
    category: 'lines',
    tool: 'arrow',
    icon: 'fa-solid fa-arrow-right-long',
    label: 'Arrow',
    description: 'Fixed to what it connects',
    keys: 'a, 3',
    hint: 'A'
  },
  {
    id: 'line',
    category: 'lines',
    tool: 'line',
    icon: 'fa-solid fa-minus',
    label: 'Line',
    description: 'A connection without a direction',
    keys: 'l',
    hint: 'L'
  },

  // Drawing.
  {
    id: 'pen',
    category: 'draw',
    tool: 'freehand',
    icon: 'fa-solid fa-pencil',
    label: 'Pen',
    description: 'Draw by hand — eight brushes',
    keys: 'p, 4',
    hint: 'P',
    also: [PEN_BRUSH]
  },
  {
    id: 'highlighter',
    category: 'draw',
    tool: 'freehand',
    icon: 'fa-solid fa-highlighter',
    label: 'Highlighter',
    description: 'Mark what matters, see-through',
    keys: 'shift+h',
    hint: '⇧H',
    also: [setState({ key: 'brush', type: 'text', value: 'highlighter' })]
  },
  {
    id: 'eraser',
    category: 'draw',
    tool: 'eraser',
    icon: 'fa-solid fa-eraser',
    label: 'Eraser',
    description: 'Wipe out whatever it passes over',
    keys: 'e, 0',
    hint: 'E'
  },
  {
    id: 'laser',
    category: 'draw',
    tool: 'laser',
    icon: 'fa-solid fa-wand-magic-sparkles',
    label: 'Laser',
    description: 'Point — everyone sees the trail',
    keys: 'k',
    hint: 'K'
  },

  // Notes.
  {
    id: 'sticky',
    category: 'notes',
    tool: 'sticky',
    icon: 'fa-regular fa-note-sticky',
    label: 'Sticky note',
    description: 'An idea, in a colour',
    keys: 's, 6',
    hint: 'S'
  },
  {
    id: 'card',
    category: 'notes',
    tool: 'card',
    icon: 'fa-regular fa-square-check',
    label: 'Card',
    description: 'A task, with a done box',
    keys: 'c',
    hint: 'C'
  },
  {
    id: 'comment',
    category: 'notes',
    tool: 'comment',
    icon: 'fa-regular fa-comment',
    label: 'Comment',
    description: 'Feedback, pinned, with a thread',
    keys: 'm',
    hint: 'M'
  },

  // Kanban.
  {
    id: 'column',
    category: 'kanban',
    tool: 'column',
    icon: 'fa-solid fa-table-columns',
    label: 'Column',
    description: 'A lane that stacks its cards',
    keys: '7',
    hint: '7'
  },
  {
    id: 'kanban-card',
    category: 'kanban',
    tool: 'card',
    icon: 'fa-regular fa-square-check',
    label: 'Card',
    description: 'A task for a column',
    keys: '',
    hint: ''
  },
  {
    id: 'kanban-board',
    category: 'kanban',
    icon: 'fa-solid fa-table-list',
    label: 'Kanban board',
    description: 'To do · Doing · Done, where you point',
    keys: '',
    hint: '',
    also: [setTool('select'), boardAction('insertKanban')]
  }
];

/** A category the bar shows as one button that opens the rest. */
export const isGroup = (category: Category): category is Category & { id: GroupId } => category.id !== 'basics';

export const entriesOf = (category: CategoryId): ElementEntry[] =>
  ELEMENTS.filter(entry => entry.category === category);

/**
 * What picking an entry does: the group it belongs to remembers it (its button shows it from then on), the tool is put
 * in hand, and anything else the entry does happens.
 */
export const pickSteps = (entry: ElementEntry): StepSpec[] => {
  const category = CATEGORIES.find(candidate => candidate.id === entry.category);

  return [
    ...(category && isGroup(category) ? [setState({ key: `${category.id}Pick`, type: 'text', value: entry.id })] : []),
    ...(entry.tool ? [setTool(entry.tool)] : []),
    ...(entry.also ?? [])
  ];
};
