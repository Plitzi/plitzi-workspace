import { processTwig } from '@plitzi/sdk-shared/helpers/twigWrapper';

import type { ActionTask } from '../types';

/**
 * Renders a template against the flow scope.
 *
 * `rawParams` because the runner resolves twig in every other task's params before calling it: doing that here
 * would consume the template this task exists to interpret, leaving it nothing to do.
 */
const template: ActionTask<{ template: string }> = {
  namespace: 'transform',
  action: 'template',
  title: 'Template',
  description:
    "A template rendered against the run's input and the steps before it; answers `value` — text, or the JSON document it writes.",
  rawParams: true,
  params: {
    template: { type: 'codemirror-text', canBind: true, defaultValue: '', label: 'Template' }
  },
  run: ({ template: source }, ctx) => ({
    value: typeof source === 'string' ? processTwig(source, { ...ctx.scope }) : ''
  })
};

/** Parses a JSON string — typically one a previous step returned as text — into a value later nodes can address. */
const json: ActionTask<{ value: string }> = {
  namespace: 'transform',
  action: 'json',
  title: 'Parse JSON',
  description: 'Reads a JSON text into a value; answers `value`. A text that is not JSON fails the step.',
  params: {
    value: { type: 'codemirror-text', canBind: true, defaultValue: '', label: 'Value' }
  },
  run: ({ value }) => {
    if (typeof value !== 'string') {
      return { value };
    }

    try {
      return { value: JSON.parse(value) as unknown };
    } catch {
      throw new Error('Value is not valid JSON');
    }
  }
};

export const transformTasks = [template, json] as ActionTask<Record<string, unknown>>[];
