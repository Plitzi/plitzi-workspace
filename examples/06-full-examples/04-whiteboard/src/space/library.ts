import {
  button,
  container,
  formControl,
  named,
  on,
  onClick,
  setState,
  styles,
  text,
  variantFrom
} from '@plitzi/sdk-authoring';

import { CATEGORIES, ELEMENTS, entriesOf, pickSteps } from './elements.ts';
import { BUTTON_RESET, FLOAT, caption, icon } from './kit.ts';
import { closePanels } from './panels.ts';
import { markOf } from './toolbar.ts';

import type { Category, ElementEntry } from './elements.ts';
import type { ElementSpec, StepSpec } from '@plitzi/sdk-authoring';

/**
 * Every element there is, in one place: what the bar holds a button or a group for, and what it has no room for. Built
 * from the registry (`elements.ts`), a section per category, a tile per entry — its mark, its name, what it is for and
 * its key — so a new element or category shows up here by being added there. Searched as it is typed.
 */

/** What an entry is found by: its name, what it is for, its category and its keys — lowercase, quoted for twig. */
const haystackOf = (entry: ElementEntry, category: Category): string =>
  `'${[entry.label, entry.description, category.label, entry.keys]
    .join(' ')
    .toLowerCase()
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")}'`;

const QUERY = '(source|trim|lower)';

const matches = (entry: ElementEntry): string => {
  const category = CATEGORIES.find(candidate => candidate.id === entry.category);

  return category ? `${QUERY} in ${haystackOf(entry, category)}` : 'false';
};

/** In a binding over `computed.librarySearch`: whether any of these entries is what is being searched for. */
const anyMatches = (entries: readonly ElementEntry[]): string => entries.map(matches).join(' or ');

const shownWhen = (entries: readonly ElementEntry[]) => ({
  source: 'computed.librarySearch',
  template: `{{ not ${QUERY} or ${anyMatches(entries)} }}`
});

/**
 * Favourites: the entries this person starred, kept across visits (`state.favorites`, a list of entry ids) and shown
 * first, above every category — the few things they reach for, one click away however long the library grows.
 */
const starred = (entry: ElementEntry): string => `'${entry.id}' in computed.favorites`;

/** A favourite's tile, in the section at the top: starred, and — while searching — what is searched for. */
const favoriteShown = (entry: ElementEntry) => ({
  source: 'computed.librarySearch',
  template: `{{ ${starred(entry)} and (not ${QUERY} or ${matches(entry)}) }}`
});

const favoritesShown = {
  source: 'computed.librarySearch',
  template: `{{ ${ELEMENTS.map(entry => `(${starred(entry)} and (not ${QUERY} or ${matches(entry)}))`).join(' or ')} }}`
};

const toggleFavorite = (entry: ElementEntry): StepSpec =>
  setState({
    key: 'favorites',
    type: 'json',
    value: `{{ ${starred(entry)} ? computed.favorites|filter(id => id != '${entry.id}') : computed.favorites|merge(['${entry.id}']) }}`
  });

const panel = styles('libraryPanel', {
  css: {
    desktop: {
      ...FLOAT,
      position: 'absolute',
      top: '50%',
      left: '72px',
      transform: 'translateY(-50%)',
      'z-index': '6',
      display: 'flex',
      'flex-direction': 'column',
      gap: '12px',
      width: '420px',
      'max-height': 'min(560px, calc(100dvh - 140px))',
      padding: '14px'
    },
    mobile: {
      top: 'auto',
      left: '12px',
      right: '12px',
      bottom: '66px',
      transform: 'none',
      width: 'auto',
      'max-height': 'calc(100dvh - 180px)'
    }
  }
});

const head = styles('libraryHead', { display: 'flex', 'flex-direction': 'column', gap: '10px' });

const title = styles('libraryTitle', { 'font-size': '14px', 'font-weight': '600' });

const searchBox = styles('librarySearchBox', {
  css: {
    display: 'flex',
    'align-items': 'center',
    height: '36px',
    padding: '0px 12px',
    border: '1px solid var(--edge)',
    'border-radius': '9px',
    'background-color': 'var(--surface-2)'
  },
  states: { 'focus-within': { 'border-color': 'var(--accent)', 'background-color': 'var(--surface)' } }
});

