import { isRecord } from '@plitzi/sdk-shared/helpers';

import type { PageMoment } from './types';

/**
 * A page's moment — what is on screen, its state, its fields — before and after a click or a fill, and what changed.
 */

/** Where the page is, how far each part is scrolled and what shows. Runs in the page, self-contained. */
export const pageMomentInPage = (): PageMoment => {
  const marked = Array.from(document.querySelectorAll('[data-plitzi-el]'));
  const scrolls: Record<string, number> = { page: Math.round(document.scrollingElement?.scrollTop ?? 0) };
  for (const node of marked) {
    if (node.scrollTop > 0) {
      scrolls[node.getAttribute('data-plitzi-el') ?? ''] = Math.round(node.scrollTop);
    }
  }

  const said = Array.from(document.querySelectorAll('[role="alert"], [role="status"]'))
    .filter(node => node.checkVisibility())
    .map(node => node.textContent.trim())
    .filter(Boolean);

  return {
    url: `${location.pathname}${location.search}${location.hash}`,
    said: [...new Set(said)],
    scrolls,
    shown: [
      ...new Set(marked.filter(node => node.checkVisibility()).map(node => node.getAttribute('data-plitzi-el') ?? ''))
    ]
  };
};

/** What a pointer over an element changes in its look, most often — a hover's colours, its lift, its shadow. */
export const LOOK_PROPERTIES: readonly string[] = [
  'color',
  'background-color',
  'background-image',
  'border-color',
  'outline-color',
  'box-shadow',
  'text-decoration-line',
  'opacity',
  'filter',
  'transform',
  'translate',
  'scale',
  'rotate',
  // What a hover grows or draws: a rule widened, a corner tick enlarged, a hairline drawn by its size, a stroke thickened.
  'width',
  'height',
  'max-width',
  'background-size',
  'background-position',
  'stroke',
  'stroke-width',
  'text-shadow'
];

/** How many elements around the one pointed at are read too: a hover the row or the card it sits in carries. */
export const ANCESTORS_READ = 3;

/**
 * How an element, each element inside it and the few around it look, property by property: what a hover changes, held
 * before and after — the pointer over a button is over its row too, and a hover the row carries (`li:hover`) changes
 * the row. Runs in the page, self-contained — so the properties and the reach come with it.
 */
export const looksInPage = ({
  selector,
  properties,
  ancestors = 0
}: {
  selector: string;
  properties: readonly string[];
  ancestors?: number;
}): Looks => {
  const root = document.querySelector(selector);
  if (!root) {
    return {};
  }

  const around: Element[] = [];
  for (let node = root.parentElement?.closest('[data-plitzi-el]'); node && around.length < ancestors;) {
    around.push(node);
    node = node.parentElement?.closest('[data-plitzi-el]');
  }

  const looks: Looks = {};
  for (const node of [...around, root, ...Array.from(root.querySelectorAll('[data-plitzi-el]'))].slice(0, 40)) {
    const style = getComputedStyle(node);
    const parent = node.parentElement?.closest('[data-plitzi-el]');
    // What it draws on ::before/::after, and the custom properties it holds: velada-backlog's medal faded its fill in on
    // a pseudo-element, by a custom property its card's hover set — and the look said the hover changed nothing.
    const drawn = ['before', 'after'].flatMap(pseudo => {
      const pseudoStyle = getComputedStyle(node, `::${pseudo}`);

      return pseudoStyle.content === 'none' || pseudoStyle.content === 'normal'
        ? []
        : properties.map(property => [`${pseudo}:${property}`, pseudoStyle.getPropertyValue(property)] as const);
    });
    const custom = Array.from(style)
      .filter(property => property.startsWith('--'))
      .map(property => [property, style.getPropertyValue(property).trim()] as const);
    looks[node.getAttribute('data-plitzi-el') ?? selector] = {
      ...(parent ? { parent: parent.getAttribute('data-plitzi-el') ?? '' } : {}),
      values: Object.fromEntries([
        ...properties.map(property => [property, style.getPropertyValue(property)] as const),
        ...drawn,
        ...custom
      ])
    };
  }

  return looks;
};

/** How each element looks, by id, with the element it sits in — what it inherits a colour from. */
export type Looks = Record<string, { parent?: string; values: Record<string, string> }>;

/** The properties drawn in the text's colour unless set: a border that follows a hover's colour is that colour. */
const FOLLOWS_COLOR = new Set(['border-color', 'outline-color']);

