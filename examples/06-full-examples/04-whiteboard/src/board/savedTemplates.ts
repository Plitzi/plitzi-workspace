import { isRecord, parseElement, textOf } from './model.ts';

import type { BoardElement } from './model.ts';

/**
 * A team's own formats: what they laid out once — a retro's columns, a weekly check-in frame, a triage lane — kept as
 * a template, to be put down again on this board or any other. Kept once on the server by a code of its own, as a board
 * is; a board lists the ones it uses, and a code pasted into another board's library adds it there. Read by the server
 * that keeps them, the canvas that places them and the agent that saves and uses them.
 */

export type SavedTemplate = {
  /** Its code: what another board adds it by, and what an agent is told to use. */
  id: string;
  title: string;
  /** What it puts down, its top left corner at the origin: frames with what they hold, and the lines between. */
  elements: BoardElement[];
  savedAt: number;
};

export const TEMPLATE_LIMITS = {
  /** What one template holds: a format's worth, never a whole board. */
  elements: 400,
  /** The templates one board lists: a library shelf, not an archive. */
  perBoard: 24,
  title: 60
} as const;

/** A template's code: as a board's, short and unambiguous read aloud. */
export const isTemplateId = (value: unknown): value is string =>
  typeof value === 'string' && /^[a-z0-9]{10}$/.test(value);

/** What it is called, one line — or, unnamed, a name that says what it is. */
export const templateTitle = (value: unknown): string =>
  textOf(value).replace(/\s+/g, ' ').trim().slice(0, TEMPLATE_LIMITS.title) || 'Untitled template';

/**
 * What a template keeps of `contents` — the selection it is saved from, with what its frames hold and the lines
 * between: moved so its top left corner is the origin, and without what belonged to this board and these people —
 * votes, threads, who wrote what, the agent that took a frame's duty, the branch a frame was. Pictures are left behind
 * — they are this board's files — and so are notes still face down: their words are not anyone's to copy yet. Answers
 * `undefined` when nothing is left.
 */
export const asTemplate = (contents: readonly BoardElement[]): BoardElement[] | undefined => {
  const kept = contents
    .filter(element => !element.deleted && element.type !== 'image' && !element.veiled)
    .slice(0, TEMPLATE_LIMITS.elements);
  if (!kept.length) {
    return undefined;
  }

  const left = Math.min(...kept.map(element => element.x));
  const top = Math.min(...kept.map(element => element.y));

  return kept.map(element => {
    const { votes: _votes, replies: _replies, author: _author, branchOf: _branchOf, duty, ...rest } = element;

    return {
      ...rest,
      x: element.x - left,
      y: element.y - top,
      version: 0,
      nonce: 0,
      ...(duty ? { duty: { role: duty.role, instruction: duty.instruction } } : {})
    };
  });
};

/** A template from outside — a server's answer, a page's props — checked, or `undefined`. */
export const parseTemplate = (value: unknown): SavedTemplate | undefined => {
  if (!isRecord(value) || !isTemplateId(value.id) || !Array.isArray(value.elements)) {
    return undefined;
  }

  const elements = value.elements.map(parseElement);
  if (!elements.length || elements.some(element => element === undefined)) {
    return undefined;
  }

  return {
    id: value.id,
    title: templateTitle(value.title),
    elements: elements.filter(element => element !== undefined),
    savedAt: typeof value.savedAt === 'number' ? value.savedAt : 0
  };
};

/** What a template holds, in a few words: what the library and an agent say of it. */
export const templateSummary = (template: SavedTemplate): string => {
  const counts = new Map<string, number>();
  for (const element of template.elements) {
    const kind = element.layout === 'column' ? 'column' : element.type;
    counts.set(kind, (counts.get(kind) ?? 0) + 1);
  }

  return [...counts].map(([kind, count]) => `${count} ${kind}${count === 1 ? '' : 's'}`).join(', ');
};
