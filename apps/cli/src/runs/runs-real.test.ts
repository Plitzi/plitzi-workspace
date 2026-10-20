import fs from 'node:fs/promises';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { showVersion } from './merge';
import { buildReport } from './report';
import { loadRun, resumeRun, stopRun } from './run';
import {
  claimFile,
  completeTask,
  followWait,
  reportProgress,
  requestShared,
  reviewTask,
  taskContext,
  waitForFile
} from './tasks';
import { DEFAULTS } from './taskStore';
import { viewRun } from './view';
import { makeBench, readInCopy, writeInCopy } from '../tests/runProject';
import { runSteps } from '../tests/runSteps';

import type { RunPlan } from './model';
import type { Bench } from '../tests/runProject';

/** What the first real runs taught, kept as tests. */

let bench: Bench;

beforeEach(async () => {
  bench = await makeBench();
});

afterEach(async () => {
  await bench.cleanup();
});

const { refusal, lead, open, take, doTask } = runSteps(() => bench);

/** The plan of the first real run's project: a shell holding the entry, then pages that register in it. */
const shellPlan = (): RunPlan => ({
  version: 1,
  runId: 'shell-run',
  goal: 'A shell, then pages',
  tasks: [
    {
      id: 't-shell',
      title: 'The shell',
      files: ['src/space/index.ts', 'src/data/pets.json'],
      dependsOn: [],
      priority: 'critical',
      estimateMinutes: 10,
      acceptance: []
    },
    ...['a', 'b'].map(name => ({
      id: `t-${name}`,
      title: `Page ${name}`,
      files: [`src/space/pages/${name}.ts`],
      dependsOn: ['t-shell'],
      priority: 'medium' as const,
      estimateMinutes: 10,
      acceptance: []
    }))
  ]
});

const register = (index: string, name: string): string =>
  index
    .replace(
      /^(import \{ about \} from .\.\/pages\/about\.ts.;)$/m,
      `$1\nimport { ${name} } from './pages/${name}.ts';`
    )
    .replace('pages: [home, menu, book, about]', `pages: [home, menu, book, about, ${name}]`);