const searchField = styles('librarySearchField', { width: '100%' });

const body = styles('libraryBody', {
  display: 'flex',
  'flex-direction': 'column',
  gap: '14px',
  'min-height': '0px',
  'overflow-y': 'auto',
  'margin-right': '-6px',
  'padding-right': '6px'
});

const section = styles('librarySection', { display: 'flex', 'flex-direction': 'column', gap: '6px' });

const grid = styles('libraryGrid', {
  display: 'grid',
  'grid-template-columns': 'repeat(2, minmax(0px, 1fr))',
  gap: '6px'
});

const tile = styles('libraryTile', {
  css: {
    display: 'grid',
    'grid-template-columns': '30px minmax(0px, 1fr)',
    'column-gap': '10px',
    'align-items': 'center',
    flex: '1',
    'min-height': '52px',
    padding: '8px 28px 8px 10px',
    border: '1px solid var(--edge)',
    'border-radius': '10px',
    'background-color': 'var(--surface)',
    color: 'var(--ink)',
    'text-align': 'left',
    cursor: 'pointer',
    transition: 'border-color 140ms ease, background-color 140ms ease'
  },
  states: {
    hover: { 'border-color': 'var(--accent)', 'background-color': 'var(--accent-soft)' },
    'focus-visible': { outline: '2px solid var(--accent)', 'outline-offset': '1px' }
  }
});

const tileMark = styles('libraryMark', {
  display: 'inline-flex',
  'align-items': 'center',
  'justify-content': 'center',
  width: '30px',
  height: '30px',
  'border-radius': '8px',
  'font-size': '15px',
  'background-color': 'var(--surface-2)',
  'pointer-events': 'none'
});

const tileText = styles('libraryText', {
  display: 'flex',
  'flex-direction': 'column',
  gap: '2px',
  'min-width': '0px',
  'pointer-events': 'none'
});

const tileName = styles('libraryName', {
  display: 'flex',
  'align-items': 'center',
  gap: '6px',
  'min-width': '0px',
  'white-space': 'nowrap',
  'font-size': '13px',
  'font-weight': '600'
});

const tileLabel = styles('libraryLabel', { overflow: 'hidden', 'text-overflow': 'ellipsis' });

const tileKey = styles('libraryKey', {
  'flex-shrink': '0',
  'font-size': '10px',
  'font-weight': '600',
  padding: '1px 5px',
  'border-radius': '4px',
  color: 'var(--muted)',
  'background-color': 'var(--surface-2)'
});

/** Two lines at most: enough to tell a rectangle from a diamond, never a tile taller than its neighbours. */
const tileLine = styles('libraryLine', {
  display: '-webkit-box',
  '-webkit-line-clamp': '2',
  '-webkit-box-orient': 'vertical',
  'font-size': '11px',
  'line-height': '1.35',
  color: 'var(--muted)',
  overflow: 'hidden'
});

/** Holds a tile and its star: the star sits in the tile's corner, over it. */
const tileWrap = styles('libraryTileWrap', { position: 'relative', display: 'flex', 'flex-direction': 'column' });

const star = styles('libraryStar', {
  css: {
    ...BUTTON_RESET,
    position: 'absolute',
    top: '4px',
    right: '4px',
    display: 'inline-flex',
    'align-items': 'center',
    'justify-content': 'center',
    width: '22px',
    height: '22px',
    'border-radius': '6px',
    'font-size': '11px',
    color: 'var(--muted)',
    opacity: '0.55'
  },
  states: {
    hover: { opacity: '1', color: '#e0a100', 'background-color': 'var(--surface-2)' },
    'focus-visible': { outline: '2px solid var(--accent)', opacity: '1' }
  },
  variants: { on: { opacity: '1', color: '#e0a100' } }
});

const starMark = styles('libraryStarMark', { display: 'contents' });

const hintRow = styles('libraryHint', {
  display: 'flex',
  'align-items': 'center',
  gap: '8px',
  padding: '8px 10px',
  'border-radius': '9px',
  'font-size': '12px',
  color: 'var(--muted)',
  border: '1px dashed var(--edge)'
});

const empty = styles('libraryEmpty', { 'font-size': '13px', color: 'var(--muted)', padding: '8px 2px' });

