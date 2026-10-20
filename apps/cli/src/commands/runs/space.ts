import chalk from 'chalk';

import { act } from './shell';
import { list } from './text';
import { expandFiles, impactOf, readOwnership } from '../../runs/ownership';

import type { RunCommandOptions } from './shell';

/**
 * `plitzi space overview` and `space impact`: who owns which file, read off the imports.
 */

export const spaceOverview = (options: RunCommandOptions): Promise<void> =>
  act(
    options,
    async ctx => {
      const ownership = await readOwnership(ctx.root);

      return {
        entries: ownership.entries,
        units: ownership.units,
        shared: [...ownership.shared]
          .map(([file, reachedBy]) => ({ file, reachedBy, entry: ownership.entries.includes(file) }))
          .sort((a, b) => a.file.localeCompare(b.file)),
        missing: ownership.missing
      };
    },
    map =>
      [
        chalk.bold('Who owns which file, read off the imports'),
        ...map.units.map(
          unit =>
            `  ${unit.unit}: owns ${String(unit.owns.length)}${unit.reaches.length > 0 ? `, shares ${unit.reaches.join(', ')}` : ''}`
        ),
        chalk.bold('Shared — by turns or by request'),
        ...map.shared.map(
          shared =>
            `  ${shared.file} (${shared.entry ? 'an entry of the project' : `${String(shared.reachedBy.length)} units`})`
        ),
        ...(map.missing.length > 0
          ? [chalk.yellow('Imports of files that are not there:'), ...map.missing.map(each => `  ${each}`)]
          : [])
      ].join('\n')
  );

export const spaceImpact = (file: string, options: RunCommandOptions): Promise<void> =>
  act(
    options,
    async ctx => {
      const ownership = await readOwnership(ctx.root);
      const clean = file.replace(/\\/g, '/');

      return { file: clean, ...impactOf(ownership, clean), owns: expandFiles(ownership, [clean]) };
    },
    impact =>
      `${impact.file} — imported by ${String(impact.files.length)} files: ${list(impact.files)}\n  Units it touches: ${list(impact.units)}`
  );
