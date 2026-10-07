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

/** `start:dev` brought to restart on the runtime too — when it is the CLI's; one the project changed is said, not rewritten. */
const planStartDev = async (
  root: string,
  answers: Awaited<ReturnType<typeof answersFor>>
): Promise<{ command: string; script?: string; yours?: string }> => {
  const command = projectScripts({ ...answers, runtime: true })['start:dev'];
  const text = await fs.readFile(path.join(root, 'package.json'), 'utf-8');
  const manifest: unknown = JSON.parse(text);
  const scripts = isRecord(manifest) && isRecord(manifest.scripts) ? manifest.scripts : {};
  const current = scripts['start:dev'];
  if (current === command) {
    return { command };
  }

  const recorded = (await readScaffoldRecord(root))?.scripts?.['start:dev'];
  const theCli = current === projectScripts({ ...answers, runtime: false })['start:dev'] || current === recorded;
  if (typeof current === 'string' && theCli) {
    const next = { ...(isRecord(manifest) ? manifest : {}), scripts: { ...scripts, 'start:dev': command } };

    return { command, script: `${JSON.stringify(next, null, 2)}\n` };
  }

  return { command, yours: typeof current === 'string' ? current : '' };
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
  const startDev = await planStartDev(project.root, answers);

  if (options.dryRun) {
    sayDryRun('plitzi runtime add', [
      ...(await filesWouldWrite(project.root, [RUNTIME_ENTRY])),
      ...(startDev.script ? ['~ package.json — start:dev restarts on src/runtime/ too'] : [])
    ]);

    return;
  }

  await writeFiles(project.root, {
    [RUNTIME_ENTRY]: module,
    ...(startDev.script ? { 'package.json': startDev.script } : {})
  });
  if (startDev.script) {
    const recorded = (await readScaffoldRecord(project.root))?.scripts ?? {};
    await writeScaffoldRecord(project.root, CLI_VERSION, { scripts: { ...recorded, 'start:dev': startDev.command } });
  }

  console.log(chalk.green(`\n${RUNTIME_ENTRY} — the space's runtime`));
  console.log(
    '\nThe server runs it — `/hello` answers on this project — and `plitzi runtime push` sends it to the space: ' +
      'the same module, tried here before it goes.'
  );
  if (startDev.yours !== undefined) {
    console.log(
      chalk.yellow(
        `\nstart:dev is yours ("${startDev.yours}"): add --watch-path=./${RUNTIME_DIR} to it, for a save to the runtime to restart the server.`
      )
    );
  }

  console.log('');
};

export default addRuntime;
