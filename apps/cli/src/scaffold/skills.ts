import { readdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, relative, sep } from 'node:path';

import { isRecord } from '@plitzi/sdk-shared/helpers/isRecord';

import type { ProjectFiles } from './types';

/**
 * The skills, copied out of the packages that own them.
 *
 * Copied rather than referenced: a skill is read from `.claude/skills/` in the project being worked on, and a
 * pointer into `node_modules` is a pointer that breaks the first time somebody installs with a different package
 * manager. Read from the installed package rather than embedded here, so the CLI cannot ship a stale copy of
 * somebody else's documentation.
 *
 * Two travel: `plitzi-authoring` (how a space is written) and `plitzi-cli` (what this command line does — plugins,
 * packing, uploading — so an agent reaches for it instead of hand-writing what it generates). `plitzi-render` is the
 * other one Plitzi ships, and it is deliberately left out: it drives the `plitzi_render` MCP tool, so in a project with
 * no MCP connection it would be an instruction to use something that is not there.
 */

const cliRequire = createRequire(import.meta.url);

export const SKILL_NAMES = ['plitzi-authoring', 'plitzi-cli'] as const;

export type SkillName = (typeof SKILL_NAMES)[number];

/** The package each skill is published in, and copied from. */
const SKILLS: Record<SkillName, string> = {
  'plitzi-authoring': '@plitzi/sdk-authoring',
  'plitzi-cli': '@plitzi/cli'
};

/**
 * How a package is found: the project's own install first — the SDK it renders with is the one its skill has to match —
 * then this CLI's. `@plitzi/cli` is usually run with npx and installed nowhere in the project, so it falls through.
 */
const resolversFor = (root?: string): NodeJS.Require[] =>
  root ? [createRequire(join(root, 'package.json')), cliRequire] : [cliRequire];

/**
 * Where a skill file sits, resolved through the package's own export map rather than guessed from a path.
 *
 * `<package>/skills/*` is an export of the packages that ship one, which is what makes this work under Yarn PnP —
 * there is no `node_modules` directory to walk there, and a file the package does not export is unreachable
 * however present it is on disk.
 */
const resolveFrom = (resolvers: NodeJS.Require[], request: string): string | undefined => {
  for (const resolver of resolvers) {
    try {
      return resolver.resolve(request);
    } catch {
      continue;
    }
  }

  return undefined;
};

/** The version of the package a skill came from, written into its frontmatter — `version: 0.38.0`. */
const versionOf = (resolvers: NodeJS.Require[], packageName: string): string | undefined => {
  const manifest = resolveFrom(resolvers, `${packageName}/package.json`);
  if (!manifest) {
    return undefined;
  }

  const parsed: unknown = JSON.parse(readFileSync(manifest, 'utf-8'));

  return isRecord(parsed) && typeof parsed.version === 'string' ? parsed.version : undefined;
};

/** The frontmatter's `version:`, said once: after the skill's `name:`, replacing any already there. */
const stampVersion = (skill: string, version: string): string =>
  skill.replace(/^version: .*\n/m, '').replace(/^(name: .*)$/m, `$1\nversion: ${version}`);

/** The version a copied `SKILL.md` says it came from. */
export const skillVersion = (skill: string): string | undefined => /^version: (.+)$/m.exec(skill)?.[1]?.trim();

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

/**
 * The skills a project carries: both for a project that renders a space, the CLI's alone for a plugin package. With
 * `root`, from the packages that project installed — what `plitzi upgrade skills` brings it up to.
 */
export const skillFiles = (names: readonly SkillName[] = SKILL_NAMES, root?: string): ProjectFiles => {
  const resolvers = resolversFor(root);
  const files: ProjectFiles = {};

  for (const name of names) {
    const entry = resolveFrom(resolvers, `${SKILLS[name]}/skills/${name}/SKILL.md`);
    // A skill that cannot be read is a skill the project does without. It is documentation for an agent, not a
    // dependency of the project, and failing the scaffold over it would trade a working project for a file.
    if (!entry) {
      continue;
    }

    const version = versionOf(resolvers, SKILLS[name]);
    for (const [path, content] of filesUnder(dirname(entry))) {
      files[`.claude/skills/${name}/${path}`] =
        path === 'SKILL.md' && version ? stampVersion(content, version) : content;
    }
  }

  return files;
};
