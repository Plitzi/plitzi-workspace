import chalk from 'chalk';

import { expandFiles, impactOf, readOwnership } from '../../runs/copies/ownership';
import { RunRefusal } from '../../runs/core/refusal';
import { act } from '../runs/shell';
import { list } from '../runs/text';

import type { RunCommandOptions } from '../runs/shell';

/**
 * `plitzi space overview` and `space impact`: who owns which file, read off the imports.
 */

export const spaceOverview = (named: string | undefined, options: RunCommandOptions): Promise<void> =>
  named === undefined ? wholeOverview(options) : unitOverview(named, options);

/**
 * Every unit in a line — what it owns and how many shared files it reaches, counted — and the shared files with how
 * many units reach each. A run's lead read 12k characters of it: each unit spelled out every shared file it reaches,
 * the list beneath said again; one unit's are `space overview <unit>`.
 */
const wholeOverview = (options: RunCommandOptions): Promise<void> =>
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
        chalk.bold('Who owns which file, read off the imports — one unit whole: plitzi space overview <unit>'),
        ...map.units.map(unit => {
          const shares = unit.reaches.filter(file => file !== unit.unit).length;

          return `  ${unit.unit}: owns ${String(unit.owns.length)}${shares > 0 ? `, shares ${String(shares)}` : ''}`;
        }),
        chalk.bold('Shared — by turns or by request'),
        ...map.shared.map(
          shared =>
            `  ${shared.file} (${shared.entry ? 'an entry of the project' : `${String(shared.reachedBy.length)} units`})`
        ),
        ...missingLines(map.missing)
      ].join('\n')
  );

/** One unit whole: each file it owns, and each shared file it reaches with how many units reach it. */
const unitOverview = (named: string, options: RunCommandOptions): Promise<void> =>
  act(
    options,
    async ctx => {
      const ownership = await readOwnership(ctx.root);
      const clean = named.replace(/\\/g, '/').replace(/\/$/, '');
      const unit =
        ownership.units.find(each => each.unit.replace(/\/$/, '') === clean) ??
        ownership.units.find(each => each.unit.replace(/\/$/, '').endsWith(`/${clean}`));
      if (!unit) {
        throw new RunRefusal(
          'invalid',
          `${named} is no unit of the project: name one as space overview lists it — ${list(ownership.units.map(each => each.unit))}`,
          { next: 'plitzi space overview' }
        );
      }

      return {
        unit: unit.unit,
        owns: unit.owns,
        shares: unit.reaches
          .filter(file => file !== unit.unit)
          .map(file => ({ file, reachedBy: ownership.shared.get(file)?.length ?? 0 })),
        missing: ownership.missing
      };
    },
    one =>
      [
        chalk.bold(`${one.unit} — owns ${String(one.owns.length)}:`),
        ...one.owns.map(file => `  ${file}`),
        ...(one.shares.length > 0
          ? [
              chalk.bold(`Shares ${String(one.shares.length)} — by turns or by request:`),
              ...one.shares.map(each => `  ${each.file} (${String(each.reachedBy)} units)`)
            ]
          : []),
        ...missingLines(one.missing)
      ].join('\n')
  );

const missingLines = (missing: readonly string[]): string[] =>
  missing.length > 0 ? [chalk.yellow('Imports of files that are not there:'), ...missing.map(each => `  ${each}`)] : [];

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
