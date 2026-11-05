import type { ActionEntry, ElementInteraction, Schema } from '@plitzi/sdk-shared';

/**
 * A space of one page whose one element is a server provider fed by an action (`count`, a render trigger reading
 * `visits`), and the call that changes it (`bump`): what proves a render reads what a call wrote, wherever each runs.
 */

const node = (id: string, overrides: Partial<ElementInteraction> = {}): ElementInteraction => ({
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

const action = (id: string, trigger: 'call' | 'render', task: string): ActionEntry => ({
  id,
  document: {
    name: id,
    nodes: {
      start: node('start', { type: 'trigger', action: trigger, params: { access: 'public' }, afterNode: 'step' }),
      step: node('step', {
        action: task,
        params: { key: 'visits', amount: '1' },
        beforeNode: 'start',
        afterNode: 'out'
      }),
      out: node('out', { action: 'flow.output', params: { values: '{"value": {{ step.value }}}' }, beforeNode: 'step' })
    }
  }
});

export const actions = [action('bump', 'call', 'kv.increment'), action('count', 'render', 'kv.get')];

export const schema: Schema = {
  flat: {
    home: {
      id: 'home',
      attributes: { slug: '', folder: '', default: true },
      definition: { type: 'page', label: 'home', rootId: 'root', items: ['counter'], styleSelectors: { base: '' } }
    },
    counter: {
      id: 'counter',
      attributes: { action: 'count' },
      definition: {
        type: 'apiContainer',
        label: 'counter',
        rootId: 'root',
        items: [],
        styleSelectors: { base: '' },
        runtime: 'server'
      }
    }
  },
  pages: ['home'],
  pageFolders: [],
  definition: { name: 'test', permanentUrl: 'test' },
  variables: [],
  settings: { customCss: '' },
  rsc: { enabled: true }
} as unknown as Schema;
