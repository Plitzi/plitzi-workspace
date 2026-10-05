import { describe, expect, it } from 'vitest';

import { functionCeilings } from './config';
import { defineFunctions } from './contract';
import { readManifest } from './manifest';
import { createActionsModule } from '../actions';

import type { FunctionContext } from './contract';
import type { FunctionInvokeRequest, FunctionRunner, SpaceFunctions } from './protocol';
import type { ActionsConfig } from '../actions/types';
import type { ActionEntry, ElementInteraction } from '@plitzi/sdk-shared';

const SPACE = 3;

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

/** An action whose one step is `task`, answering what the step returned. */
const entryFor = (task: string): ActionEntry => ({
  id: 'probe',
  document: {
    name: 'Probe',
    output: { value: { type: 'json' } },
    nodes: {
      start: node('start', { type: 'trigger', action: 'call', params: { access: 'public' }, afterNode: 'step' }),
      step: node('step', { action: task, afterNode: 'ret' }),
      ret: node('ret', { action: 'flow.output', params: { values: '{"value": {{ step|json_encode }}}' } })
    }
  }
});

const moduleWith = (config: Partial<ActionsConfig> = {}) =>
  createActionsModule({
    lookups: { getAction: () => Promise.resolve(undefined), getCredential: () => Promise.resolve({ key: 'secret' }) },
    signingSecret: 'a-signing-secret-of-at-least-thirty-two-characters',
    ...config
  });

const run = (module: ReturnType<typeof moduleWith>, task: string) =>
  module.runAction({
    entry: entryFor(task),
    input: {},
    callerId: 'user:7',
    spaceId: SPACE,
    environment: 'main',
    trigger: 'call',
    runId: 'run-1'
  });

/** A plugin `board` this server ships, whose one task runs `probe` with its context. */
const boardWith = (probe: (ctx: FunctionContext) => unknown) =>
  defineFunctions({
    tasks: [{ namespace: 'board', action: 'probe', title: 'Probe', params: {}, run: (_params, ctx) => probe(ctx) }],
    routes: { 'GET /layout': async (_request, ctx) => Response.json(await ctx.kv.get('layout')) }
  });

describe('a plugin’s server half, shipped by the server', () => {
  it('is a step named after the plugin, listed as the plugin’s', async () => {
    const module = moduleWith({ functions: { plugins: { board: boardWith(() => 'drawn') } } });

    expect(module.registry.get('board.probe')?.origin).toBe('plugin');
    expect((await run(module, 'board.probe')).output.value).toBe('drawn');
  });

  it('is refused at boot for a task named after something else', () => {
    const misnamed = defineFunctions({
      tasks: [{ namespace: 'cards', action: 'probe', title: 'Probe', params: {}, run: () => undefined }]
    });

    expect(() => moduleWith({ functions: { plugins: { board: misnamed } } })).toThrow('tasks are named after it');
  });

  it('keeps its keys in a corner of the space’s kv, which the space’s own keys never meet', async () => {
    const module = moduleWith({
      functions: { plugins: { board: boardWith(ctx => ctx.kv.set('layout', { columns: 2 })) } }
    });
    await module.kv(SPACE).set('layout', 'the space’s');

    await run(module, 'board.probe');

    expect(await module.kv(SPACE).get('layout')).toBe('the space’s');
    expect(await module.kv(SPACE).get('plugin:board:layout')).toEqual({ columns: 2 });
  });

  it('signs as itself: what it signs the space does not verify, and the other way round', async () => {
    const module = moduleWith({
      functions: {
        plugins: {
          board: boardWith(async ctx => {
            const own = await ctx.sign('invite:9');

            return { own: await ctx.verify('invite:9', own) };
          })
        }
      }
    });
    const signed = (await run(module, 'board.probe')).output.value as { own: boolean };

    expect(signed.own).toBe(true);
    const spaceSigned = moduleWith({
      functions: {
        native: [
          defineFunctions({
            tasks: [
              {
                namespace: 'probe',
                action: 'sign',
                title: 'Sign',
                params: {},
                run: (_params, ctx) => ctx.sign('invite:9')
              }
            ]
          })
        ]
      }
    });
    const spaceSignature = (await run(spaceSigned, 'probe.sign')).output.value as string;
    const pluginVerifies = moduleWith({
      functions: { plugins: { board: boardWith(ctx => ctx.verify('invite:9', spaceSignature)) } }
    });

    expect((await run(pluginVerifies, 'board.probe')).output.value).toBe(false);
  });

  it('names none of the space’s credentials and reaches none of its channels', async () => {
    const credential = moduleWith({
      functions: {
        plugins: {
          board: boardWith(ctx =>
            ctx.fetch('https://api.example.com', { credential: 'stripe' }).then(
              () => 'reached',
              (error: unknown) => (error instanceof Error ? error.message : String(error))
            )
          )
        }
      }
    });
    const channel = moduleWith({
      functions: {
        plugins: {
          board: boardWith(ctx =>
            ctx.publish('room', 'move', {}).then(
              () => 'published',
              (error: unknown) => (error instanceof Error ? error.message : String(error))
            )
          )
        }
      }
    });

    expect((await run(credential, 'board.probe')).output.value).toContain('name no credential');
    expect((await run(channel, 'board.probe')).output.value).toContain('none of the realtime channels');
  });

  it('answers its routes under /plugins/<type>/, with the same corner of kv', async () => {
    const module = moduleWith({ functions: { plugins: { board: boardWith(() => undefined) } } });
    await module.kv(SPACE).set('plugin:board:layout', { columns: 3 });
    const visit = {
      spaceId: SPACE,
      environment: 'main' as const,
      callerId: 'ip:1',
      signal: new AbortController().signal
    };

    const route = await module.routeFor(visit, 'GET', '/plugins/board/layout');
    const response = await route?.handle(new Request('https://space.example/fn/plugins/board/layout'));

    expect(await response?.json()).toEqual({ columns: 3 });
    expect(await module.routeFor(visit, 'GET', '/layout')).toBeUndefined();
    expect(await module.routeFor(visit, 'GET', '/plugins/cards/layout')).toBeUndefined();
  });

  it('is replaced while the server runs — and a version that does not check out leaves the running one', async () => {
    const module = moduleWith({ functions: { plugins: { board: boardWith(() => 'first') } } });
    const visit = {
      spaceId: SPACE,
      environment: 'main' as const,
      callerId: 'ip:1',
      signal: new AbortController().signal
    };

    module.setPluginFunctions(
      'board',
      boardWith(() => 'second')
    );
    expect((await run(module, 'board.probe')).output.value).toBe('second');

    const misnamed = defineFunctions({
      tasks: [{ namespace: 'cards', action: 'probe', title: 'Probe', params: {}, run: () => 'wrong' }]
    });
    expect(() => module.setPluginFunctions('board', misnamed)).toThrow('tasks are named after it');
    expect((await run(module, 'board.probe')).output.value).toBe('second');

    module.setPluginFunctions('board', undefined);
    expect(module.registry.get('board.probe')).toBeUndefined();
    expect(await module.routeFor(visit, 'GET', '/plugins/board/layout')).toBeUndefined();
  });

  it('leaves /plugins/ to the plugins: a deployment route there is refused at boot', () => {
    const squatting = defineFunctions({ routes: { 'GET /plugins/board/layout': () => new Response('mine') } });

    expect(() => moduleWith({ functions: { native: [squatting] } })).toThrow('is under /plugins/');
  });
});

