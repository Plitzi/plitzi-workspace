import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { PREVIEW_FILE_ENV } from '@plitzi/sdk-shared/project';

import { aloneCopies, alonePreview } from './alone';

// A run's reviewers could not look at a plugin no page placed yet, with `status` undefined and then 'banana'.
describe('an element drawn alone by a look', () => {
  it('is one copy as declared, or a copy for each --with', () => {
    expect(aloneCopies('vzStatusBadge')).toEqual([{}]);
    expect(aloneCopies('vzStatusBadge', ['{}', '{"status":"banana"}'])).toEqual([{}, { status: 'banana' }]);
  });

  it('refuses a --with that is not a JSON object, saying which and what to write', () => {
    expect(() => aloneCopies('vzStatusBadge', ['{}', 'status=banana'])).toThrow(
      /--with 2 is not a JSON object: each --with is the props \(a component\) or the attributes \(an element\) of one copy of vzStatusBadge/
    );
    expect(() => aloneCopies('vzStatusBadge', ['[1]'])).toThrow(/--with 1 is not a JSON object/);
  });

  it('is written where the look’s server reads it, named to it by its environment', async () => {
    const cache = await fs.mkdtemp(path.join(os.tmpdir(), 'plitzi-alone-'));
    try {
      const { env, copies } = await alonePreview(cache, 'plan-card', ['{"name":"Pro"}']);
      expect(copies).toBe(1);
      expect(JSON.parse(await fs.readFile(env[PREVIEW_FILE_ENV], 'utf-8'))).toEqual({
        element: 'plan-card',
        copies: [{ name: 'Pro' }]
      });
    } finally {
      await fs.rm(cache, { recursive: true, force: true });
    }
  });
});
