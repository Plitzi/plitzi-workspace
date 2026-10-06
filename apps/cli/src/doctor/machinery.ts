import { sayer } from './types';
import { compareVersions, versionOf } from './versions';
import { machineryPlan } from '../commands/upgrade';
import { AUTHOR_FILE, MAIN_FILE } from '../scaffold/paths';
import { CLI_VERSION } from '../scaffold/project';

import type { Check, Finding } from './types';

/**
 * The files the CLI writes and keeps up (`MACHINERY`), as `plitzi upgrade` sees them: gone, behind the CLI, or made the
 * project's own — and the ones it no longer writes, left over. The same verdict `upgrade` acts on — one planner says it
 * for both.
 */

const say = sayer('machinery');

/** Without these the project does not start, author, build or type-check: gone, they are errors. */
const ESSENTIAL: ReadonlySet<string> = new Set([
  MAIN_FILE,
  AUTHOR_FILE,
  'tsconfig.json',
  'tsconfig.build.json',
  'vite.config.ts',
  'index.html',
  '.gitignore'
]);

export const checkMachinery: Check = async ({ root, answers, origin, record }) => {
  const findings: Finding[] = [];
  if (!record) {
    findings.push(
      say.warning(
        'no-record',
        'There is no .plitzi/scaffold.json: the CLI cannot tell a file it wrote from one the project changed, so it takes every one that differs for the project’s.',
        { file: '.plitzi/scaffold.json', fix: 'plitzi upgrade --write (it records what it writes)' }
      )
    );
  }

  const recordedBy = record ? versionOf(record.cli) : undefined;
  const cli = versionOf(CLI_VERSION);
  if (recordedBy && cli && compareVersions(recordedBy, cli) > 0) {
    findings.push(
      say.warning(
        'record-newer',
        `A newer CLI (${record?.cli ?? ''}) last wrote the project's files, and this one is ${CLI_VERSION}: it would take them back.`,
        { fix: 'npx @plitzi/cli@latest doctor' }
      )
    );
  }

  const { plans, retired } = await machineryPlan(root, answers, {
    ...(origin ? { origin } : {}),
    recorded: record?.files ?? {}
  });
  for (const plan of plans) {
    if (plan.status === 'added') {
      findings.push(
        (ESSENTIAL.has(plan.file) ? say.error : say.warning)('machinery-missing', `${plan.file} is gone.`, {
          file: plan.file,
          fix: 'plitzi upgrade files --write'
        })
      );
    } else if (plan.status === 'updated') {
      findings.push(
        say.warning('machinery-outdated', `${plan.file} is as an older CLI wrote it.`, {
          file: plan.file,
          fix: 'plitzi upgrade files --write'
        })
      );
    } else if (plan.status === 'yours') {
      findings.push(
        say.info('machinery-yours', `${plan.file} is the project's own now: upgrade leaves it, and shows the CLI's.`, {
          file: plan.file,
          fix: 'plitzi upgrade files'
        })
      );
    }
  }

  for (const plan of retired) {
    findings.push(
      plan.status === 'removed'
        ? say.warning('machinery-retired', `${plan.file} is no longer the CLI's, and nothing reads it.`, {
            file: plan.file,
            fix: 'plitzi upgrade files --write'
          })
        : say.info(
            'machinery-retired-yours',
            `${plan.file} is no longer the CLI's, and nothing reads it — but the project changed it, so upgrade leaves it.`,
            { file: plan.file, fix: `Delete it, or plitzi upgrade files --write --take ${plan.file}` }
          )
    );
  }

  return findings;
};
