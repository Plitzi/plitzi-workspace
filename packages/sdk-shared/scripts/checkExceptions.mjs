import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

/**
 * Every exception to the workspace's rules, counted per package — `eslint-disable`, an `any`, an `as unknown as` — in
 * what a package ships (not its tests, stories or benchmarks), held to `exceptions.json` (`yarn check:exceptions`).
 *
 * Each is allowed only with a comment that says why there is no alternative (AGENTS.md § How we work). The table is a
 * ratchet: a count that rises fails — remove the new one, or say why it cannot go and raise the table in the same
 * change — and one that falls fails too, until the table is lowered to it, so what was removed cannot come back unseen.
 */

const SELF = fileURLToPath(import.meta.url);
const WORKSPACE = path.resolve(path.dirname(SELF), '../../..');
const TABLE = path.join(path.dirname(SELF), 'exceptions.json');
const SKIP = new Set(['node_modules', 'dist', '.turbo', 'coverage', 'tests', '__mocks__']);
const SOURCE = /\.(m?ts|tsx)$/;
const NOT_SHIPPED = /\.(test|spec|stories|bench)\.[cm]?tsx?$|\.d\.ts$/;
const KINDS = {
  disable: /eslint-disable/g,
  any: /(?::\s*any\b|<any>|\bas any\b|\bany\[\]|Array<any>)/g,
  unknownAs: /\bas unknown as\b/g
};

const filesOf = dir =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    if (SKIP.has(entry.name)) {
      return [];
    }

    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      return filesOf(full);
    }

    return SOURCE.test(entry.name) && !NOT_SHIPPED.test(entry.name) ? [full] : [];
  });

export const countExceptions = () => {
  const counts = {};
  for (const root of ['apps', 'packages']) {
    for (const name of fs.readdirSync(path.join(WORKSPACE, root)).sort()) {
      const src = path.join(WORKSPACE, root, name, 'src');
      if (!fs.existsSync(src)) {
        continue;
      }

      const total = { disable: 0, any: 0, unknownAs: 0 };
      for (const file of filesOf(src)) {
        const text = fs.readFileSync(file, 'utf8');
        for (const [kind, pattern] of Object.entries(KINDS)) {
          total[kind] += text.match(pattern)?.length ?? 0;
        }
      }

      counts[`${root}/${name}`] = total;
    }
  }

  return counts;
};

if (process.argv[1] === SELF) {
  const counts = countExceptions();
  if (process.argv.includes('--write')) {
    fs.writeFileSync(TABLE, `${JSON.stringify(counts, null, 2)}\n`);
    console.log(`Wrote ${path.relative(WORKSPACE, TABLE)}.`);
    process.exit(0);
  }

  const table = JSON.parse(fs.readFileSync(TABLE, 'utf8'));
  const problems = [];
  for (const [pkg, total] of Object.entries(counts)) {
    for (const [kind, count] of Object.entries(total)) {
      const allowed = table[pkg]?.[kind] ?? 0;
      if (count > allowed) {
        problems.push(
          `${pkg}: ${String(count)} ${kind}, past the ${String(allowed)} of exceptions.json — remove the new one, or say in a comment why there is no alternative and raise the table`
        );
      } else if (count < allowed) {
        problems.push(
          `${pkg}: ${String(count)} ${kind}, under the ${String(allowed)} of exceptions.json — lower the table to it (node packages/sdk-shared/scripts/checkExceptions.mjs --write)`
        );
      }
    }
  }

  if (problems.length > 0) {
    console.error(`Exceptions to the rules moved:\n${problems.map(line => `- ${line}`).join('\n')}`);
    process.exit(1);
  }

  console.log('Every package holds the exceptions exceptions.json says.');
}
