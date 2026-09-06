import type { ElementInteraction, InteractionCallback } from '@plitzi/sdk-shared';

// Legacy data stored "undefined"/"null" as text for a missing target; treat as absent.
const NULLISH_ELEMENT_IDS = new Set(['undefined', 'null', '']);

type NodeShape = Pick<ElementInteraction, 'type' | 'action' | 'elementId'>;

/** `danger`: the step will not run. `warning`: it runs but is misconfigured. */
export type WarningLevel = 'warning' | 'danger';

export interface NodeWarning {
  level: WarningLevel;
  message: string;
}

/** Icon + color per level, shared by the node and flow indicators. */
export const WARNING_ICON: Record<WarningLevel, string> = {
  danger: 'fa-solid fa-circle-exclamation text-red-500',
  warning: 'fa-solid fa-triangle-exclamation text-orange-400'
};

/** Definition a stored node resolves to; undefined means nothing known matches it. */
export const findNodeDefinition = (
  node: NodeShape,
  nodeDefinitions: InteractionCallback[] | undefined
): InteractionCallback | undefined =>
  nodeDefinitions?.find(
    definition =>
      definition.type === node.type &&
      (!definition.elementId || definition.elementId === node.elementId) &&
      definition.action === node.action
  );

/** Malformations of a stored node, checked against the definitions the editor renders from. */
export const getNodeWarnings = (node: NodeShape, nodeDefinition: InteractionCallback | undefined): NodeWarning[] => {
  const warnings: NodeWarning[] = [];
  const { type, action, elementId } = node;

  if (type === 'trigger') {
    if (!action) {
      warnings.push({ level: 'danger', message: 'This trigger has no event selected, so the flow will never start.' });
    }

    return warnings;
  }

  if (!action) {
    warnings.push({ level: 'danger', message: 'No action selected for this step, so it will not run.' });

    return warnings;
  }

  if (elementId === 'undefined' || elementId === 'null') {
    warnings.push(
      type === 'utility'
        ? {
            level: 'warning',
            message: 'Invalid target stored as the text "undefined"; it is ignored for a utility but should be cleared.'
          }
        : {
            level: 'danger',
            message: 'Invalid target stored as the text "undefined", so this step resolves to nothing. Re-select it.'
          }
    );
  }

  if (type === 'utility' && elementId && !NULLISH_ELEMENT_IDS.has(elementId)) {
    warnings.push({ level: 'warning', message: 'A utility runs on no element, so it should have no target element.' });
  }

  // No matching definition: unknown action, wrong node type, or a target that no longer exists.
  if (!nodeDefinition) {
    warnings.push({
      level: 'danger',
      message: 'This action is not recognized, so it may have been removed or points at a missing element.'
    });
  }

  return warnings;
};

export const worstLevel = (warnings: NodeWarning[]): WarningLevel | undefined => {
  if (warnings.some(warning => warning.level === 'danger')) {
    return 'danger';
  }

  return warnings.length > 0 ? 'warning' : undefined;
};

/** Flow rollup for the flow indicator: malformed-step count and worst severity. */
export const summarizeFlow = (
  nodes: Record<string, ElementInteraction>,
  nodeDefinitions: InteractionCallback[] | undefined
): { count: number; level: WarningLevel | undefined } => {
  let count = 0;
  let hasDanger = false;
  for (const node of Object.values(nodes)) {
    const warnings = getNodeWarnings(node, findNodeDefinition(node, nodeDefinitions));
    if (warnings.length > 0) {
      count += 1;
      if (warnings.some(warning => warning.level === 'danger')) {
        hasDanger = true;
      }
    }
  }

  return { count, level: count === 0 ? undefined : hasDanger ? 'danger' : 'warning' };
};
