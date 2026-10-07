import fs from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';

import { WORKSPACE, mcpFixture, projectFixture, scratch } from './fixtures';
import { overheadOf, parseModel, runAgent } from './harness';
import { measureRun } from './metrics';
import { reportMarkdown } from './report';
import { TASKS } from './tasks';

import type { Fixture } from './fixtures';
import type { Context, Model } from './harness';
import type { RunResult } from './report';
import type { Scenario, Task } from './tasks';

const HELP = `Usage: yarn agents --model <label> [options]

The agent benchmark of RFC 0025: each task run by each model in its harness, checked on the result, and the floor —
the smallest model and context as good as the first — found. It spends tokens: nothing runs without --model.

  --model <label>     A rung of the ladder, largest first, repeatable: claude:claude-haiku-4-5-20251001,
                      opencode:ollama/qwen3.6:latest. The first is the reference the others are held to.
  --task <id>         Only this task, repeatable (${TASKS.map(task => task.id).join(', ')})
  --context <level>   none (no skills), core (as shipped, the default) or full (every reference up front), repeatable
  --runs <n>          Runs of each task per configuration (default 3; 5 before trusting a floor)
  --max-turns <n>     The harness's own limit on turns (default 30)
  --timeout <min>     Minutes a run may take before it is stopped (default 15)
  --dry-run           Say what would run, and run nothing
  --report <dir>      Write the report again from a run's results/agents/<dir>/runs.jsonl, and run nothing`;

const RESULTS = path.join(WORKSPACE, 'bench/results/agents');

const CONTEXTS: readonly Context[] = ['none', 'core', 'full'];

const isContext = (value: string): value is Context => CONTEXTS.some(context => context === value);

/** Every reference of the skills an agent can open, in one file: what the `full` context hands it up front. */
const referencesFile = async (): Promise<string> => {
  const folders = [
    path.join(WORKSPACE, 'packages/sdk-authoring/skills/plitzi-authoring'),
    path.join(WORKSPACE, 'packages/sdk-authoring/skills/plitzi-authoring/reference'),
    path.join(WORKSPACE, 'apps/cli/skills/plitzi-cli/reference')
  ];
  const pages: string[] = [];
  for (const folder of folders) {
    for (const file of (await fs.readdir(folder)).filter(name => name.endsWith('.md')).sort()) {
      pages.push(await fs.readFile(path.join(folder, file), 'utf-8'));
    }
  }

  const file = path.join(await scratch('references'), 'references.md');
  await fs.writeFile(file, pages.join('\n\n'));

  return file;
};

const readResults = async (dir: string): Promise<RunResult[]> =>
  (await fs.readFile(path.join(RESULTS, dir, 'runs.jsonl'), 'utf-8'))
    .split('\n')
    .filter(line => line.trim() !== '')
    .map(line => JSON.parse(line) as RunResult);

interface Plan {
  models: { label: string; model: Model }[];
  tasks: Task[];
  contexts: Context[];
  runs: number;
  maxTurns: number;
  timeoutMs: number;
}

const runOne = async (
  plan: Plan,
  label: string,
  model: Model,
  context: Context,
  task: Task,
  run: number,
  overhead: number,
  references: string
): Promise<RunResult> => {
  const fixture: Fixture = task.scenario === 'mcp' ? await mcpFixture() : await projectFixture();
  const workDir = task.scenario === 'mcp' ? await scratch('agent') : fixture.dir;
  try {
    await task.setup?.(fixture.dir);
    const record = await runAgent({
      model,
      scenario: task.scenario,
      prompt: task.prompt,
      dir: workDir,
      ...(fixture.mcpUrl ? { mcpUrl: fixture.mcpUrl } : {}),
      context,
      references,
      maxTurns: plan.maxTurns,
      timeoutMs: plan.timeoutMs
    });
    const check = await task.check(fixture.dir);

    return {
      model: label,
      context,
      task: task.id,
      run,
      check,
      // The ceiling is the reference's, known once it has run: the report applies it.
      metrics: measureRun({ record, check, overhead, ceiling: Number.POSITIVE_INFINITY })
    };
  } finally {
    await fixture.stop();
    if (workDir !== fixture.dir) {
      await fs.rm(workDir, { recursive: true, force: true });
    }
  }
};

