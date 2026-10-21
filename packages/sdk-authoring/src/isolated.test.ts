import { existsSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterAll, describe, expect, it } from 'vitest';

import { authorIsolated } from './isolated';

/**
 * A module somebody else wrote, authored in a process of its own. The process imports `@plitzi/sdk-authoring` as the
 * module does — the built package — so this suite reads `dist/` (`yarn build:dev` first).
 */

const installed = (() => {
  for (let at = path.dirname(fileURLToPath(import.meta.url)); ; at = path.dirname(at)) {
    if (existsSync(path.join(at, 'node_modules', '@plitzi', 'sdk-authoring'))) {
      return path.join(at, 'node_modules');
    }

    if (path.dirname(at) === at) {
      throw new Error('No node_modules with @plitzi/sdk-authoring above this file');
    }
  }
})();

const dir = mkdtempSync(path.join(tmpdir(), 'plitzi-isolated-'));
symlinkSync(installed, path.join(dir, 'node_modules'));

const moduleOf = (name: string, source: string): string => {
  const file = path.join(dir, `${name}.ts`);
  writeFileSync(file, source);

  return file;
};

afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe('authorIsolated', () => {
  it('authors the space the module exports, and nothing of this process reaches it', async () => {
    const file = moduleOf(
      'weather',
      "export const space = { name: 'Weather', permanentUrl: 'weather', pages: [{ name: 'Home', slug: '', body: [{ type: 'heading', id: 'title', attributes: { content: 'secret ' + process.env.PLITZI_ISOLATED_SECRET + ', home ' + process.env.HOME } }] }] };\n"
    );

    process.env.PLITZI_ISOLATED_SECRET = 'hunter2';
    const result = await authorIsolated(file);
    delete process.env.PLITZI_ISOLATED_SECRET;

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.space.handles.element('title').selector).toBe('[data-plitzi-el="title"]');
      expect(result.space.handles.page('').id).toBe('page-1');
      expect(JSON.stringify(result.space.schema)).toContain('secret undefined, home undefined');
    }
  });

  it('answers a refusal as authorSpace says it, with the problems as data', async () => {
    const file = moduleOf(
      'refused',
      "export const space = { name: 'Weather', permanentUrl: 'weather', pages: [{ name: 'Home', slug: '', body: [{ type: 'heading', id: 'title', content: 'Hi' }] }] };\n"
    );

    const result = await authorIsolated(file);

    expect(result).toMatchObject({ ok: false, reason: 'refused' });
    if (!result.ok && result.reason === 'refused') {
      expect(result.message).toContain('[unknown-field]');
      expect(result.refusals[0]).toMatchObject({ code: 'unknown-field', place: '"title"' });
    }
  });

  it('refuses a module that writes a file, where it tried', async () => {
    const file = moduleOf(
      'writes',
      "import { writeFileSync } from 'node:fs';\nwriteFileSync('/tmp/plitzi-isolated-escape.txt', 'x');\nexport const space = {};\n"
    );

    expect(await authorIsolated(file)).toEqual({
      ok: false,
      reason: 'failed',
      message: 'writes.ts:2: Access to this API has been restricted. Use --allow-fs-write to manage permissions.'
    });
    expect(existsSync('/tmp/plitzi-isolated-escape.txt')).toBe(false);
  });

  it('says what a module that exports no space should export', async () => {
    const file = moduleOf('nothing', 'export const page = {};\n');

    expect(await authorIsolated(file)).toMatchObject({
      ok: false,
      reason: 'failed',
      message: expect.stringContaining('nothing.ts exports no `space`') as unknown
    });
  });

  it('stops a module that never finishes', async () => {
    const file = moduleOf('loops', 'while (true) {}\n');

    expect(await authorIsolated(file, { timeoutMs: 1500 })).toMatchObject({ ok: false, reason: 'timeout' });
  });

  it('takes nothing it answers on trust: a forged answer is checked again', async () => {
    const file = moduleOf(
      'forges',
      'process.send({ ok: true, space: { schema: { flat: {} }, style: {}, handles: {}, warnings: [], suggestions: [] } });\nprocess.exit(0);\n'
    );

    expect(await authorIsolated(file)).toMatchObject({ ok: false, reason: 'invalid' });
  });
});
