import { describe, expect, it } from 'vitest';

import { createFunctionsEnvironment } from './functionsEnvironment';
import { describeSource, withNewTask, withTaskLimits } from './source';
import { workerPathOf } from './useFunctionsTypeScript';

const environmentWith = (files: Record<string, string>) => {
  const env = createFunctionsEnvironment();
  Object.entries(files).forEach(([file, code]) => env.createFile(workerPathOf(file), code));

  return env;
};

const FEED = `import type { FunctionTask } from '@plitzi/sdk-server/functions';

export const feedTask: FunctionTask<{ window: string }> = {
  namespace: 'seismic',
  action: 'feed',
  title: 'Seismic Feed',
  description: 'Every earthquake in a window.',
  params: {
    window: {
      type: 'select',
      label: 'Window',
      defaultValue: 'day',
      options: [
        { label: 'Day', value: 'day' },
        { label: 'Week', value: 'week' }
      ]
    }
  },
  run: async ({ window }) => window
};
`;

const INDEX = `import { defineFunctions } from '@plitzi/sdk-server/functions';

import { feedTask } from './lib/feed';

export default defineFunctions({
  allow: { hosts: ['earthquake.usgs.gov'] },
  limits: { wallMs: 20_000 },
  tasks: [
    feedTask,
    {
      namespace: 'seismic',
      action: 'detail',
      title: 'Seismic Detail',
      params: { id: { type: 'text', label: 'Event id', defaultValue: '' } },
      limits: { cpuMs: 300 },
      run: async ({ id }: { id: string }) => id
    }
  ],
  routes: {
    'GET /quakes/:id': async () => new Response('ok')
  }
});
`;

describe('what the source declares, read as it is written', () => {
  it('reads tasks written in place and the ones a constant in another file holds, with routes, hosts and limits', () => {
    const read = describeSource(environmentWith({ 'index.ts': INDEX, 'lib/feed.ts': FEED }));

    expect(read).toMatchObject({
      defined: true,
      hosts: ['earthquake.usgs.gov'],
      limits: { wallMs: 20000 },
      routes: [{ key: 'GET /quakes/:id', at: { file: 'index.ts' } }],
      unreadable: []
    });
    expect(read.tasks).toMatchObject([
      {
        namespace: 'seismic',
        action: 'feed',
        title: 'Seismic Feed',
        description: 'Every earthquake in a window.',
        params: { window: { type: 'select', defaultValue: 'day', options: [{ value: 'day' }, { value: 'week' }] } },
        at: { file: 'lib/feed.ts', line: 3 }
      },
      { namespace: 'seismic', action: 'detail', limits: { cpuMs: 300 }, at: { file: 'index.ts' } }
    ]);
  });

  it('says what it cannot read without running it, and reads nothing where nothing is defined', () => {
    const built = INDEX.replace('feedTask,', 'makeTask(),').replace(
      /^import \{ feedTask \}.*$/m,
      'const makeTask = () => ({ namespace: "x", action: "y", title: "Y", params: {}, run: () => 1 });'
    );

    expect(describeSource(environmentWith({ 'index.ts': built })).unreadable).toMatchObject([{ what: 'makeTask()' }]);
    expect(describeSource(environmentWith({ 'index.ts': 'export const nothing = 1;' })).defined).toBe(false);
  });
});

describe('a task asking for its time', () => {
  it('is written a limit before its run, changed in place, and has it taken out to run with the default', () => {
    const env = environmentWith({ 'index.ts': INDEX, 'lib/feed.ts': FEED });
    const [feed, detail] = describeSource(env).tasks;

    const added = withTaskLimits(env, feed.at, { cpuMs: 800 });
    expect(added?.file).toBe('lib/feed.ts');
    expect(added?.code).toContain('  },\n  limits: { cpuMs: 800 },\n  run: async ({ window }) => window');

    const changed = withTaskLimits(env, detail.at, { cpuMs: 1000 });
    expect(changed?.code).toContain('limits: { cpuMs: 1000 },');
    expect(changed?.code).not.toContain('cpuMs: 300');

    const removed = withTaskLimits(env, detail.at, {});
    expect(removed?.code).not.toContain('limits: { cpuMs');
    expect(removed?.code).toContain(`      params: { id: { type: 'text', label: 'Event id', defaultValue: '' } },
      run:`);
  });

  it('is read back as it was written', () => {
    const env = environmentWith({ 'index.ts': INDEX, 'lib/feed.ts': FEED });
    const edit = withTaskLimits(env, describeSource(env).tasks[0].at, { cpuMs: 450 });
    env.updateFile(workerPathOf('lib/feed.ts'), edit?.code ?? '');

    expect(describeSource(env).tasks[0].limits).toEqual({ cpuMs: 450 });
  });
});

describe('a new task', () => {
  it('goes at the end of the list, and is read back at once', () => {
    const env = environmentWith({ 'index.ts': INDEX, 'lib/feed.ts': FEED });
    const edit = withNewTask(env, { namespace: 'seismic', action: 'stats', title: 'Seismic Stats' });
    env.updateFile(workerPathOf('index.ts'), edit?.code ?? '');

    expect(describeSource(env).tasks.map(task => `${task.namespace}.${task.action}`)).toEqual([
      'seismic.feed',
      'seismic.detail',
      'seismic.stats'
    ]);
  });

  it('writes a list kept on one line again one task a line, in the quotes the file uses', () => {
    const inline = INDEX.replace(/tasks: \[[\s\S]*?\n {2}\],/, 'tasks: [feedTask],');
    const env = environmentWith({ 'index.ts': inline, 'lib/feed.ts': FEED });
    const edit = withNewTask(env, { namespace: 'seismic', action: 'stats', title: 'Today\u0027s stats' });

    expect(edit?.code).toContain(`  tasks: [
    feedTask,
    {
      namespace: 'seismic',
      action: 'stats',
      title: 'Today\\'s stats',`);
    env.updateFile(workerPathOf('index.ts'), edit?.code ?? '');
    expect(describeSource(env).tasks.map(task => task.title)).toEqual(['Seismic Feed', 'Today\u0027s stats']);
  });

  it('starts the list when there is none', () => {
    const empty = `import { defineFunctions } from '@plitzi/sdk-server/functions';

export default defineFunctions({
  allow: { hosts: [] }
});
`;
    const env = environmentWith({ 'index.ts': empty });
    const edit = withNewTask(env, { namespace: 'hello', action: 'greet', title: 'Greet' });
    env.updateFile(workerPathOf('index.ts'), edit?.code ?? '');

    expect(describeSource(env).tasks).toMatchObject([{ namespace: 'hello', action: 'greet', title: 'Greet' }]);
  });
});
