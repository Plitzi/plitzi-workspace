/**
 * The reactions a person can send to everyone on a board: a small, fixed set, so the room is a vocabulary rather than
 * a free text box — and what arrives from another page is checked against it before it is drawn.
 */
export const REACTIONS = ['👍', '❤️', '🎉', '😂', '🔥', '👀', '✅', '❓'] as const;

export type ReactionEmoji = (typeof REACTIONS)[number];

export const isReaction = (value: unknown): value is ReactionEmoji => REACTIONS.some(emoji => emoji === value);
