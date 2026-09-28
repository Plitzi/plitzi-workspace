import { LIMITS } from './model.ts';

import type { BoardElement } from './model.ts';

/**
 * Cards that wait on other cards: a card's `blockedBy` names the cards that have to be done first. A card is blocked
 * while any of them is still open — one that is done, or gone, no longer holds it back. Read by the canvas that draws
 * and warns, the server that checks what it is sent, and the agent that sets them and watches them.
 */

type Find = (id: string) => BoardElement | undefined;

/** The cards `card` waits on that are still open — what makes it blocked. */
export const openBlockers = (card: BoardElement, find: Find): BoardElement[] =>
  (card.blockedBy ?? []).flatMap(id => {
    const blocker = find(id);

    return blocker && !blocker.deleted && blocker.type === 'card' && !blocker.done ? [blocker] : [];
  });

/** The cards that wait on `card`, done or not. */
export const waitingOn = (card: BoardElement, elements: readonly BoardElement[]): BoardElement[] =>
  elements.filter(element => !element.deleted && element.blockedBy?.includes(card.id));

/** Whether `card` waits on `target`, directly or through the cards it waits on. */
const dependsOn = (card: BoardElement, target: string, find: Find, seen = new Set<string>()): boolean =>
  (card.blockedBy ?? []).some(id => {
    if (id === target) {
      return true;
    }

    if (seen.has(id)) {
      return false;
    }

    seen.add(id);
    const next = find(id);

    return next !== undefined && dependsOn(next, target, find, seen);
  });

/** A card's title as a warning quotes it: its first line, short. */
export const cardTitle = (card: BoardElement): string => {
  const title = card.text?.trim().split('\n')[0] ?? '';

  return title.length > 48 ? `${title.slice(0, 47)}…` : title || 'Untitled';
};

/**
 * `card` waiting on `blocker` — or no longer, if it already did: the card as it is then. Refused, with why, when it
 * cannot: a card waits on another card, not on itself, not on one that waits on it, and on a handful at most.
 */
export const toggledBlocker = (
  card: BoardElement,
  blocker: BoardElement,
  find: Find
): { card: BoardElement; added: boolean } | { refused: string } => {
  if (card.type !== 'card' || blocker.type !== 'card') {
    return { refused: 'A card waits on another card' };
  }

  if (card.id === blocker.id) {
    return { refused: 'A card cannot wait on itself' };
  }

  const current = card.blockedBy ?? [];
  if (current.includes(blocker.id)) {
    const rest = current.filter(id => id !== blocker.id);
    const { blockedBy: _blockedBy, ...free } = card;

    return { card: rest.length ? { ...card, blockedBy: rest } : free, added: false };
  }

  if (dependsOn(blocker, card.id, find)) {
    return { refused: `“${cardTitle(blocker)}” already waits on “${cardTitle(card)}” — they would wait on each other` };
  }

  if (current.length >= LIMITS.blockers) {
    return { refused: `A card waits on ${LIMITS.blockers} others at most` };
  }

  return { card: { ...card, blockedBy: [...current, blocker.id] }, added: true };
};

/**
 * The cards in `changes` that went on while something they wait on is still open — moved to another column, or
 * ticked done — each with what holds it back. `before` is where each was.
 */
export const movedOnBlocked = (
  changes: readonly BoardElement[],
  before: Find,
  find: Find
): { card: BoardElement; blockers: BoardElement[] }[] =>
  changes.flatMap(card => {
    const was = before(card.id);
    const movedOn = was !== undefined && (card.parent !== was.parent || (card.done === true && was.done !== true));
    if (card.type !== 'card' || card.deleted || !movedOn) {
      return [];
    }

    const blockers = openBlockers(card, find);

    return blockers.length ? [{ card, blockers }] : [];
  });

/** What a person or an agent is told when a blocked card goes on anyway. */
export const blockedWarning = ({ card, blockers }: { card: BoardElement; blockers: BoardElement[] }): string => {
  const [first, ...more] = blockers;
  const others = more.length ? ` and ${more.length} more` : '';

  return `“${cardTitle(card)}” went on while it waits on “${cardTitle(first)}”${others}, still open`;
};
