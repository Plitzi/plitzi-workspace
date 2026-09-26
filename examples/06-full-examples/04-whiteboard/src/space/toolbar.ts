import {
  button,
  container,
  onClick,
  onKey,
  setState,
  styles,
  text,
  toggleState,
  variantFrom
} from '@plitzi/sdk-authoring';

import { CATEGORIES, ELEMENTS, entriesOf, isGroup, pickSteps } from './elements.ts';
import { FLOAT, ICON_BUTTON, icon } from './kit.ts';
import { closeOthers, closePanels } from './panels.ts';

import type { Category, ElementEntry, GroupId } from './elements.ts';
import type { ElementSpec, StepSpec } from '@plitzi/sdk-authoring';

/**
 * The tools, as the person reaches them: a bar down the left edge, built from the registry (`elements.ts`) — the basics
 * each on a button of their own, every other category one button that shows the last thing picked from it and opens
 * the rest — and, at its foot, the whole library (`library.ts`).
 *
 * The tool in hand is the page's state (`state.tool`), not the canvas's. The bar lights the button for it, the
 * canvas draws with it, and says when it moves on by itself — back to select after a shape — through `onToolChange`,
 * which writes the same key.
 */

/** The bar, top to bottom: basic elements by id, groups by category, `|` for a divider, `library` for the library. */
const BAR = [
  'hand',
  '|',
  'select',
  'shapes',
  'lines',
  'draw',
  'text',
  'notes',
  'kanban',
  'frame',
  '|',
  'library'
] as const;

/** Everything a key picks, for the keyboard's help. */
export const KEYED: readonly ElementEntry[] = ELEMENTS.filter(entry => entry.keys);

/** A key per entry — heard on the whole page, and ignored while somebody types in a field. */
export const toolKeys: StepSpec[][] = KEYED.map(entry => [onKey(entry.keys), ...pickSteps(entry)]);

const list = (values: readonly string[]): string => `[${values.map(value => `'${value}'`).join(', ')}]`;

// ── The bar ──────────────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * Down the left edge, centred, as Miro keeps it: the top of the board is left to its name, the people on it and what
 * they say; what the tool in hand is styled with opens beside it. Along the bottom on a phone — where a thumb is.
 */
const bar = styles('toolbar', {
  css: {
    desktop: {
      ...FLOAT,
      position: 'absolute',
      top: '50%',
      left: '14px',
      transform: 'translateY(-50%)',
      'z-index': '3',
      display: 'flex',
      'flex-direction': 'column',
      'align-items': 'center',
      gap: '2px',
      padding: '5px'
    },
    mobile: {
      top: 'auto',
      left: '50%',
      bottom: '14px',
      transform: 'translateX(-50%)',
      'flex-direction': 'row',
      gap: '0px',
      padding: '4px',
      'max-width': 'calc(100vw - 24px)',
      'overflow-x': 'auto',
      'scrollbar-width': 'none'
    }
  }
});

const toolButton = styles('toolButton', {
  css: { desktop: ICON_BUTTON, mobile: { width: '34px', height: '34px', 'font-size': '14px' } },
  states: {
    hover: { 'background-color': 'var(--surface-2)' },
    'focus-visible': { outline: '2px solid var(--accent)', 'outline-offset': '1px' }
  },
  variants: { active: { 'background-color': 'var(--accent-soft)', color: 'var(--accent)' } }
});

const keyHint = styles('keyHint', {
  css: {
    desktop: {
      position: 'absolute',
      right: '3px',
      bottom: '1px',
      'font-size': '9px',
      'font-weight': '600',
      color: 'var(--muted)',
      'pointer-events': 'none'
    },
    mobile: { display: 'none' }
  }
});

/** The corner mark on a group's button that says it opens more. */
const moreMark = styles('moreMark', {
  css: {
    desktop: {
      position: 'absolute',
      right: '2px',
      top: '1px',
      'font-size': '8px',
      color: 'var(--muted)',
      'pointer-events': 'none'
    },
    mobile: { display: 'none' }
  }
});

const glyph = styles('toolGlyph', { 'font-size': '19px', 'line-height': '1', 'pointer-events': 'none' });

export const markOf = (entry: ElementEntry): ElementSpec =>
  entry.icon.startsWith('fa-') ? icon(entry.icon) : text({ content: entry.icon, class: glyph });

/** One of a group button's marks: only the picked item's shows. */
const pickMark = styles('pickMark', { display: 'contents' });

const barDivider = styles('toolbarDivider', {
  css: {
    desktop: {
      width: '22px',
      height: '1px',
      margin: '4px 0px',
      'background-color': 'var(--edge)',
      'flex-shrink': '0'
    },
    mobile: { width: '1px', height: '22px', margin: '0px 4px' }
  }
});

const soloButton = (entry: ElementEntry): ElementSpec =>
  button({
    id: `tool-${entry.id}`,
    content: '',
    title: `${entry.label} — ${entry.description} · ${entry.hint}`,
    class: toolButton,
    bind: entry.tool
      ? [variantFrom(toolButton, 'computed.tool', { template: `{{ source == '${entry.tool}' ? 'active' : '' }}` })]
      : [],
    flows: [[onClick(), ...closePanels, ...pickSteps(entry)]],
    children: [markOf(entry), text({ content: entry.hint, class: keyHint })]
  });

