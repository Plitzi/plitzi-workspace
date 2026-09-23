import { readdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, relative, sep } from 'node:path';

import type { ProjectFiles } from './types';

/**
 * The skills, copied out of the packages that own them.
 *
 * Copied rather than referenced: a skill is read from `.claude/skills/` in the project being worked on, and a
 * pointer into `node_modules` is a pointer that breaks the first time somebody installs with a different package
 * manager. Read from the installed package rather than embedded here, so the CLI cannot ship a stale copy of
 * somebody else's documentation.
 *
 * Only `plitzi-authoring` travels. `plitzi-render` is the other one Plitzi ships, and it is deliberately left
 * out: it drives the `plitzi_render` MCP tool, so in a project with no MCP connection it would be an instruction
 * to use something that is not there.
 */

const require = createRequire(import.meta.url);

const SKILLS = [{ package: '@plitzi/sdk-authoring', name: 'plitzi-authoring' }];

/**
 * Where a skill file sits, resolved through the package's own export map rather than guessed from a path.
 *
 * `<package>/skills/*` is an export of the packages that ship one, which is what makes this work under Yarn PnP —
 * there is no `node_modules` directory to walk there, and a file the package does not export is unreachable
 * however present it is on disk.
 */
const skillPath = (packageName: string, skill: string): string =>
  require.resolve(`${packageName}/skills/${skill}/SKILL.md`);

/**
 * Every file under a skill's folder, by its path inside it.
 *
 * A skill is a folder, not a file: \`SKILL.md\` is the short part an agent reads first, and the references it links to
 * sit beside it and are opened when the task needs them. Copying \`SKILL.md\` alone left every one of those links
 * pointing at nothing.
 */
const filesUnder = (root: string, folder = root): [string, string][] =>
  readdirSync(folder, { withFileTypes: true }).flatMap(entry => {
    const path = join(folder, entry.name);
    if (entry.isDirectory()) {
      return filesUnder(root, path);
    }

    return entry.isFile()
      ? [[relative(root, path).split(sep).join('/'), readFileSync(path, 'utf-8')] as [string, string]]
      : [];
  });

export const skillFiles = (): ProjectFiles => {
  const files: ProjectFiles = {};

  for (const skill of SKILLS) {
    try {
      const root = dirname(skillPath(skill.package, skill.name));
      for (const [path, content] of filesUnder(root)) {
        files[`.claude/skills/${skill.name}/${path}`] = content;
      }
    } catch {
      // A skill that cannot be read is a skill the project does without. It is documentation for an agent, not a
      // dependency of the project, and failing the scaffold over it would trade a working project for a file.
      continue;
    }
  }

  return files;
};
