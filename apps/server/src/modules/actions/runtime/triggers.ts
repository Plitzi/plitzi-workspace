import type { ActionTriggerParams, ActionTriggerType, ElementInteraction } from '@plitzi/sdk-shared';

/**
 * The step that starts a flow, for one way in.
 *
 * An action holds its ways in as trigger STEPS, exactly as an element holds `onClick` and `onSubmit` in one node
 * map — so finding the entry point means finding the trigger whose kind matches what fired, not reading a list
 * beside the flow. An action with no step for that kind cannot be started that way, and that is the whole of the
 * "does it declare this trigger" check.
 */
export const findTriggerNode = (
  nodes: Record<string, ElementInteraction>,
  kind: ActionTriggerType
): ElementInteraction | undefined => Object.values(nodes).find(node => node.type === 'trigger' && node.action === kind);

/** What a trigger step carries: who may start it, what it takes, and whatever its kind needs. */
export const triggerParams = (node: ElementInteraction): ActionTriggerParams => node.params;
