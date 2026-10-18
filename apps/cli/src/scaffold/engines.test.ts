import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { NODE_ENGINES } from './project';

const WORKSPACE = path.resolve(import.meta.dirname, '../../../..');

/**
 * The Node a project needs is the Node the packages it runs in Node need: one floor, written into every project the
 * CLI makes (`NODE_ENGINES`) and declared by each package that runs there — so installing one on an older Node says so
 * instead of failing on the first API it does not have (`--env-file-if-exists`, `--permission`, `Set#union`). The
 * browser's packages declare none: a bundler is what reads them.
 */
const RUN_IN_NODE = ['apps/server', 'apps/cli', 'apps/mcp', 'packages/sdk-authoring', '.'];

describe('the Node every package that runs in it declares', () => {
  it.each(RUN_IN_NODE)('%s asks for the Node a project is made for', dir => {
    const manifest: unknown = JSON.parse(fs.readFileSync(path.join(WORKSPACE, dir, 'package.json'), 'utf-8'));

    expect(manifest).toHaveProperty('engines', NODE_ENGINES);
  });
});
