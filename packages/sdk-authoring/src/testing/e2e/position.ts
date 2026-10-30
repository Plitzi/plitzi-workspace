/**
 * Where two elements stand to each other — `activity.bottom + 8 <= legend.top` — read and held on their boxes. A run's
 * every layout line (one row, clear of a corner, above a legend) was ~300 characters of jq over boxes.
 */

/** An edge or a size of an element's box, in px of the page. */
export const EDGES = ['left', 'right', 'top', 'bottom', 'width', 'height'] as const;

export type Edge = (typeof EDGES)[number];

const RELATIONS = ['<=', '>=', '<', '>', '='] as const;

export type RelationSign = (typeof RELATIONS)[number];

/** One side of a relation: an element's edge give or take some px, or a number of px alone. */
export interface RelationSide {
  element?: string;
  edge?: Edge;
  px: number;
}

export interface Relation {
  said: string;
  left: RelationSide;
  at: RelationSign;
  right: RelationSide;
}

export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

const SIDE = new RegExp(
  `^(?:([\\w:-]+)\\.(${EDGES.join('|')})\\s*(?:([+-])\\s*(\\d+(?:\\.\\d+)?)(?:px)?)?|(-?\\d+(?:\\.\\d+)?)(?:px)?)$`
);

const sideOf = (text: string): RelationSide | undefined => {
  const match = SIDE.exec(text.trim());
  if (!match) {
    return undefined;
  }

  // A group that did not take part is undefined, whatever the array's type says.
  const [element, edge, sign, offset, alone] = [1, 2, 3, 4, 5].map(group => match.at(group));
  if (alone !== undefined) {
    return { px: Number(alone) };
  }

  const px = offset === undefined ? 0 : Number(offset) * (sign === '-' ? -1 : 1);

  return { element, edge: EDGES.find(each => each === edge), px };
};

/** A relation as written, or why it is not one: two sides — an element's edge give or take px, or px alone — and a sign. */
export const parseRelation = (text: string): Relation | { problem: string } => {
  const match = /^(.+?)\s*(<=|>=|<|>|=)\s*(.+)$/.exec(text.trim());
  const at = RELATIONS.find(each => each === match?.at(2));
  const [left, right] = match ? [sideOf(match[1]), sideOf(match[3])] : [undefined, undefined];
  if (!left || !right || !at || (left.element === undefined && right.element === undefined)) {
    return {
      problem: `"${text}" is no relation: two sides — an element's edge (${EDGES.join(', ')}) give or take px, or px alone — and <=, >=, <, > or =, as "activity.bottom + 8 <= legend.top"`
    };
  }

  return { said: text.trim(), left, at, right };
};

/** The elements a relation names. */
export const relationElements = (relation: Relation): string[] =>
  [relation.left.element, relation.right.element].filter((element): element is string => element !== undefined);

/** A side's px from the boxes read: the edge's place give or take — or the element no box was read for. */
export const sidePx = (
  side: RelationSide,
  boxOf: (element: string) => Box | undefined
): number | { missing: string } => {
  if (side.element === undefined || side.edge === undefined) {
    return side.px;
  }

  const box = boxOf(side.element);
  if (!box) {
    return { missing: side.element };
  }

  const edge = {
    left: box.x,
    right: box.x + box.width,
    top: box.y,
    bottom: box.y + box.height,
    width: box.width,
    height: box.height
  }[side.edge];

  return edge + side.px;
};

/** Whether two px stand as the sign says, to a tenth of a px: an edge is a fraction the layout rounds. */
export const relationHolds = (left: number, at: RelationSign, right: number): boolean => {
  const [a, b] = [Math.round(left * 10) / 10, Math.round(right * 10) / 10];

  return { '<=': a <= b, '>=': a >= b, '<': a < b, '>': a > b, '=': a === b }[at];
};
