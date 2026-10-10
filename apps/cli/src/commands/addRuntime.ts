import fs from 'node:fs/promises';
import path from 'node:path';

import chalk from 'chalk';

import { isRecord } from '@plitzi/sdk-shared/helpers/isRecord';

import { filesWouldWrite, sayDryRun } from './dryRun';
import { findProject } from './existingProject';
import { projectFormatter } from './projectFormatter';
import { readScaffoldRecord, writeScaffoldRecord } from './scaffoldRecord';
import { readOrigin } from './spaceOrigin';
import { fail, writeFiles } from './terminal';
import { answersFor } from './upgrade';
import { RUNTIME_DIR, RUNTIME_ENTRY } from '../scaffold/paths';
import { CLI_VERSION, projectScripts } from '../scaffold/project';

import type { DryRunOptions } from './dryRun';

/**
 * `plitzi runtime add`: the space's runtime — its own server code, run as a process of its own beside the space on the
 * platform (`plitzi runtime push`) — written where the project's server runs it too (`src/runtime/index.ts`), so what
 * is pushed is what was tried. Only in a server-mode project: a project with no server has nothing to run it in.
 */

export interface AddRuntimeOptions extends DryRunOptions {
  force?: boolean;
}

const RUNTIME_MODULE = `import { defineRuntime } from '@plitzi/sdk-server/runtime';

/**
 * The space's runtime: its own server code, run as a process of its own beside the space on Plitzi (\`plitzi runtime
 * push\`), and in this project's server while developing (\`npm start\`). \`start\` is handed its variables — set with
 * \`plitzi runtime vars set\` on the platform, this process's environment here — and answers what it serves:
 *
 * - \`endpoints\`: paths it answers on the space's own host, each with everything beneath it.
 * - \`functions\`: tasks a server action's steps run, and routes under \`/fn/\` (\`defineFunctions\`).
 * - \`close\`: what to close of what \`start\` opened.
 *
 * A file per part beside this one, as it grows.
 */
export default defineRuntime({
  start: () => ({
    endpoints: {
      '/hello': () => Response.json({ hello: 'from the runtime' })
    }
  })
});
`;

/** The scripts that restart the server on its own code: a runtime is one folder more each of them watches. */
const WATCHING = ['start:dev', 'start:dev-inspect'] as const;

type WatchingPlan = {
  /** The CLI's own scripts, as they are rewritten to restart on the runtime too. */
  changed: Record<string, string>;
  /** `package.json` with the CLI's own scripts brought to restart on the runtime too — none when nothing changes. */
  script?: string;
  /** The ones the project changed itself: said, not rewritten. */
  yours: { name: string; command: string }[];
};

/** The watching scripts brought to restart on the runtime too — those that are the CLI's; one the project changed is said. */
const planWatching = async (root: string, answers: Awaited<ReturnType<typeof answersFor>>): Promise<WatchingPlan> => {
  const withRuntime = projectScripts({ ...answers, runtime: true });
  const without = projectScripts({ ...answers, runtime: false });
  const recorded = (await readScaffoldRecord(root))?.scripts ?? {};
  const manifest: unknown = JSON.parse(await fs.readFile(path.join(root, 'package.json'), 'utf-8'));
  const scripts = isRecord(manifest) && isRecord(manifest.scripts) ? manifest.scripts : {};
  const changed: Record<string, string> = {};
  const yours: WatchingPlan['yours'] = [];
  for (const name of WATCHING) {
    const current = scripts[name];
    if (typeof current !== 'string' || current === withRuntime[name]) {
      continue;
    }

    if (current === without[name] || current === recorded[name]) {
      changed[name] = withRuntime[name];
    } else {
      yours.push({ name, command: current });
    }
  }

  if (Object.keys(changed).length === 0) {
    return { changed, yours };
  }

  const next = { ...(isRecord(manifest) ? manifest : {}), scripts: { ...scripts, ...changed } };

  return { changed, script: `${JSON.stringify(next, null, 2)}\n`, yours };
};

const addRuntime = async (options: AddRuntimeOptions): Promise<void> => {
  const project = await findProject(process.cwd());
  const plitzi = project?.plitzi?.kind === 'project' ? project.plitzi : undefined;
  if (!project || !plitzi) {
    fail('plitzi runtime add adds to a project plitzi create wrote, and this is not one.');

    return;
  }

  if (plitzi.mode !== 'server') {
    fail(
      'A runtime runs beside a server, and this project has none (`--mode client`): its code would run nowhere here.'
    );

    return;
  }

  const target = path.join(project.root, RUNTIME_ENTRY);
  const exists = await fs.access(target).then(
    () => true,
    () => false
  );
  if (exists && !options.force) {
    fail(`${RUNTIME_ENTRY} is already there: it is the project's runtime. Pass --force to write over it.`);

    return;
  }

  const answers = await answersFor(
    project.root,
    plitzi,
    project.packageManager ?? 'npm',
    (await readOrigin(project.root)) !== undefined
  );
  const format = await projectFormatter(project.root);
  const module = await format(RUNTIME_ENTRY, RUNTIME_MODULE);
  const watching = await planWatching(project.root, answers);

  if (options.dryRun) {
    sayDryRun('plitzi runtime add', [
      ...(await filesWouldWrite(project.root, [RUNTIME_ENTRY])),
      ...(watching.script ? [`~ package.json — ${WATCHING.join(' and ')} restart on ${RUNTIME_DIR}/ too`] : [])
    ]);

    return;
  }

  await writeFiles(project.root, {
    [RUNTIME_ENTRY]: module,
    ...(watching.script ? { 'package.json': watching.script } : {})
  });
  if (watching.script) {
    const recorded = (await readScaffoldRecord(project.root))?.scripts ?? {};
    await writeScaffoldRecord(project.root, CLI_VERSION, { scripts: { ...recorded, ...watching.changed } });
  }

  console.log(chalk.green(`\n${RUNTIME_ENTRY} — the space's runtime`));
  console.log(
    '\nThe server runs it — `/hello` answers on this project — and `plitzi runtime push` sends it to the space: ' +
      'the same module, tried here before it goes.'
  );
  for (const { name, command } of watching.yours) {
    console.log(
      chalk.yellow(
        `\n${name} is yours ("${command}"): add --watch-path=./${RUNTIME_DIR} to it, for a save to the runtime to restart the server.`
      )
    );
  }

  console.log('');
};

export default addRuntime;
