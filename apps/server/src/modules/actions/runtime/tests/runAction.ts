import type { ActionRunRequest } from '../../types';
import type { ActionDocument, ActionEntry, ElementInteraction } from '@plitzi/sdk-shared';

export const node = (id: string, overrides: Partial<ElementInteraction> = {}): ElementInteraction => ({
  id,
  title: id,
  type: 'task',
  action: '',
  params: {},
  preview: {},
  elementId: null,
  beforeNode: '',
  afterNode: '',
  flowId: 'flow',
  enabled: true,
  ...overrides
});

/** The `call` trigger step, whose params are now where access and the input contract live. */
export const callTrigger = (params: Record<string, unknown> = {}, afterNode = 'compute') =>
  node('start', {
    type: 'trigger',
    action: 'call',
    params: { access: 'public', input: '{"amount":{"type":"number","required":true}}', ...params },
    afterNode
  });

export const buildEntry = (overrides: Partial<ActionDocument> = {}): ActionEntry => ({
  id: 'quote',
  document: {
    name: 'Quote',
    output: { total: { type: 'number' } },
    nodes: {
      start: callTrigger(),
      compute: node('compute', {
        action: 'flow.output',
        afterNode: '',
        params: { values: '{"total": {{ input.amount }}, "leaked": "internal"}' }
      })
    },
    ...overrides
  }
});

/** The whole action off is every way into it off — there is no switch beside the flow to turn. */
export const disabledEntry = (): ActionEntry => {
  const entry = buildEntry();
  entry.document.nodes.start.enabled = false;

  return entry;
};

export const request = (entry: ActionEntry, overrides: Partial<ActionRunRequest> = {}): ActionRunRequest => ({
  entry,
  input: { amount: 42 },
  callerId: 'ip:198.51.100.7',
  spaceId: 1,
  environment: 'main',
  trigger: 'call',
  runId: 'run-1',
  ...overrides
});

export const lookups = { getAction: () => Promise.resolve(undefined) };
