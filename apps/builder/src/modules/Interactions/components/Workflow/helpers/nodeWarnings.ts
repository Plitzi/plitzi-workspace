import type { ElementInteraction, InteractionCallback } from '@plitzi/sdk-shared';

// A node elementId that is really "no element" but serialized as text (the builder historically stored the string
// "undefined" for a utility, which has no target). Treated as an absent target.
const NULLISH_ELEMENT_IDS = new Set(['undefined', 'null', '']);

type NodeShape = Pick<ElementInteraction, 'type' | 'action' | 'elementId'>;

// `danger` — the step is broken and will NOT run (no action, unrecognized action, a callback target that resolves to
// nothing). `warning` — the step still runs but is misconfigured (a utility carrying a target, a harmless leftover).
export type WarningLevel = 'warning' | 'danger';

export interface NodeWarning {
  level: WarningLevel;
  message: string;
}

/** FontAwesome classes (icon + color) per level — shared by the node and flow indicators so they stay consistent. */
export const WARNING_ICON: Record<WarningLevel, string> = {
  danger: 'fa-solid fa-circle-exclamation text-red-500',
  warning: 'fa-solid fa-triangle-exclamation text-orange-400'
};

/** The definition a stored node resolves to, matched by type, action and (for element callbacks) target — mirrors
 *  how WorkflowNode renders it. Undefined means the node points at nothing the runtime knows. */
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

/** The node targets an element that exists but has no idRef (a flagged, unreferenced definition), so the runtime
 *  cannot wire it — surfaced separately from the generic "not recognized" case. */
export const isTargetUnreferenced = (
  node: Pick<ElementInteraction, 'elementId'>,
  nodeDefinitions: InteractionCallback[] | undefined
): boolean =>
  Boolean(node.elementId) &&
  Boolean(nodeDefinitions?.some(definition => definition.elementId === node.elementId && definition.unreferenced));

// Problems with a stored interaction node, each tagged with a severity, surfaced in the builder so the user sees that
// a step is malformed. Independent of the MCP validator — the builder checks against the real nodeDefinitions it
// renders from.
export const getNodeWarnings = (
  node: NodeShape,
  nodeDefinition: InteractionCallback | undefined,
  targetUnreferenced: boolean
): NodeWarning[] => {
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
    // A utility ignores its target, so a stray nullish string is harmless (warning); a callback resolves against it,
    // so the step is broken (danger).
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

  // No matching definition: an unknown action, the wrong node type, or a target element that no longer exists.
  // targetUnreferenced is a distinct, separately-flagged case (the target exists but has no idRef).
  if (!nodeDefinition && !targetUnreferenced) {
    warnings.push({
      level: 'danger',
      message: 'This action is not recognized, so it may have been removed or points at a missing element.'
    });
  }

  return warnings;
};

/** The most severe level among a node's warnings (danger wins), or undefined when there are none. */
export const worstLevel = (warnings: NodeWarning[]): WarningLevel | undefined => {
  if (warnings.some(warning => warning.level === 'danger')) {
    return 'danger';
  }

  return warnings.length > 0 ? 'warning' : undefined;
};

/** Flow-level rollup: how many steps are malformed and the worst severity among them (drives the flow indicator). */
export const summarizeFlow = (
  nodes: Record<string, ElementInteraction>,
  nodeDefinitions: InteractionCallback[] | undefined
): { count: number; level: WarningLevel | undefined } => {
  let count = 0;
  let hasDanger = false;
  for (const node of Object.values(nodes)) {
    const warnings = getNodeWarnings(
      node,
      findNodeDefinition(node, nodeDefinitions),
      isTargetUnreferenced(node, nodeDefinitions)
    );
    if (warnings.length > 0) {
      count += 1;
      if (warnings.some(warning => warning.level === 'danger')) {
        hasDanger = true;
      }
    }
  }

  return { count, level: count === 0 ? undefined : hasDanger ? 'danger' : 'warning' };
};
