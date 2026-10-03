import { readFileSync } from 'node:fs';
import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { isRecord } from '@plitzi/sdk-shared/helpers/isRecord';

import { skillsUpdate } from './skills';

/** The version the CLI resolves `@plitzi/sdk-authoring` at, read as it reads it. */
const authoringVersion = (): string => {
  const manifest: unknown = JSON.parse(
    readFileSync(createRequire(import.meta.url).resolve('@plitzi/sdk-authoring/package.json'), 'utf-8')
  );

  return isRecord(manifest) && typeof manifest.version === 'string' ? manifest.version : '';
};

describe('plitzi skills update', () => {
  const cwd = process.cwd();

  afterEach(() => {
    process.chdir(cwd);
    vi.restoreAllMocks();
  });

  it('replaces each Plitzi skill whole, at the installed version, and leaves the others alone', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'plitzi-skills-'));
    const skill = (name: string, file: string) => path.join(root, '.claude/skills', name, file);
    await fs.writeFile(path.join(root, 'package.json'), '{ "name": "shop" }');
    await fs.mkdir(path.dirname(skill('plitzi-authoring', 'reference/gone.md')), { recursive: true });
    await fs.writeFile(skill('plitzi-authoring', 'SKILL.md'), '---\nname: plitzi-authoring\nversion: 0.1.0\n---\nOld.');
    await fs.writeFile(skill('plitzi-authoring', 'reference/gone.md'), 'A reference the skill no longer has.');
    await fs.mkdir(path.dirname(skill('ours', 'SKILL.md')), { recursive: true });
    await fs.writeFile(skill('ours', 'SKILL.md'), 'The project’s own.');
    const said = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    process.chdir(root);
    await skillsUpdate();

    const updated = await fs.readFile(skill('plitzi-authoring', 'SKILL.md'), 'utf-8');
    expect(updated).toContain(`version: ${authoringVersion()}`);
    expect(updated).toContain('CHEATSHEET.md');
    await expect(fs.readFile(skill('plitzi-authoring', 'reference/gone.md'), 'utf-8')).rejects.toThrow();
    expect(await fs.readFile(skill('ours', 'SKILL.md'), 'utf-8')).toBe('The project’s own.');
    expect(said).toHaveBeenCalledWith(`plitzi-authoring: 0.1.0 → ${authoringVersion()}`);
    // Only what was there is brought up to date: a skill the project never had is not added.
    await expect(fs.readFile(skill('plitzi-cli', 'SKILL.md'), 'utf-8')).rejects.toThrow();

    await fs.rm(root, { recursive: true, force: true });
  });
});
