import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { buildHandles } from '@plitzi/sdk-authoring';

import { authoredKey, keepAuthored, keptAuthored } from './authoredCache';

import type { Authored } from './space';
import type { Schema } from '@plitzi/sdk-shared';

let root: string;

beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'plitzi-authored-'));
  await fs.mkdir(path.join(root, 'src', 'space'), { recursive: true });
  await fs.writeFile(path.join(root, 'src', 'space', 'index.ts'), "export const title = 'Hola';\n");
  await fs.writeFile(path.join(root, 'package.json'), '{"name":"cafe"}\n');
});

afterEach(async () => {
  await fs.rm(root, { recursive: true, force: true });
});

const home = {
  id: 'home',
  type: 'page',
  pageId: 'home',
  selector: '[data-plitzi-el="home"]',
  named: true,
  slug: '',
  path: '/',
  params: [],
  elements: {
    'home-title': {
      id: 'home-title',
      type: 'heading',
      pageId: 'home',
      selector: '[data-plitzi-el="home-title"]',
      named: true
    }
  }
};

// A stand-in of an authored space: the handles a check asks of it, and a schema it reads as it is.
const authored = (): Authored => ({
  handles: buildHandles({ home }),
  schema: { flat: {} } as unknown as Schema,
  schemes: ['light', 'dark']
});

// Every page check loaded the project's modules and authored them again: 340 ms of a run's, the same each time.
describe('the space a check is held to, kept', () => {
  it('comes back whole — its handles answering as they did — for the very files it was authored from', async () => {
    const key = await authoredKey(root);
    await keepAuthored(root, key, authored());

    const kept = await keptAuthored(root, key);
    expect(kept?.handles.element('home-title').selector).toBe('[data-plitzi-el="home-title"]');
    expect(kept?.handles.page('').path).toBe('/');
    expect(() => kept?.handles.element('nope')).toThrow('No element "nope"');
    expect(kept?.schemes).toEqual(['light', 'dark']);
  });

  it('is another for a change to its source, and only the last few are kept', async () => {
    const before = await authoredKey(root);
    await fs.writeFile(path.join(root, 'src', 'space', 'index.ts'), "export const title = 'Adiós';\n");

    expect(await authoredKey(root)).not.toBe(before);
    expect(await keptAuthored(root, await authoredKey(root))).toBeUndefined();

    for (const n of [1, 2, 3, 4, 5, 6]) {
      await fs.writeFile(path.join(root, 'src', 'space', 'index.ts'), `export const n = ${String(n)};\n`);
      await keepAuthored(root, await authoredKey(root), authored());
    }

    expect(await fs.readdir(path.join(root, 'tmp', 'plitzi-cache', 'authored'))).toHaveLength(4);
    expect(await keptAuthored(root, await authoredKey(root))).toBeDefined();
  });
});