describe('what the first real runs taught', () => {
  it('a shared file in a done task’s plan goes to whoever completes first; the same line changed by both is integrated, its diff what was asked', async () => {
    await open(shellPlan());
    await doTask(
      'agent-0',
      't-shell',
      'src/data/pets.json',
      `{ "items": [{ "id": "luna" }] }
`,
      'shell-run'
    );
    const outcomes = [];
    for (const name of ['a', 'b']) {
      const held = await take(`agent-${name}`, `t-${name}`, 'shell-run');
      await writeInCopy(
        held.work,
        `src/space/pages/${name}.ts`,
        `export const ${name} = { id: '${name}' };
`
      );
      await writeInCopy(
        held.work,
        'src/space/index.ts',
        register((await readInCopy(held.work, 'src/space/index.ts')) ?? '', name)
      );
      outcomes.push(await completeTask(held.ctx, 'shell-run', `t-${name}`));
    }

    expect(outcomes.map(each => [each.claimed, each.requests.map(request => request.file)])).toEqual([
      [['src/space/index.ts'], []],
      [[], ['src/space/index.ts']]
    ]);
    await reviewTask(lead(), 'shell-run', 't-a', 'approve', []);
    const approved = await reviewTask(lead(), 'shell-run', 't-b', 'approve', []);
    expect(approved.integrations).toEqual(['integrate-src-space-index-ts']);

    const integrator = await take('agent-i', 'integrate-src-space-index-ts', 'shell-run');
    const context = await taskContext(integrator.ctx, 'shell-run', 'integrate-src-space-index-ts');
    expect(context.requests.map(each => each.task)).toEqual(['t-b']);
    expect(context.requests[0].diff).toMatch(/^\+import \{ b \} from .\.\/pages\/b\.ts.;$/m);
    expect(context.requests[0].diff).not.toMatch(/^-import/m);
  });

  it('a request on a file another task holds by turns waits for it, and goes in when that task lets go of it', async () => {
    await bench.write(
      'src/space/index.ts',
      `import { home } from './pages/home/index.ts';

export const space = {
  pages: [
    home
  ]
};
`
    );
    await open(shellPlan());
    await doTask(
      'agent-0',
      't-shell',
      'src/data/pets.json',
      `{ "items": [] }
`,
      'shell-run'
    );
    const a = await take('agent-a', 't-a', 'shell-run');
    const b = await take('agent-b', 't-b', 'shell-run');
    await claimFile(a.ctx, 'shell-run', 't-a', 'src/space/index.ts');
    for (const [task, name] of [
      [a, 'a'],
      [b, 'b']
    ] as const) {
      await writeInCopy(
        task.work,
        `src/space/pages/${name}.ts`,
        `export const ${name} = {};
`
      );
      const index = (await readInCopy(task.work, 'src/space/index.ts')) ?? '';
      await writeInCopy(
        task.work,
        'src/space/index.ts',
        index
          .replace(/(from .\.\/pages\/home\/index\.ts.;)/, `$1\nimport { ${name} } from './pages/${name}.ts';`)
          .replace('    home\n', `    home,\n    ${name}\n`)
      );
    }

    await completeTask(b.ctx, 'shell-run', 't-b');
    expect((await reviewTask(lead(), 'shell-run', 't-b', 'approve', [])).integrations).toEqual([]);
    await completeTask(a.ctx, 'shell-run', 't-a');
    const approved = await reviewTask(lead(), 'shell-run', 't-a', 'approve', []);

    expect(approved.settled).toEqual(['t-b/src-space-index-ts']);
    const index = (await showVersion(bench.person(), 'shell-run', 'src/space/index.ts', 'run'))?.toString() ?? '';
    expect(index).toMatch(/import \{ a \}/);
    expect(index).toMatch(/import \{ b \}/);
  });

  it('pages registered on lines of their own go in as each task is approved: no integration at all', async () => {
    await bench.write(
      'src/space/index.ts',
      `import { home } from './pages/home/index.ts';

export const space = {
  pages: [
    home
  ]
};
`
    );
    await open(shellPlan());
    await doTask(
      'agent-0',
      't-shell',
      'src/data/pets.json',
      `{ "items": [] }
`,
      'shell-run'
    );
    const held = [];
    for (const name of ['a', 'b']) {
      const task = await take(`agent-${name}`, `t-${name}`, 'shell-run');
      await writeInCopy(
        task.work,
        `src/space/pages/${name}.ts`,
        `export const ${name} = {};
`
      );
      const index = (await readInCopy(task.work, 'src/space/index.ts')) ?? '';
      await writeInCopy(
        task.work,
        'src/space/index.ts',
        index
          .replace(/(from .\.\/pages\/home\/index\.ts.;)/, `$1\nimport { ${name} } from './pages/${name}.ts';`)
          .replace('    home\n', `    home,\n    ${name}\n`)
      );
      held.push(task);
    }

    for (const task of held) {
      await completeTask(task.ctx, 'shell-run', task.task.id);
    }

    await reviewTask(lead(), 'shell-run', 't-a', 'approve', []);
    expect((await reviewTask(lead(), 'shell-run', 't-b', 'approve', [])).integrations).toEqual([]);
    const index = (await showVersion(bench.person(), 'shell-run', 'src/space/index.ts', 'run'))?.toString() ?? '';
    expect(index).toMatch(/import \{ a \}/);
    expect(index).toMatch(/import \{ b \}/);
  });

  it('a request on a file the task then held by turns is fulfilled when it is approved: no integration for it', async () => {
    await open(shellPlan());
    await doTask(
      'agent-0',
      't-shell',
      'src/data/pets.json',
      `{ "items": [] }
`,
      'shell-run'
    );
    const a = await take('agent-a', 't-a', 'shell-run');
    await requestShared(a.ctx, 'shell-run', 't-a', 'src/space/index.ts', {
      summary: 'register a',
      usedIn: [],
      blocking: false
    });
    await claimFile(a.ctx, 'shell-run', 't-a', 'src/space/index.ts');
    await writeInCopy(
      a.work,
      'src/space/pages/a.ts',
      `export const a = {};
`
    );
    await writeInCopy(
      a.work,
      'src/space/index.ts',
      register((await readInCopy(a.work, 'src/space/index.ts')) ?? '', 'a')
    );
    await completeTask(a.ctx, 'shell-run', 't-a');
    const approved = await reviewTask(lead(), 'shell-run', 't-a', 'approve', []);

    expect(approved.integrations).toEqual([]);
    expect((await viewRun(lead(), 'shell-run')).attention.some(item => item.kind === 'request')).toBe(false);
  });

  it('a file handed on by turns arrives with what the run approved since the copy was made', async () => {
    await open(shellPlan());
    await doTask(
      'agent-0',
      't-shell',
      'src/data/pets.json',
      `{ "items": [] }
`,
      'shell-run'
    );
    const a = await take('agent-a', 't-a', 'shell-run');
    const b = await take('agent-b', 't-b', 'shell-run');
    await claimFile(a.ctx, 'shell-run', 't-a', 'src/space/index.ts');
    await waitForFile(b.ctx, 'shell-run', 't-b', 'src/space/index.ts');
    await writeInCopy(
      a.work,
      'src/space/pages/a.ts',
      `export const a = {};
`
    );
    await writeInCopy(
      a.work,
      'src/space/index.ts',
      register((await readInCopy(a.work, 'src/space/index.ts')) ?? '', 'a')
    );
    await completeTask(a.ctx, 'shell-run', 't-a');
    await reviewTask(lead(), 'shell-run', 't-a', 'approve', []);

    expect(await readInCopy(b.work, 'src/space/index.ts')).toMatch(/from .\.\/pages\/a\.ts./);
    expect(await readInCopy(b.work, 'src/space/pages/a.ts')).toContain('export const a');
    const followed = await followWait(b.ctx, 'shell-run', 't-b', { timeoutMs: 1000, everyMs: 10 });
    expect(followed.done).toBe(true);
    expect(followed.note).toContain('Brought into your copy, approved since it was made: src/space/pages/a.ts');
  });

  it('complete brings in what was approved meanwhile before its checks, and a folder’s .gitkeep is the task’s to remove', async () => {
    await bench.write('src/data/.gitkeep', '');
    await open(shellPlan());
    const shell = await take('agent-0', 't-shell', 'shell-run');
    await fs.rm(path.join(shell.work, 'src/data/.gitkeep'));
    await writeInCopy(
      shell.work,
      'src/data/pets.json',
      `{ "items": [] }
`
    );
    expect((await completeTask(shell.ctx, 'shell-run', 't-shell')).changed).toEqual([
      'src/data/.gitkeep',
      'src/data/pets.json'
    ]);
  });

  it('the brake waits for enough to judge, resuming clears what it saw, and the report says it stopped', async () => {
    await open();
    const home = await take('agent-1', 't-home');
    await writeInCopy(home.work, 'src/space/pages/menu.ts', 'export const menu = {};\n');
    await refusal(completeTask(home.ctx, 'es-launch', 't-home'));
    await refusal(completeTask(home.ctx, 'es-launch', 't-home'));
    expect((await loadRun(lead(), 'es-launch')).record.status).toBe('open');

    await stopRun(lead(), 'es-launch', false);
    expect((await viewRun(lead(), 'es-launch')).attention.find(item => item.kind === 'stopping')?.text).toContain(
      'stopped by lead'
    );
    await resumeRun(lead(), 'es-launch');
    expect((await loadRun(lead(), 'es-launch')).record.brake).toEqual([]);
    const report = await buildReport(lead(), await loadRun(lead(), 'es-launch'));
    expect(report.stops).toMatchObject([{ reason: 'stopped by lead', by: 'lead' }]);
  });

  it('a heartbeat says when the task can be reassigned and taken; run status lists tasks in the plan’s order', async () => {
    await open();
    const home = await take('agent-1', 't-home');
    const signal = await reportProgress(home.ctx, 'es-launch', 't-home', {});

    expect(Date.parse(signal.quietAfter) - Date.parse(signal.at)).toBe(DEFAULTS.noSignalMs);
    expect(Date.parse(signal.takenAfter) - Date.parse(signal.quietAfter)).toBe(DEFAULTS.lockAfterSignalMs);
    expect((await viewRun(lead(), 'es-launch')).tasks.map(task => task.id)).toEqual([
      't-home',
      't-menu',
      't-book',
      't-about'
    ]);
  });
});
