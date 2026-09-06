import { flowsFromInteractions } from '../../helpers';

import type { Space } from '../../helpers';
import type { AIInteractionNode } from '../../types';
import type { Element } from '@plitzi/sdk-shared';

// What a render tells the model about the behaviour it just authored.
//
// A widget's flows are the one part of it the model cannot see: the layout comes back as a picture the user looks
// at, but "did the click get wired to the element I meant?" has no visible answer, and a step that resolved to
// nothing renders exactly like one that worked. So the render reports the wiring it actually stored — host,
// trigger, and each step with the element it acts on — read back off the applied schema rather than off the
// operations, which is what makes it evidence: it reflects what survived validation, defaulting and materialization.
//
// This is a STATIC report, and deliberately so. Whether the callback *ran* is a runtime question, and the server
// that answers this one holds no widget: it keeps nothing between calls, so a later "test this click" call would
// have no widget to test — only the host's view has one (see the patch round trip in render.ts). Reporting the
// wiring is what can be known here, and it is what separates "the flow is attached to the element I named" from
// the three ways a flow silently does nothing.

const TRIGGER = 'trigger';

const stepLabel = (step: AIInteractionNode): string => {
  if (step.nodeType !== 'callback') {
    return step.action;
  }

  // The field a setState/toggleState writes — the half of the step that says WHAT changed, next to the element
  // that says where. Any other callback simply has no key.
  const key = step.params?.key;
  const target = step.elementId ? ` ${step.elementId}` : '';

  return `${step.action}${target}${typeof key === 'string' ? `[${key}]` : ''}`;
};

const flowLines = (element: Element): string[] =>
  flowsFromInteractions(element.definition.interactions).map(flow => {
    const [head, ...rest] = flow.nodes;
    const trigger = head.nodeType === TRIGGER ? head.action : 'no trigger';
    const steps = (head.nodeType === TRIGGER ? rest : flow.nodes).filter(node => node.enabled !== false).map(stepLabel);

    return `${element.id} ${trigger} → ${steps.length > 0 ? steps.join(', ') : 'nothing (flow has no steps)'}`;
  });

const triggerActions = (element: Element): Set<string> =>
  new Set(
    Object.values(element.definition.interactions ?? {})
      .filter(node => node.type === TRIGGER)
      .map(node => node.action)
  );

/** Two elements on the same ancestry line listening for the same event both run: the browser bubbles the event up
 *  and Plitzi flows do not stop it. It is the one interaction bug that looks like a working widget (the inner flow
 *  runs, and so does the outer), so the pair is named rather than left to be discovered by clicking. */
const nestingWarnings = (space: Space): string[] => {
  const flat = space.schema.flat;
  // render() runs validateSchema before this, so a parent link resolves — but the walk stays defensive rather than
  // trusting a caller that skipped it, and the `seen` set stops a cycle from looping forever.
  const parentOf = (element: Element): Element | undefined => {
    const parentId = element.definition.parentId;

    return parentId === undefined ? undefined : flat[parentId];
  };

  const warnings: string[] = [];
  for (const element of Object.values(flat)) {
    const own = triggerActions(element);
    if (own.size === 0) {
      continue;
    }

    const seen = new Set<string>([element.id]);
    let parent = parentOf(element);
    while (parent && !seen.has(parent.id)) {
      seen.add(parent.id);
      for (const action of triggerActions(parent)) {
        if (own.has(action)) {
          warnings.push(
            `"${element.id}" and its ancestor "${parent.id}" both listen for ${action} — the event bubbles, so a ` +
              `${action} on "${element.id}" runs BOTH flows. Move the trigger to one of them, or gate the outer ` +
              'flow with a `when` guard.'
          );
        }
      }

      parent = parentOf(parent);
    }
  }

  return warnings;
};

export interface InteractionReport {
  /** One line per flow: `<host> <trigger> → <step>, <step>`. Omitted when the widget has no flows. */
  flows?: string[];
  warnings: string[];
}

export const interactionReport = (space: Space): InteractionReport => {
  const flows = Object.values(space.schema.flat).flatMap(flowLines);

  return { ...(flows.length > 0 ? { flows } : {}), warnings: nestingWarnings(space) };
};
