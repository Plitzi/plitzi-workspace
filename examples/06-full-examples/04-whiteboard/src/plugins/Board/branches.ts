import { cloneElements } from './clone.ts';
import { releasedFrom } from './connectors.ts';
import { membersOf } from './containers.ts';
import { isConnector } from '../../board/model.ts';

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
