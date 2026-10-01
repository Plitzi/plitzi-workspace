import chalk from 'chalk';

import { authorizedRequest } from '../account/session';

import type { Connection } from '../account/connection';

/**
 * A packed source snapshot sent beside what was just uploaded or pushed, and kept on the space (docs/en/projects-from-spaces.md): what lets
 * `plitzi create --from` take the space back out as a project. Never undoes what went up before it — the plugin or the
 * runtime runs either way — so a refusal is said, with why, and the command still succeeds.
 */
export const keepSource = async (connection: Connection, spaceId: number, bytes: Uint8Array): Promise<void> => {
  const sent = await authorizedRequest<{ ok?: boolean; files?: number; problems?: string[] }>(
    connection,
    `/spaces/${String(spaceId)}/sources`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/octet-stream' },
      // A copy on an ArrayBuffer of its own: a Buffer may sit on a shared pool, which a request body cannot be.
      body: new Uint8Array(bytes)
    }
  );
  if (!sent.ok) {
    console.log(chalk.yellow(`  Its source is not kept: ${sent.error}`));

    return;
  }

  const { status, data } = sent.value.reply;
  if (status === 200 && data.ok) {
    console.log(
      chalk.dim(`  Its source too (${String(data.files ?? 0)} files): plitzi create --from can take it back out.`)
    );

    return;
  }

  const problems = data.problems ?? [`The platform answered ${String(status)}`];
  console.log(chalk.yellow('  Its source is not kept, so a project taken from the space gets it built only:'));
  problems.forEach(problem => console.log(chalk.yellow(`    - ${problem}`)));
};
