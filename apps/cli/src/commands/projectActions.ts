import path from 'node:path';

import { actionsIn } from '@plitzi/sdk-authoring/node';
import { isRecord } from '@plitzi/sdk-shared/helpers';

import type { ActionEntry } from '@plitzi/sdk-shared';

/**
 * The project's own server actions (`src/actions/`), by their id: what `explain` says of one. A run's designer read
 * src/data and src/functions by hand to find who may run `host-close`, and `explain host-close` said "no name".
 */
export const projectActions = async (root: string): Promise<{ actions: ActionEntry[] } | { problem: string }> => {
  try {
    return { actions: await actionsIn(path.join(root, 'src', 'actions')) };
  } catch (error) {
    return { problem: error instanceof Error ? error.message : String(error) };
  }
};

/** An input's fields as its trigger declares them, a JSON text: `slug (text, required)`. */
const inputText = (input: unknown): string => {
  try {
    const fields: unknown = typeof input === 'string' ? JSON.parse(input) : input;

    return isRecord(fields)
      ? Object.entries(fields)
          .map(([name, field]) =>
            isRecord(field) ? `${name} (${String(field.type)}${field.required === true ? ', required' : ''})` : name
          )
          .join(', ')
      : '';
  } catch {
    return '';
  }
};

/** An action of the project, as `explain` says it: what it does, what runs it and with what, its steps. */
export const actionText = (action: ActionEntry): string => {
  const nodes = Object.values(action.document.nodes);
  const triggers = nodes.filter(node => node.type === 'trigger');
  const steps = nodes.filter(node => node.type === 'task').map(node => node.action);

  return [
    `${action.id} — an action of this project (src/actions/): ${action.document.name}`,
    ...(action.document.description ? [`  ${action.document.description}`] : []),
    ...triggers.map(trigger => {
      const params = isRecord(trigger.params) ? trigger.params : {};
      const input = inputText(params.input);

      return `  Run by: ${trigger.action}${typeof params.access === 'string' ? ` (${params.access})` : ''}${input === '' ? '' : ` — input: ${input}`}`;
    }),
    ...(steps.length > 0 ? [`  Its steps: ${steps.join(' → ')}`] : []),
    `  From a page's steps: page play <path> --steps 'action ${action.id} {…}' (as the page's visitor)`
  ].join('\n');
};
