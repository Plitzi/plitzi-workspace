import fs from 'node:fs/promises';
import path from 'node:path';

import { sayer } from './types';
import { FUNCTIONS_STATE_FILE, readFunctionsState } from '../commands/functions';
import { SCAFFOLD_RECORD_FILE } from '../commands/scaffoldRecord';
import { ORIGIN_FILE } from '../commands/spaceOrigin';
import { planSkills } from '../commands/upgrade';

import type { Check, Finding } from './types';

/**
 * What the CLI keeps in `.plitzi/` — where the project came from, what it was given, what a pull of the functions last
 * wrote, what the CLI wrote of its files — readable, and saying the same space. Without them a clone cannot pull, push
 * or upgrade, and nothing of it is the project's to edit.
 */

const say = sayer('records');

const there = (file: string): Promise<boolean> =>
  fs.access(file).then(
    () => true,
    () => false
  );

export const checkRecords: Check = async ({ root, origin, record }) => {
  const findings: Finding[] = [];
  const unreadable = (file: string, what: string): Finding =>
    say.error('record-unreadable', `${file} is there and is not a record the CLI reads: ${what}.`, {
      file,
      fix: `git checkout -- ${file} brings back the one committed.`
    });
  if (!origin && (await there(path.join(root, ORIGIN_FILE)))) {
    findings.push(unreadable(ORIGIN_FILE, 'pull and push take the project for one no space made'));
  }

  if (!record && (await there(path.join(root, SCAFFOLD_RECORD_FILE)))) {
    findings.push(
      unreadable(SCAFFOLD_RECORD_FILE, 'upgrade takes every file of the CLI’s that differs for the project’s')
    );
  }

  const functions = await readFunctionsState(root);
  if (!functions && (await there(path.join(root, FUNCTIONS_STATE_FILE)))) {
    findings.push(unreadable(FUNCTIONS_STATE_FILE, 'functions push takes every function for one never pulled'));
  }

  if (functions && origin && functions.space !== origin.space.id) {
    findings.push(
      say.error(
        'records-disagree',
        `${FUNCTIONS_STATE_FILE} is of the space #${String(functions.space)}, and the project is of ${origin.space.name} (#${String(origin.space.id)}): its functions would be pushed to one space as pulled from another.`,
        { file: FUNCTIONS_STATE_FILE, fix: 'plitzi functions pull, from the project’s space.' }
      )
    );
  }

  return findings;
};

const saySkills = sayer('skills');

/** The skills an agent reads (`.claude/skills/plitzi-*`), as the packages installed write them. */
export const checkSkills: Check = async ({ root }) => {
  const { plans } = await planSkills(root);

  return plans.map(plan => {
    const where = { file: `.claude/skills/${plan.name}`, fix: 'plitzi upgrade skills --write' };
    if (plan.was === undefined) {
      return saySkills.warning(
        'skill-missing',
        `The skill ${plan.name} is not in .claude/skills/: an agent works without it.`,
        where
      );
    }

    return saySkills.warning(
      'skill-outdated',
      plan.was === plan.now
        ? `The skill ${plan.name} is not what the SDK installed (${plan.now}) writes: changed here, or written by another build of it.`
        : `The skill ${plan.name} is ${plan.was}, and the SDK installed writes ${plan.now ?? '?'}.`,
      where
    );
  });
};
