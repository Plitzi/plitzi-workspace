import type { ActionEntry, ElementInteraction } from '@plitzi/sdk-shared';

const step = (id: string, fields: Partial<ElementInteraction>): ElementInteraction => ({
  id,
  title: id,
  type: 'task',
  action: '',
  params: {},
  preview: {},
  elementId: null,
  beforeNode: '',
  afterNode: '',
  flowId: 'try',
  enabled: true,
  ...fields
});

/** The id of the step that runs the task in a {@link functionTryEntry}: where its value, logs and error are found. */
export const TRY_STEP = 'task';

/**
 * One task as the smallest flow that runs it: a session call, the task, and its answer — so trying a function is an
 * ordinary run, with every check, limit and record a run has, and nothing of its own to keep in step. The builder's
 * Try, an agent's and `plitzi functions dev` are all this.
 */
export const functionTryEntry = (task: string, params: Record<string, unknown>): ActionEntry => ({
  id: `try:${task}`,
  document: {
    name: `Try ${task}`,
    output: { value: { type: 'json' } },
    nodes: {
      start: step('start', { type: 'trigger', action: 'call', params: { access: 'session' }, afterNode: TRY_STEP }),
      [TRY_STEP]: step(TRY_STEP, { title: task, action: task, params, afterNode: 'answer' }),
      answer: step('answer', { action: 'flow.output', params: { values: `{"value": {{ ${TRY_STEP}|json_encode }}}` } })
    }
  }
});
