import fs from 'node:fs/promises';
import path from 'node:path';

/**
 * What each agent left in its scratch beside the CLI: the scripts it wrote and the packages it installed — read before
 * the run's scratch goes with it. What the CLI writes there itself (the agent's CLI, its prompt, its log) is left out.
 */

const SCRIPT = /\.(m?js|cjs|m?ts|py|sh|rb)$/;

/** The CLI's own files in an agent's scratch. */
const OWN = new Set(['plitzi', 'prompt.md', 'agent.log']);

/** How deep a scratch is read: an agent's folders of scripts, never a whole tree it copied. */
const DEPTH = 4;

/** What an agent left in its scratch: its scripts, the packages it installed, the project copies it made by hand. */
interface Found {
  scripts: string[];
  packages: string[];
  copies: string[];
}

/** A folder that is the project again: its `package.json` and its space — copied whole, never the agent's scripts. */
const isProjectCopy = async (dir: string): Promise<boolean> =>
  (
    await Promise.all(['package.json', 'src/space'].map(each => fs.stat(path.join(dir, each)).catch(() => undefined)))
  ).every(Boolean);

const walk = async (
  dir: string,
  depth: number,
  found: Found,
  under: string,
  /** The project's root, inside a copy of it: what is the project's own there is the copy's, not the agent's. */
  copyOf?: { root: string; at: string }
): Promise<void> => {
  const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => []);
  for (const entry of entries) {
    const at = path.join(under, entry.name);
    if (entry.isDirectory() && copyOf === undefined && (await isProjectCopy(path.join(dir, entry.name)))) {
      // encore-10's "1250 scripts" were four copies of the project a scout and a tester made by hand.
      found.copies.push(at);
      await walk(path.join(dir, entry.name), depth + 1, found, at, { root: projectOf(dir), at });
    } else if (entry.isDirectory()) {
      if (entry.name === 'node_modules') {
        const names = await fs.readdir(path.join(dir, entry.name)).catch((): string[] => []);
        for (const name of names.filter(each => !each.startsWith('.'))) {
          // A scoped package is a folder of them.
          found.packages.push(
            ...(name.startsWith('@')
              ? (await fs.readdir(path.join(dir, entry.name, name)).catch((): string[] => [])).map(
                  each => `${name}/${each}`
                )
              : [name])
          );
        }
      } else if (depth < DEPTH || copyOf !== undefined) {
        await walk(path.join(dir, entry.name), depth + 1, found, at, copyOf);
      }
    } else if (SCRIPT.test(entry.name) && !OWN.has(entry.name)) {
      const inProject =
        copyOf !== undefined &&
        (await fs
          .stat(path.join(copyOf.root, path.relative(copyOf.at, at)))
          .then(() => true)
          .catch(() => false));
      if (!inProject && !(copyOf !== undefined && /(^|\/)tmp\/\.sdk-plugins\//.test(at))) {
        found.scripts.push(at);
      }
    }
  }
};

/** The project a run's scratch sits in: `<root>/tmp/plitzi-runs/<run>/scratch/<agent>/…`. */
const projectOf = (dir: string): string => {
  const parts = dir.split(path.sep);
  const runs = parts.lastIndexOf('plitzi-runs');

  return runs > 1 ? parts.slice(0, runs - 1).join(path.sep) : dir;
};

export const scratchOf = async (
  scratch: string
): Promise<{ agent: string; scripts: string[]; packages: string[]; copies: string[] }[]> => {
  const agents = await fs.readdir(scratch, { withFileTypes: true }).catch(() => []);

  return Promise.all(
    agents
      .filter(entry => entry.isDirectory())
      .map(async entry => {
        const found: Found = { scripts: [], packages: [], copies: [] };
        await walk(path.join(scratch, entry.name), 0, found, '');

        return {
          agent: entry.name,
          scripts: found.scripts.sort(),
          packages: [...new Set(found.packages)].sort(),
          copies: found.copies.sort()
        };
      })
  );
};

/** A script past this size is no script of an agent's: a bundle or data it wrote, left out and said. */
const KEEP_MOST_BYTES = 256 * 1024;

/**
 * Each agent's scripts copied out of the run's scratch before it goes — to `into/<agent>/<path>` beside the run's report:
 * each one is what a command could not do, and what it does is the CLI's next feature (a run's design-1 installed
 * axe-core to audit what `page check` did not). Each one `clean`ed — what leaves the run leaves the person's machine out
 * (`withoutMachine`). What it kept, and what it left out as too large.
 */
export const keepScratch = async (
  scratch: string,
  into: string,
  clean: (text: string) => string
): Promise<{ kept: string[]; tooLarge: string[] }> => {
  const kept: string[] = [];
  const tooLarge: string[] = [];
  for (const { agent, scripts } of await scratchOf(scratch)) {
    for (const script of scripts) {
      const from = path.join(scratch, agent, script);
      const size = (await fs.stat(from).catch(() => undefined))?.size ?? 0;
      if (size > KEEP_MOST_BYTES) {
        tooLarge.push(`${agent}/${script}`);
        continue;
      }

      const to = path.join(into, agent, script);
      await fs.mkdir(path.dirname(to), { recursive: true });
      await fs.writeFile(to, clean(await fs.readFile(from, 'utf-8')));
      kept.push(`${agent}/${script}`);
    }
  }

  return { kept, tooLarge };
};
