import { cloneElements } from './clone.ts';
import { releasedFrom } from './connectors.ts';
import { membersOf } from './containers.ts';
import { byStacking, isConnector } from '../../board/model.ts';

import type { BoardElement } from '../../board/model.ts';

/**
 * Branches of a board: a frame copied beside itself, with everything in it, to try another way — by a person, or by an
 * agent asked for three — and the one that wins taken back into the original's place. What a branch is, is its frame's
 * `branchOf`: the frame it was copied from. Read by the canvas and by an agent, so both branch and merge alike.
 */

/** Between a frame and the branch put beside it, and between two branches. */
const BRANCH_GAP = 80;

/** A frame, what is in it, and the connectors that run between what is in it — what a branch copies. */
export const frameContents = (elements: readonly BoardElement[], frame: BoardElement): BoardElement[] => {
  const members = membersOf(elements, frame.id);
  const inside = new Set([frame.id, ...members.map(member => member.id)]);
  const connectors = elements.filter(
    element =>
      isConnector(element.type) &&
      !element.deleted &&
      element.start !== undefined &&
      element.end !== undefined &&
      inside.has(element.start.id) &&
      inside.has(element.end.id)
  );

  return [frame, ...members, ...connectors];
};

/**
 * What a selection holds, as a template keeps it: what is chosen, what its frames hold, and the lines that run between
 * any of it — in the order they are drawn. A card chosen without its column brings the column: a card lives in one.
 */
export const selectionContents = (
  elements: readonly BoardElement[],
  chosen: readonly BoardElement[]
): BoardElement[] => {
  const frames = new Set(
    chosen.flatMap(element =>
      element.type === 'frame' ? [element.id] : element.type === 'card' && element.parent ? [element.parent] : []
    )
  );
  const ids = new Set([
    ...chosen.map(element => element.id),
    ...frames,
    ...[...frames].flatMap(frame => membersOf(elements, frame).map(member => member.id))
  ]);
  const between = (element: BoardElement): boolean =>
    isConnector(element.type) &&
    element.start !== undefined &&
    element.end !== undefined &&
    ids.has(element.start.id) &&
    ids.has(element.end.id);

  return elements.filter(element => !element.deleted && (ids.has(element.id) || between(element))).sort(byStacking);
};

/** What a selection would be called as a template: its frames' titles — or, without any, its first words. */
export const selectionTitle = (contents: readonly BoardElement[]): string => {
  const titles = contents
    .filter(element => element.type === 'frame' && element.text?.trim())
    .map(element => element.text?.trim() ?? '');
  if (titles.length) {
    return titles.slice(0, 3).join(' · ');
  }

  return (
    contents
      .find(element => element.text?.trim())
      ?.text?.trim()
      .split('\n')[0] ?? ''
  );
};

/**
 * A branch of `frame`: a copy of it and all it holds, to the right of it and of any branch it already has — the frame
 * first in what is answered, titled `title` (the original's own, marked, by default).
 */
export const branchFrame = (
  elements: readonly BoardElement[],
  frame: BoardElement,
  topZ: number,
  title?: string
): BoardElement[] => {
  const family = elements.filter(
    element => !element.deleted && (element.id === frame.id || element.branchOf === frame.id)
  );
  const right = Math.max(...family.map(element => element.x + element.width));
  const [copy, ...rest] = cloneElements(frameContents(elements, frame), {
    dx: right + BRANCH_GAP - frame.x,
    dy: 0,
    topZ,
    keepFrame: false
  });
  const { duty: _duty, ...plain } = copy;

  return [
    { ...plain, branchOf: frame.id, text: title?.trim() || `${frame.text?.trim() || 'Frame'} — alternative` },
    ...rest
  ];
};

/**
 * The branch that won, taken back: what the original held is removed — the connectors fixed to it from outside let go
 * — and what the branch holds moves into its place, the original taking the branch's size and layout, keeping its
 * title and its duty. The branch's frame goes. A branch whose original is gone just stops being one.
 */
export const mergeBranch = (elements: readonly BoardElement[], branch: BoardElement): BoardElement[] => {
  const original = branch.branchOf
    ? elements.find(element => element.id === branch.branchOf && !element.deleted)
    : undefined;
  const { branchOf: _branchOf, ...standalone } = branch;
  if (!original) {
    return [standalone];
  }

  const [, ...old] = frameContents(elements, original);
  const [, ...taken] = frameContents(elements, branch);
  const removed = new Set(old.map(element => element.id));
  const [dx, dy] = [original.x - branch.x, original.y - branch.y];
  const { layout: _layout, ...originalRest } = original;

  return [
    ...old.map(element => ({ ...element, deleted: true })),
    ...releasedFrom(
      elements.filter(element => !taken.includes(element)),
      removed
    ),
    ...taken.map(element => ({
      ...element,
      x: element.x + dx,
      y: element.y + dy,
      ...(element.parent === branch.id ? { parent: original.id } : {})
    })),
    {
      ...originalRest,
      width: branch.width,
      height: branch.height,
      ...(branch.layout ? { layout: branch.layout } : {})
    },
    { ...branch, deleted: true }
  ];
};