/** A runner that answers a task by asking the server to `kv.set` what the invocation names — as the sandbox would. */
const kvRunner = (): FunctionRunner => ({
  describe: () => Promise.resolve({}),
  invoke: async ({ invocation, answer }: FunctionInvokeRequest) => {
    await answer({ op: 'kv', method: 'set', args: ['seen', invocation.kind] });

    return 'ran';
  }
});

const brought = (runner: FunctionRunner): SpaceFunctions => ({
  bundle: { id: 'board-bundle', load: () => Promise.resolve('') },
  manifest: {
    hosts: [],
    tasks: [{ namespace: 'board', action: 'save', title: 'Save', params: {} }],
    routes: ['POST /save']
  },
  runner
});

describe('a plugin’s server half, brought by a plugin the space uses', () => {
  it('runs in the runner, as the plugin’s step and route, inside the plugin’s corner of kv', async () => {
    const module = moduleWith({
      lookups: {
        getAction: () => Promise.resolve(undefined),
        getPluginFunctions: () => Promise.resolve({ board: brought(kvRunner()) })
      }
    });

    expect((await module.registryFor(SPACE)).get('board.save')?.origin).toBe('plugin');
    expect((await run(module, 'board.save')).output.value).toBe('ran');
    expect(await module.kv(SPACE).get('plugin:board:seen')).toBe('task');
    expect(await module.kv(SPACE).get('seen')).toBeUndefined();

    const visit = {
      spaceId: SPACE,
      environment: 'main' as const,
      callerId: 'ip:1',
      signal: new AbortController().signal
    };
    const route = await module.routeFor(visit, 'POST', '/plugins/board/save');

    expect(route?.key).toBe('POST /save');
  });

  it('is refused when saved with a task named after something else, or a space’s route under /plugins/', () => {
    const ceilings = functionCeilings();
    const plugin = readManifest(
      { tasks: [{ namespace: 'cards', action: 'save', title: 'Save' }] },
      new Set(),
      ceilings,
      { plugin: 'board' }
    );
    const space = readManifest({ routes: ['GET /plugins/board/x'] }, new Set(), ceilings);

    expect(plugin.problems.join('\n')).toContain('namespace "board"');
    expect(space.problems.join('\n')).toContain('is under /plugins/');
  });
});