/** The tools a group puts in hand — what lights its button: those no other group owns (a card is the notes'). */
const toolsOf = (category: Category): string[] =>
  entriesOf(category.id).flatMap(entry =>
    entry.tool &&
    !ELEMENTS.some(
      other =>
        other.tool === entry.tool && other.category !== category.id && ELEMENTS.indexOf(other) < ELEMENTS.indexOf(entry)
    )
      ? [entry.tool]
      : []
  );

/** A group's button: the last thing picked from it, lit while it is in hand — a click opens the group. */
const groupButton = (category: Category & { id: GroupId }): ElementSpec =>
  button({
    id: `tool-${category.id}`,
    content: '',
    title: `${category.label} — ${category.hint}`,
    class: toolButton,
    bind: [
      variantFrom(toolButton, 'computed.tool', {
        template: `{{ source in ${list(toolsOf(category))} ? 'active' : '' }}`
      })
    ],
    // Only the choice: the tool changes — and its style panel opens — once something is picked.
    flows: [[onClick(), ...closeOthers(`${category.id}Open`), toggleState({ key: `${category.id}Open` })]],
    children: [
      ...entriesOf(category.id).map((entry, index) =>
        container({
          class: pickMark,
          visible: {
            source: `computed.${category.id}Pick`,
            template:
              index === 0
                ? `{{ source == '${entry.id}' or not source ? 'true' : 'false' }}`
                : `{{ source == '${entry.id}' ? 'true' : 'false' }}`
          },
          children: [markOf(entry)]
        })
      ),
      text({ content: '▸', class: moreMark }),
      text({ content: category.hint, class: keyHint })
    ]
  });

/** The whole library, at the foot of the bar. */
const libraryButton = (): ElementSpec =>
  button({
    id: 'tool-library',
    content: '',
    title: 'All elements — I',
    class: toolButton,
    bind: [variantFrom(toolButton, 'computed.libraryOpen', { template: "{{ source ? 'active' : '' }}" })],
    flows: [[onClick(), ...closeOthers('libraryOpen'), toggleState({ key: 'libraryOpen' })]],
    children: [icon('fa-solid fa-plus'), text({ content: 'I', class: keyHint })]
  });

const barItem = (id: (typeof BAR)[number]): ElementSpec => {
  if (id === '|') {
    return text({ content: '', class: barDivider });
  }

  if (id === 'library') {
    return libraryButton();
  }

  const category = CATEGORIES.find(candidate => candidate.id === id);
  if (category && isGroup(category)) {
    return groupButton(category);
  }

  const entry = ELEMENTS.find(candidate => candidate.id === id);
  if (!entry) {
    throw new Error(`The toolbar names "${id}", which is neither an element nor a category`);
  }

  return soloButton(entry);
};

export const toolbar = (): ElementSpec => container({ id: 'toolbar', class: bar, children: BAR.map(barItem) });

// ── The groups, opened ──────────────────────────────────────────────────────────────────────────────────────────────

/**
 * Where each group's button is, down the bar: its padding, then a button and a gap each — and the divider after the
 * hand. What a group opens stands level with its button.
 */
const BUTTON = 36;

const GAP = 2;

const PADDING = 5;

const DIVIDER = 9;

const topOf = (id: string): number =>
  BAR.slice(
    0,
    BAR.findIndex(entry => entry === id)
  ).reduce((top, entry) => top + (entry === '|' ? DIVIDER : BUTTON) + GAP, PADDING);

const BAR_HEIGHT = topOf(BAR[BAR.length - 1]) + BUTTON + PADDING;

const flyoutClass = (category: Category) =>
  styles(`flyout-${category.id}`, {
    css: {
      desktop: {
        ...FLOAT,
        position: 'absolute',
        top: `calc(50% - ${Math.round(BAR_HEIGHT / 2 - topOf(category.id) + PADDING)}px)`,
        left: '72px',
        'z-index': '6',
        display: 'flex',
        'flex-wrap': 'wrap',
        gap: '2px',
        padding: '5px',
        'max-width': '200px'
      },
      mobile: { top: 'auto', left: '50%', bottom: '66px', transform: 'translateX(-50%)', 'max-width': 'none' }
    }
  });

const flyoutItem = styles('flyoutItem', {
  css: ICON_BUTTON,
  states: {
    hover: { 'background-color': 'var(--surface-2)' },
    'focus-visible': { outline: '2px solid var(--accent)', 'outline-offset': '1px' }
  },
  variants: { active: { 'background-color': 'var(--accent-soft)', color: 'var(--accent)' } }
});

const flyout = (category: Category & { id: GroupId }): ElementSpec =>
  container({
    id: `${category.id}-menu`,
    class: flyoutClass(category),
    visible: `computed.${category.id}Open`,
    children: entriesOf(category.id).map(entry =>
      button({
        id: `${category.id}-${entry.id}`,
        content: '',
        title: `${entry.label} — ${entry.description}${entry.hint ? ` · ${entry.hint}` : ''}`,
        class: flyoutItem,
        bind: [
          variantFrom(flyoutItem, `computed.${category.id}Pick`, {
            template: `{{ source == '${entry.id}' ? 'active' : '' }}`
          })
        ],
        flows: [
          [onClick(), ...pickSteps(entry), setState({ key: `${category.id}Open`, type: 'boolean', value: false })]
        ],
        children: [markOf(entry)]
      })
    )
  });

/** What each group opens, beside its button. */
export const toolFlyouts = (): ElementSpec[] => CATEGORIES.filter(isGroup).map(flyout);