const starButton = (entry: ElementEntry, id: string): ElementSpec =>
  button({
    id,
    content: '',
    title: `${entry.label}: favourite — shown first`,
    class: star,
    bind: [variantFrom(star, 'computed.favorites', { template: `{{ '${entry.id}' in source ? 'on' : '' }}` })],
    flows: [[onClick(), toggleFavorite(entry)]],
    children: [
      container({
        class: starMark,
        visible: { source: 'computed.favorites', template: `{{ '${entry.id}' in source }}` },
        children: [icon('fa-solid fa-star')]
      }),
      container({
        class: starMark,
        visible: { source: 'computed.favorites', template: `{{ '${entry.id}' not in source }}` },
        children: [icon('fa-regular fa-star')]
      })
    ]
  });

const pickTile = (entry: ElementEntry, id: string): ElementSpec =>
  button({
    id,
    content: '',
    title: `${entry.label} — ${entry.description}`,
    class: tile,
    flows: [[onClick(), ...closePanels, ...pickSteps(entry)]],
    children: [
      container({ class: tileMark, children: [markOf(entry)] }),
      container({
        class: tileText,
        children: [
          container({
            class: tileName,
            children: [
              text({ content: entry.label, class: tileLabel }),
              ...(entry.hint ? [text({ content: entry.hint, class: tileKey })] : [])
            ]
          }),
          text({ content: entry.description, class: tileLine })
        ]
      })
    ]
  });

/**
 * An entry's tile: picking it puts the element in hand and gets out of the way — the search stays for the next time —
 * and the star beside it, a sibling rather than inside (a button holds no button), makes it a favourite or not.
 */
const tileFor = (entry: ElementEntry, where: 'favorites' | 'category'): ElementSpec => {
  const id = where === 'favorites' ? `library-fav-${entry.id}` : `library-${entry.id}`;

  return container({
    class: tileWrap,
    visible: where === 'favorites' ? favoriteShown(entry) : shownWhen([entry]),
    children: [pickTile(entry, id), starButton(entry, `${id}-star`)]
  });
};

/** Before anything is starred: how to, where the favourites will be. */
const favoritesHint = (): ElementSpec =>
  container({
    class: hintRow,
    visible: {
      source: 'computed.favorites',
      template: '{{ source|length == 0 and not (computed.librarySearch|trim) }}'
    },
    children: [icon('fa-regular fa-star'), text({ content: 'Star what you use most — it shows up here, first.' })]
  });

const favoritesSection = (): ElementSpec =>
  container({
    id: 'library-favorites',
    class: section,
    visible: favoritesShown,
    children: [
      text({ content: 'Favourites', class: caption }),
      container({ class: grid, children: ELEMENTS.map(entry => tileFor(entry, 'favorites')) })
    ]
  });

const sectionFor = (category: Category): ElementSpec => {
  const entries = entriesOf(category.id);

  return container({
    id: `library-${category.id}`,
    class: section,
    visible: shownWhen(entries),
    children: [
      text({ content: category.label, class: caption }),
      container({ class: grid, children: entries.map(entry => tileFor(entry, 'category')) })
    ]
  });
};

export const libraryPanel = (): ElementSpec =>
  container({
    id: 'library',
    class: panel,
    visible: 'computed.libraryOpen',
    children: [
      container({
        class: head,
        children: [
          text({ content: 'All elements', class: title }),
          formControl({
            id: 'library-search',
            name: 'librarySearch',
            label: '',
            placeholder: 'Search — sticky, arrow, database…',
            required: false,
            autoComplete: false,
            class: searchField,
            slots: { input: searchBox },
            flows: [
              [
                named('typed', on('onChange')),
                setState({ key: 'librarySearch', type: 'text', value: '{{ typed.value }}' })
              ]
            ]
          })
        ]
      }),
      container({
        class: body,
        children: [
          favoritesHint(),
          favoritesSection(),
          ...CATEGORIES.map(sectionFor),
          container({
            class: empty,
            visible: {
              source: 'computed.librarySearch',
              template: `{{ ${QUERY} and not (${anyMatches(ELEMENTS)}) }}`
            },
            children: [text({ content: 'Nothing by that name — try a shape, a note or a line.' })]
          })
        ]
      })
    ]
  });
