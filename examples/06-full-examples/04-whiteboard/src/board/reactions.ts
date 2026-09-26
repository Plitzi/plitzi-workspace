/**
 * The reactions a person can send to everyone on a board: a small, fixed set, so the room is a vocabulary rather than
 * a free text box — and what arrives from another page is checked against it before it is drawn.
 */
export const REACTIONS = ['👍', '❤️', '🎉', '😂', '🔥', '👀', '✅', '❓', '👏', '💡', '🤔', '🚀'] as const;

export type ReactionEmoji = (typeof REACTIONS)[number];

export const isReaction = (value: unknown): value is ReactionEmoji => REACTIONS.some(emoji => emoji === value);

/**
 * Stamps: marks that stay. Put on the board as a text element holding one emoji, at a stamp's size — a verdict on a
 * design, a flag on a risk, a star on the idea that won — where a reaction floats away.
 */
export const STAMPS = ['👍', '❤️', '⭐', '✅', '❌', '❓', '💡', '🔥', '🎯', '⚠️', '🚩', '🏆'] as const;

export type StampEmoji = (typeof STAMPS)[number];

export const isStamp = (value: unknown): value is StampEmoji => STAMPS.some(emoji => emoji === value);

/** How big a stamp is put down: a mark to see from a zoomed-out board, and a text like any other after — resizable. */
export const STAMP_SIZE = 64;
