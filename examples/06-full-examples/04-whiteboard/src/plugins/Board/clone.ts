import { byStacking } from '../../board/model.ts';
import { newId } from './values.ts';

import type { Binding, BoardElement } from '../../board/model.ts';

/**
 * Copies of elements, as a duplicate or a paste makes them: new ids, moved by `dx`/`dy`, on top of everything — in
 * the order they were given.
 *
 * What the copies name among themselves is renamed with them — a connector copied with what it connects connects the
 * copies, a group copied is a group of its own, a frame copied holds the copies of its members — and what they name
 * outside is let go: a connector's other end, a frame that was not copied (unless `keepFrame`, a duplicate beside the
 * original, which stays in the frame it was made in).
 */
export const cloneElements = (
  elements: readonly BoardElement[],
  { dx, dy, topZ, keepFrame }: { dx: number; dy: number; topZ: number; keepFrame: boolean }
): BoardElement[] => {
  const ids = new Map(elements.map(element => [element.id, newId()]));
  const groups = new Map<string, string>();
  const rebind = (binding: Binding | undefined): Binding | undefined => {
    const id = binding ? ids.get(binding.id) : undefined;

    return binding && id ? { ...binding, id } : undefined;
  };

  // Stacked among themselves as they were, and handed back in the order they came: a caller can tell which copy is which.
  const order = new Map([...elements].sort(byStacking).map((element, index) => [element.id, index]));

  return elements.map(element => {
    const { start: _start, end: _end, group: _group, parent: _parent, votes: _votes, ...rest } = element;
    const group = element.group === undefined ? undefined : (groups.get(element.group) ?? newId());
    if (element.group !== undefined && group !== undefined) {
      groups.set(element.group, group);
    }

    const [start, end] = [rebind(element.start), rebind(element.end)];
    const parent = element.parent ? (ids.get(element.parent) ?? (keepFrame ? element.parent : undefined)) : undefined;

    return {
      ...rest,
      id: ids.get(element.id) ?? newId(),
      x: element.x + dx,
      y: element.y + dy,
      z: topZ + 1 + (order.get(element.id) ?? 0),
      version: 0,
      nonce: 0,
      ...(group === undefined ? {} : { group }),
      ...(parent === undefined ? {} : { parent }),
      ...(start ? { start } : {}),
      ...(end ? { end } : {})
    };
  });
};
