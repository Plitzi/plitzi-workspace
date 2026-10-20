import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { MODELS_FILE, modelFor, readModels, setModel } from './models';
import { isRunRefusal } from './refusal';

let root: string;

beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'plitzi-models-'));
});

afterEach(async () => {
  await fs.rm(root, { recursive: true, force: true });
});

describe('the models of a project’s runs', () => {
  it('are none until chosen, then one per role with the default for the rest — each change said before and after', async () => {
    expect(await readModels(root)).toBeUndefined();

    expect(await setModel(root, 'default', { model: 'claude-sonnet-5-5' })).toEqual({
      role: 'default',
      after: { model: 'claude-sonnet-5-5' },
      file: MODELS_FILE
    });
    await setModel(root, 'lead', { model: 'claude-opus-5-5', effort: 'high' });
    expect(await setModel(root, 'designer', { model: 'claude-opus-5-5' })).not.toHaveProperty('before');

    const models = await readModels(root);
    expect(modelFor(models, 'designer')).toEqual({ model: 'claude-opus-5-5' });
    expect(modelFor(models, 'developer')).toEqual({ model: 'claude-sonnet-5-5' });
    expect(modelFor(models, 'lead')).toEqual({ model: 'claude-opus-5-5', effort: 'high' });

    expect(await setModel(root, 'designer', undefined)).toMatchObject({ before: { model: 'claude-opus-5-5' } });
    expect(modelFor(await readModels(root), 'designer')).toEqual({ model: 'claude-sonnet-5-5' });
  });

  it('refuses a file that is not one, a role that is not a name, and taking out what is not there', async () => {
    await fs.mkdir(path.join(root, '.plitzi'));
    await fs.writeFile(
      path.join(root, MODELS_FILE),
      JSON.stringify({ version: 1, roles: { dev: { effort: 'high' } } })
    );
    await expect(readModels(root)).rejects.toThrow('"dev" is not a role with');

    await fs.rm(path.join(root, MODELS_FILE));
    const refused = await setModel(root, 'Big Role', { model: 'x' }).catch((error: unknown) => error);
    expect(isRunRefusal(refused) && refused.message).toContain('is no role');
    await expect(setModel(root, 'writer', undefined)).rejects.toThrow('has no model of its own');
  });
});
