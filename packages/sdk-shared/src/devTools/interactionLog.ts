import type { InteractionFlowParams, LogInteraction } from '../types/DevToolsTypes';

/**
 * Is this entry a flow that finished, as opposed to a note about one of its steps?
 *
 * `nodes` is the discriminant because it is the thing the flow view is made of, and a note — written from inside
 * the traversal, while the flow is still running — can never have one. It is read through `Partial` because a log
 * written by an older build can carry `nodes: undefined` rather than omitting the key: the declared type says
 * that cannot happen, and the crash this guard exists to prevent says it can.
 *
 * Lives here rather than beside the type because `types/` holds types and nothing else: a value exported from
 * that barrel turns every consumer's type-only import into a runtime one.
 */
export const isInteractionFlow = (params: LogInteraction['params']): params is InteractionFlowParams =>
  (params as Partial<InteractionFlowParams>).nodes !== undefined;

export default isInteractionFlow;
