import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { searchAll } from './explain';
import { skillPassages, skillsMentions } from './skillsMentions';

let root = '';

beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'plitzi-skills-'));
  const skill = path.join(root, '.claude', 'skills', 'plitzi-cli');
  await fs.mkdir(path.join(skill, 'reference'), { recursive: true });
  await fs.mkdir(path.join(skill, 'recipes'), { recursive: true });
  await fs.writeFile(path.join(skill, 'recipes', 'jobs.ts'), 'export const make = taskAction(tasks.make, {});\n');
  await fs.writeFile(
    path.join(skill, 'reference', 'functions.md'),
    "# Functions\n\nA taskAction is mentioned in prose here.\n- **One task** is `taskAction(tasks.make, …)`\n- **A push is checked.** `src/data/` is read\n  with `ctx.data('x.json')`, never imported.\n"
  );
});

afterEach(async () => {
  await fs.rm(root, { recursive: true, force: true });
});

// Dev-1 read the published types for `taskAction`, which the functions reference teaches with an example.
describe('where the skills teach a name', () => {
  it('names the line that writes it as code, the references before the recipes — never a word in prose', () => {
    expect(skillsMentions(root, 'taskAction')).toEqual([
      {
        file: path.join('.claude', 'skills', 'plitzi-cli', 'reference', 'functions.md'),
        line: 4,
        text: '- **One task** is `taskAction(tasks.make, …)`'
      },
      {
        file: path.join('.claude', 'skills', 'plitzi-cli', 'recipes', 'jobs.ts'),
        line: 1,
        text: 'export const make = taskAction(tasks.make, {});'
      }
    ]);
    expect(skillsMentions(root, 'nothingHere')).toEqual([]);
  });

  // "server action reads a data file for a provider" found neither ctx.data nor taskAction.
  it('lets a search answer with what a reference teaches, a point read whole with the lines that go on with it', () => {
    const passages = skillPassages(root);
    expect(passages.map(each => each.text)).toEqual([
      'One task is `taskAction(tasks.make, …)`',
      "A push is checked. `src/data/` is read with `ctx.data('x.json')`, never imported."
    ]);

    const hits = searchAll('read a data file with ctx', [], 10, passages);
    expect(hits.slice(0, 3)).toContainEqual({
      kind: 'skill',
      name: path.join('.claude', 'skills', 'plitzi-cli', 'reference', 'functions.md:5'),
      summary: "A push is checked. `src/data/` is read with `ctx.data('x.json')`, never imported."
    });
  });
});
