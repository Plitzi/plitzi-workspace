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

const walk = async (
  dir: string,
  depth: number,
  found: { scripts: string[]; packages: string[] },
  under: string
): Promise<void> => {
  const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => []);
  for (const entry of entries) {
    const at = path.join(under, entry.name);
    if (entry.isDirectory()) {
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
      } else if (depth < DEPTH) {
        await walk(path.join(dir, entry.name), depth + 1, found, at);
      }
    } else if (SCRIPT.test(entry.name) && !OWN.has(entry.name)) {
      found.scripts.push(at);
    }
  }
};

export const scratchOf = async (
  scratch: string
): Promise<{ agent: string; scripts: string[]; packages: string[] }[]> => {
  const agents = await fs.readdir(scratch, { withFileTypes: true }).catch(() => []);

  return Promise.all(
    agents
      .filter(entry => entry.isDirectory())
      .map(async entry => {
        const found: { scripts: string[]; packages: string[] } = { scripts: [], packages: [] };
        await walk(path.join(scratch, entry.name), 0, found, '');

        return { agent: entry.name, scripts: found.scripts.sort(), packages: [...new Set(found.packages)].sort() };
      })
  );
};

/** A script past this size is no script of an agent's: a bundle or data it wrote, left out and said. */
const KEEP_MOST_BYTES = 256 * 1024;

/**
 * Each agent's scripts copied out of the run's scratch before it goes — to `into/<agent>/<path>` beside the run's report:
 * each one is what a command could not do, and what it does is the CLI's next feature (encore's design-1 installed
 * axe-core to audit what `page check` did not). What it kept, and what it left out as too large.
 */
export const keepScratch = async (scratch: string, into: string): Promise<{ kept: string[]; tooLarge: string[] }> => {
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
      await fs.copyFile(from, to);
      kept.push(`${agent}/${script}`);
    }
  }

  return { kept, tooLarge };
};