const main = async (): Promise<void> => {
  const { values } = parseArgs({
    options: {
      model: { type: 'string', multiple: true },
      task: { type: 'string', multiple: true },
      context: { type: 'string', multiple: true },
      runs: { type: 'string' },
      'max-turns': { type: 'string' },
      timeout: { type: 'string' },
      'dry-run': { type: 'boolean' },
      report: { type: 'string' },
      help: { type: 'boolean' }
    }
  });

  if (values.help) {
    console.log(HELP);

    return;
  }

  if (values.report) {
    const results = await readResults(values.report);
    await fs.writeFile(path.join(RESULTS, values.report, 'report.md'), reportMarkdown(results));
    console.log(reportMarkdown(results));

    return;
  }

  const labels = values.model ?? [];
  const models = labels.map(label => ({ label, model: parseModel(label) }));
  const unknown = models.filter(entry => !entry.model).map(entry => entry.label);
  const tasks = values.task ? TASKS.filter(task => values.task?.includes(task.id)) : [...TASKS];
  const contexts = values.context ?? ['core'];
  if (labels.length === 0 || unknown.length > 0 || tasks.length === 0 || !contexts.every(isContext)) {
    console.error(
      labels.length === 0
        ? `Name the models to run — it spends tokens.\n\n${HELP}`
        : unknown.length > 0
          ? `Not a model label: ${unknown.join(', ')} (claude:<model> or opencode:<provider>/<model>).`
          : tasks.length === 0
            ? `No task is called ${values.task?.join(', ') ?? ''}: ${TASKS.map(task => task.id).join(', ')}.`
            : `--context takes ${CONTEXTS.join(', ')}.`
    );
    process.exitCode = 1;

    return;
  }

  const plan: Plan = {
    models: models.flatMap(entry => (entry.model ? [{ label: entry.label, model: entry.model }] : [])),
    tasks,
    contexts: contexts.filter(isContext),
    runs: Number(values.runs ?? 3),
    maxTurns: Number(values['max-turns'] ?? 30),
    timeoutMs: Number(values.timeout ?? 15) * 60 * 1000
  };
  const total = plan.models.length * plan.contexts.length * plan.tasks.length * plan.runs;
  console.log(
    `${String(total)} runs: ${plan.models.map(entry => entry.label).join(' > ')} × ${plan.contexts.join(', ')} × ${plan.tasks.map(task => task.id).join(', ')} × ${String(plan.runs)}`
  );
  if (values['dry-run']) {
    return;
  }

  const dir = path.join(RESULTS, new Date().toISOString().replace(/[:.]/g, '-'));
  await fs.mkdir(dir, { recursive: true });
  const references = await referencesFile();
  const results: RunResult[] = [];
  for (const { label, model } of plan.models) {
    const overheads = new Map<Scenario, number>();
    for (const scenario of new Set(plan.tasks.map(task => task.scenario))) {
      overheads.set(scenario, await overheadOf(model, scenario, plan.timeoutMs));
    }

    for (const context of plan.contexts) {
      for (const task of plan.tasks) {
        for (let run = 1; run <= plan.runs; run++) {
          const result = await runOne(
            plan,
            label,
            model,
            context,
            task,
            run,
            overheads.get(task.scenario) ?? 0,
            references
          );
          results.push(result);
          await fs.appendFile(path.join(dir, 'runs.jsonl'), `${JSON.stringify(result)}\n`);
          console.log(
            `${result.check.ok ? 'ok  ' : 'FAIL'} ${label} @ ${context} ${task.id} #${String(run)} — ${String(result.metrics.netTokens)} net tokens, ${String(result.metrics.turns)} turns, ${String(result.metrics.refusals)} refused${result.check.why ? ` — ${result.check.why}` : ''}`
          );
        }
      }
    }
  }

  await fs.writeFile(path.join(dir, 'report.md'), reportMarkdown(results));
  console.log(`\n${reportMarkdown(results)}\n\nSaved in ${path.relative(WORKSPACE, dir)}`);
};

await main();
