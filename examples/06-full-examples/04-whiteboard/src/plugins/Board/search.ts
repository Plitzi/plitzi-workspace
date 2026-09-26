import { boundsOf } from './geometry.ts';
import { isEmptyQuery, matchesQuery, parseQuery, tagsOf } from '../../board/query.ts';
import { isFaceDown } from '../../board/sessions.ts';

import type { Core } from './core.ts';
import type { BoardElement } from '../../board/model.ts';

/**
 * Searching a board as it is drawn: what does not match is dimmed on the canvas, what does can be gone through one at a
 * time, and the tags written on the board are listed for the page to offer. The query is the board's own language
 * (`board/query.ts`), the one an agent's `find_elements` reads too.
 */
export const createSearch = (core: Core) => {
  const { state, scene } = core;

  const frameTitle = (id: string): string | undefined => core.current().get(id)?.text?.trim();

  /** Whether an element is what is searched for — everything is, while nothing is searched for. */
  const faceDown = (element: BoardElement): boolean => isFaceDown(element, state.props.session, state.props.author);

  /** A note face down is nobody's but its author's to find: its words are not out yet. */
  const matches = (element: BoardElement): boolean =>
    !state.search || (!faceDown(element) && matchesQuery(element, state.search.query, frameTitle));

  let found: { key: string; list: BoardElement[]; holding: ReadonlySet<string> } | undefined;

  /**
   * Dimmed while a search is on: an element it does not find — but not a frame that holds something it does, which is
   * where the found thing is and what it belongs to.
   */
  const fades = (element: BoardElement): boolean => {
    if (!state.search || matches(element)) {
      return false;
    }

    results();

    return !(element.type === 'frame' && found?.holding.has(element.id));
  };

  /** What the search finds, in reading order — row by row, left to right — which is the order Enter goes through. */
  const results = (): BoardElement[] => {
    const { search } = state;
    if (!search) {
      return [];
    }

    // What is face down turns over as the session moves on: the same words find more once it has.
    const { session } = state.props;
    const key = `${scene.revision}|${search.text}|${session ? `${session.id}:${session.step}` : ''}`;
    if (found?.key !== key) {
      const list = scene
        .visible()
        .filter(element => !faceDown(element) && matchesQuery(element, search.query, frameTitle))
        .sort((a, b) => Math.round(a.y / 40) - Math.round(b.y / 40) || a.x - b.x);
      found = { key, list, holding: new Set(list.flatMap(element => (element.parent ? [element.parent] : []))) };
    }

    return found.list;
  };

  let reported = '';

  /** How many are found, and which of them is shown: told to the page whenever either changes. */
  const report = (): void => {
    const count = results().length;
    const index = state.search && state.search.at >= 0 ? Math.min(state.search.at, count - 1) + 1 : 0;
    const key = `${state.search?.text ?? ''}|${count}|${index}`;
    if (key !== reported) {
      reported = key;
      core.emit({ type: 'search', query: state.search?.text ?? '', count, index });
    }
  };

  let reportedTags = '';
  let tagsRevision = -1;

  /** The tags written on the board and how often, most used first: what the page offers to search by. */
  const reportTags = (): void => {
    if (scene.revision === tagsRevision) {
      return;
    }

    tagsRevision = scene.revision;
    const counts = new Map<string, number>();
    for (const element of scene.visible()) {
      for (const tag of tagsOf(element)) {
        counts.set(tag, (counts.get(tag) ?? 0) + 1);
      }
    }

    const tags = [...counts]
      .sort(([a, one], [b, other]) => other - one || a.localeCompare(b))
      .slice(0, 30)
      .map(([tag, count]) => ({ tag, count }));
    const key = JSON.stringify(tags);
    if (key !== reportedTags) {
      reportedTags = key;
      core.emit({ type: 'tags', tags });
    }
  };

  /** Search for `text`; nothing, or only spaces, ends the search. */
  const find = (text: string): void => {
    const query = parseQuery(text);
    state.search = isEmptyQuery(query) ? undefined : { text, query, at: -1 };
    core.invalidate();
    report();
  };

  /** The next one found — or the one before — brought into view and selected. */
  const step = (direction: 1 | -1): void => {
    const list = results();
    const { search } = state;
    if (!search || !list.length) {
      return;
    }

    search.at = (search.at + direction + list.length) % list.length;
    const element = list[search.at];
    const box = boundsOf(element);
    const { zoom } = state.camera;
    core.glideTo({
      x: box.x + box.width / 2 - state.size.width / 2 / zoom,
      y: box.y + box.height / 2 - state.size.height / 2 / zoom,
      zoom
    });
    core.setSelection([element.id]);
    report();
  };

  return { matches, fades, results, find, step, report, reportTags };
};

export type Search = ReturnType<typeof createSearch>;
