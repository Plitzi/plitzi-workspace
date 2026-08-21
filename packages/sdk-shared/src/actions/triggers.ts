import type { ActionDocument, ElementInteraction } from '../types';

/**
 * The ways into an action, read off the flow.
 *
 * A way in is a trigger STEP, so this is the only place that has to know it — the builder's list, the MCP summary
 * and the schedule sweep all ask the same question of the same document and cannot answer it differently.
 */
export const actionTriggers = (document: ActionDocument): ElementInteraction[] =>
  Object.values(document.nodes).filter(node => node.type === 'trigger');

/**
 * Whether this action can run at all: whether ANY way into it is switched on.
 *
 * DERIVED, never stored. The switch belongs to the trigger — one per way in — and an action-level copy of it was a
 * second answer to the same question: the builder computed it from the steps, the store overwrote it from its own
 * column, and the two could disagree with nothing to say which won. A store that keeps a column for it (to index
 * the schedule sweep, say) writes what this returns, and reads it back as a cache rather than as a decision.
 */
export const isActionEnabled = (document: ActionDocument): boolean =>
  actionTriggers(document).some(node => node.enabled);
