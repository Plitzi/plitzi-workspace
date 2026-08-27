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

/**
 * What to call this action, read off the flow that starts it.
 *
 * The trigger step is already named — the editor puts an editable title on every node — so a field beside the flow
 * asked the author to name the same thing twice, and left two names with no rule for which one anybody meant. The
 * FIRST trigger wins because it is the one the list and the picker show; an action with several ways in is still
 * one action, and naming it after the way most callers reach it is the honest summary.
 *
 * Falls back to whatever the document already carries, so a document written before this — or by a caller that
 * names it directly, like the authoring API — keeps the name it was given.
 */
export const actionName = (document: ActionDocument): string => {
  const titled = actionTriggers(document).find(node => node.title.trim() !== '');

  return titled?.title.trim() ?? document.name;
};
