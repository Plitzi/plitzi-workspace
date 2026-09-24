import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

import { compareRuns } from './compare';
import { measureTarget } from './measure';
import { findProfile, PROFILES } from './profiles';
import { formatChanges, formatTarget } from './report';
import { baselinePath, describeGit, describeHost, readBaseline, saveBaseline, saveResult } from './results';
import { createDockerRuntime } from './runtime/docker';
import { createLocalRuntime } from './runtime/local';
import { selectTargets, TARGETS } from './targets';

import type { RunResult } from './results';
import type { Runtime } from './runtime/types';
import type { Runner } from './targets';

const HELP = `Usage: yarn bench [options]

  --target <name>       A target, repeatable, or "all" (default): every target that needs nothing else running
  --profile <name>      A hardware profile, repeatable (default: edge-256)
  --runtime <name>      docker (default: holds the server to the profile's limits) or local (no limits, RSS)
  --concurrency <list>  Connections in flight, comma-separated (default: 1,10,50)
  --duration <s>        Seconds measured per scenario and concurrency (default: 10)
  --warmup <s>          Seconds of unmeasured load before each (default: 3)
  --runner <name>       tsx or node: run every target this way instead of its own (see targets.ts)
  --node-options="<s>"  V8/Node flags instead of the profile's own (with =, since they start with --)
  --env <KEY=VALUE>     Extra environment for the server, repeatable
  --image <name>        Docker image (default: node:24-slim)
  --save-baseline       Keep this run as the baseline for its profile and runtime
  --check               Exit non-zero when anything regressed beyond the tolerance
  --tolerance <n>       Relative change that counts, as a fraction (default: 0.1)
  --list                List targets and profiles
`;

const { values } = parseArgs({
  options: {
    target: { type: 'string', multiple: true, default: ['all'] },
    profile: { type: 'string', multiple: true, default: ['edge-256'] },
    runtime: { type: 'string', default: 'docker' },
    concurrency: { type: 'string', default: '1,10,50' },
    duration: { type: 'string', default: '10' },
    warmup: { type: 'string', default: '3' },
    runner: { type: 'string' },
    'node-options': { type: 'string' },
    env: { type: 'string', multiple: true, default: [] },
    image: { type: 'string', default: 'node:24-slim' },
    'save-baseline': { type: 'boolean', default: false },
    check: { type: 'boolean', default: false },
    tolerance: { type: 'string', default: '0.1' },
    list: { type: 'boolean', default: false },
    help: { type: 'boolean', default: false }
  }
});

const positiveNumber = (name: string, raw: string): number => {
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`--${name} must be a non-negative number, got "${raw}"`);
  }

  return value;
};

const createRuntime = (name: string): Runtime => {
  if (name === 'docker') {
    return createDockerRuntime(values.image);
  }

  if (name === 'local') {
    return createLocalRuntime();
  }

  throw new Error(`--runtime must be docker or local, got "${name}"`);
};

const parseRunner = (raw: string | undefined): Runner | undefined => {
  if (raw === undefined || raw === 'tsx' || raw === 'node') {
    return raw;
  }

  throw new Error(`--runner must be tsx or node, got "${raw}"`);
};

const parseEnv = (entries: string[]): Record<string, string> =>
  Object.fromEntries(
    entries.map(entry => {
      const separator = entry.indexOf('=');
      if (separator <= 0) {
        throw new Error(`--env takes KEY=VALUE, got "${entry}"`);
      }

      return [entry.slice(0, separator), entry.slice(separator + 1)];
    })
  );

const list = (): void => {
  console.log('Targets:');
  for (const target of TARGETS) {
    console.log(
      `  ${target.name.padEnd(20)} ${target.description}${target.requires ? ` (needs ${target.requires})` : ''}`
    );
  }

  console.log('\nProfiles:');
  for (const profile of PROFILES) {
    console.log(`  ${profile.name.padEnd(20)} ${profile.description}`);
  }
};

const main = async (): Promise<number> => {
  if (values.help) {
    console.log(HELP);

    return 0;
  }

  if (values.list) {
    list();

    return 0;
  }

  const workspaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
  const runtime = createRuntime(values.runtime);
  const targets = selectTargets(values.target);
  const profiles = values.profile.map(findProfile);
  const concurrency = values.concurrency.split(',').map(level => positiveNumber('concurrency', level));
  const durationMs = positiveNumber('duration', values.duration) * 1000;
  const warmupMs = positiveNumber('warmup', values.warmup) * 1000;
  const tolerance = positiveNumber('tolerance', values.tolerance);
  const runner = parseRunner(values.runner);
  const env = parseEnv(values.env);
  const runtimeDetails = await runtime.describe();
  const git = await describeGit(workspaceRoot);
  let regressed = false;

  if (
    !runtime.enforcesLimits &&
    profiles.some(profile => profile.cpus !== undefined || profile.memoryMb !== undefined)
  ) {
    console.log(
      'Note: the local runtime applies no limits — only the profile’s Node flags. Use docker to size hardware.'
    );
  }

  for (const profile of profiles) {
    const nodeOptions = values['node-options']?.split(' ').filter(Boolean) ?? profile.nodeOptions;
    console.log(
      `\n══ ${profile.name} (${profile.description}) on ${runtime.name} — node options: ${nodeOptions.join(' ') || 'none'}`
    );
    const result: RunResult = {
      date: new Date().toISOString(),
      profile,
      runtime: { name: runtime.name, enforcesLimits: runtime.enforcesLimits, details: runtimeDetails },
      git,
      host: describeHost(),
      options: { concurrency, durationMs, warmupMs, nodeOptions, env },
      targets: []
    };

    for (const target of targets) {
      console.log(`\n… ${target.name}`);
      const measured = await measureTarget(
        runtime,
        target,
        profile,
        { workspaceRoot, runner, concurrency, durationMs, warmupMs, nodeOptions, env },
        line => console.log(`    ${line}`)
      );
      result.targets.push(measured);
      console.log(formatTarget(measured));
    }

    console.log(`\nSaved ${path.relative(workspaceRoot, saveResult(workspaceRoot, result))}`);
    const baselineFile = baselinePath(workspaceRoot, profile.name, runtime.name);
    const baseline = readBaseline(baselineFile);
    if (baseline) {
      if (baseline.host.cpu !== result.host.cpu) {
        console.log(`Note: the baseline was measured on "${baseline.host.cpu}"; numbers across machines differ.`);
      }

      const changes = compareRuns(baseline.targets, result.targets, tolerance);
      console.log(`\nAgainst ${path.relative(workspaceRoot, baselineFile)} (${baseline.git.commit}):`);
      console.log(formatChanges(changes));
      regressed ||= changes.some(change => change.verdict === 'regression');
    }

    if (values['save-baseline']) {
      saveBaseline(baselineFile, result);
      console.log(`Baseline written: ${path.relative(workspaceRoot, baselineFile)}`);
    }
  }

  return values.check && regressed ? 1 : 0;
};

process.exitCode = await main();