/**
 * What changed in how the elements look, in words: `title color: rgb(…) → rgb(…)`, one line per property — said where
 * it changed, not again by what follows it: an element that inherits its colour, a border drawn in the text's.
 */
export const lookChanges = (before: Looks, after: Looks): string[] => {
  const valueIn = (looks: Looks, id: string | undefined, property: string): string | undefined =>
    id !== undefined && Object.hasOwn(looks, id) && Object.hasOwn(looks[id].values, property)
      ? looks[id].values[property]
      : undefined;
  const changed = (id: string | undefined, property: string): string | undefined => {
    const from = valueIn(before, id, property);
    const to = valueIn(after, id, property);

    return from === undefined || to === undefined || from === to ? undefined : `${from} → ${to}`;
  };

  return Object.entries(after).flatMap(([id, look]) =>
    Object.keys(look.values).flatMap(property => {
      const change = changed(id, property);
      // A colour, or a custom property, its parent changed the same way: said there, where it changed.
      const inherited =
        (property === 'color' || property.startsWith('--')) &&
        change !== undefined &&
        change === changed(look.parent, property);
      const followed = FOLLOWS_COLOR.has(property) && change !== undefined && change === changed(id, 'color');

      return change === undefined || inherited || followed ? [] : [`${id} ${property}: ${change}`];
    })
  );
};

/** Starts noting each field the browser refuses — `invalid`, fired as a form is submitted. Runs in the page. */
export const listenForRefusedFieldsInPage = (): void => {
  const noted: string[] = [];
  Reflect.set(window, '__plitziRefusedFields', noted);
  document.addEventListener(
    'invalid',
    event => {
      const field = event.target;
      if (
        field instanceof HTMLInputElement ||
        field instanceof HTMLTextAreaElement ||
        field instanceof HTMLSelectElement
      ) {
        const named = field.closest('[data-plitzi-el]')?.getAttribute('data-plitzi-el') ?? field.name;
        noted.push(`${named} — ${field.validationMessage}`);
      }
    },
    true
  );
};

/** The fields the browser refused since the listener started, each with what it said. Runs in the page. */
export const refusedFieldsInPage = (): string[] => {
  const noted: unknown = Reflect.get(window, '__plitziRefusedFields');

  return Array.isArray(noted) ? [...new Set(noted.filter((entry): entry is string => typeof entry === 'string'))] : [];
};

/** Every way two moments of the page differ, in words: where it went, what scrolled, what came and went, the state. */
export const momentChanges = (
  before: PageMoment,
  after: PageMoment,
  state: { before: unknown; after: unknown }
): string[] => {
  const scrolled = [...new Set([...Object.keys(before.scrolls), ...Object.keys(after.scrolls)])].flatMap(id => {
    const from = before.scrolls[id] ?? 0;
    const to = after.scrolls[id] ?? 0;

    return from === to ? [] : [`${id === 'page' ? 'the page' : id} scrolled ${String(from)} → ${String(to)} px`];
  });
  const appeared = after.shown.filter(id => !before.shown.includes(id));
  const gone = before.shown.filter(id => !after.shown.includes(id));
  const listed = (ids: string[]): string =>
    ids.length > 6 ? `${ids.slice(0, 6).join(', ')} and ${String(ids.length - 6)} more` : ids.join(', ');
  const stateBefore = isRecord(state.before) ? state.before : {};
  const stateAfter = isRecord(state.after) ? state.after : {};
  const said = (value: unknown): string => (value === undefined ? 'unset' : JSON.stringify(value));
  const stateChanges = [...new Set([...Object.keys(stateBefore), ...Object.keys(stateAfter)])].flatMap(key =>
    said(stateBefore[key]) === said(stateAfter[key])
      ? []
      : [`state.${key}: ${said(stateBefore[key])} → ${said(stateAfter[key])}`]
  );

  return [
    ...(before.url === after.url ? [] : [`went to ${after.url} (from ${before.url})`]),
    ...scrolled,
    ...(appeared.length > 0 ? [`now shown: ${listed(appeared)}`] : []),
    ...(gone.length > 0 ? [`no longer shown: ${listed(gone)}`] : []),
    ...after.said.filter(words => !before.said.includes(words)).map(words => `said: "${words}"`),
    ...stateChanges
  ];
};
