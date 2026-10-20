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
