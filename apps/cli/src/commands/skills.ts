import fs from 'node:fs/promises';
import path from 'node:path';

import chalk from 'chalk';

import { projectHere } from './existingProject';
import { fail, writeFiles } from './terminal';
import { SKILL_NAMES, skillFiles, skillVersion } from '../scaffold/skills';

/**
 * `plitzi skills update`: the Plitzi skills in `.claude/skills/` brought up to the packages the project has installed.
 *
 * A skill is copied into a project when `create` writes it and then stays as it was, while `@plitzi/sdk-authoring` moves
 * on — and an agent reading the older one is taught a surface the SDK no longer has, or misses what it gained. Only the
 * `plitzi-*` skills are touched, each replaced whole (a reference it no longer has goes with it); any other skill in the
 * folder is the project's.
 */

const readSkill = async (file: string): Promise<string | undefined> => {
  try {
    return await fs.readFile(file, 'utf-8');
  } catch {
    return undefined;
  }
};

export const skillsUpdate = async (): Promise<void> => {
  const project = await projectHere('whose skills to update');
  if (!project) {
    return;
  }

  const folder = path.join(project.root, '.claude/skills');
  const present = [];
  for (const name of SKILL_NAMES) {
    const skill = await readSkill(path.join(folder, name, 'SKILL.md'));
    if (skill !== undefined) {
      present.push({ name, was: skillVersion(skill) });
    }
  }

  if (present.length === 0) {
    fail(
      `No Plitzi skill in ${path.relative(process.cwd(), folder) || '.claude/skills'}: \`plitzi create\` writes them into a project it makes.`
    );

    return;
  }

  const files = skillFiles(
    present.map(({ name }) => name),
    project.root
  );
  for (const { name, was } of present) {
    const own = Object.fromEntries(
      Object.entries(files).filter(([file]) => file.startsWith(`.claude/skills/${name}/`))
    );
    if (Object.keys(own).length === 0) {
      console.log(chalk.yellow(`${name}: its package is not installed here, so it was left as it was.`));
      continue;
    }

    await fs.rm(path.join(folder, name), { recursive: true, force: true });
    await writeFiles(project.root, own);
    const now = skillVersion(own[`.claude/skills/${name}/SKILL.md`] ?? '');
    console.log(chalk.green(`${name}: ${was ?? 'unversioned'} → ${now ?? 'unversioned'}`));
  }
};
