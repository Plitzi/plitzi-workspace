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

/** Every manifest of the workspace — the examples too, which a self-hoster copies whole. */
const manifests = (dir: string): string[] =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name.startsWith('.')) {
      return [];
    }

    const full = path.join(dir, entry.name);

    return entry.isDirectory() ? manifests(full) : entry.name === 'package.json' ? [full] : [];
  });

describe('the Node every package that runs in it declares', () => {
  it.each(RUN_IN_NODE)('%s asks for the Node a project is made for', dir => {
    const manifest: unknown = JSON.parse(fs.readFileSync(path.join(WORKSPACE, dir, 'package.json'), 'utf-8'));

    expect(manifest).toHaveProperty('engines', NODE_ENGINES);
  });

  it('is the one range in every package that says one, the examples too', () => {
    const others = ['apps', 'packages', 'examples']
      .flatMap(dir => manifests(path.join(WORKSPACE, dir)))
      .flatMap(file => {
        const engines = (JSON.parse(fs.readFileSync(file, 'utf-8')) as { engines?: { node?: string } }).engines?.node;

        return engines === undefined || engines === NODE_ENGINES.node ? [] : [path.relative(WORKSPACE, file)];
      });

    expect(others).toEqual([]);
  });

  // Node 24 at least, from its security release: CI runs that very patch (`.nvmrc`), never an older one on its line.
  it('is what CI runs, and Node 24 at least', () => {
    const pinned = fs.readFileSync(path.join(WORKSPACE, '.nvmrc'), 'utf-8').trim();

    expect(NODE_ENGINES.node).toContain(`^${pinned}`);
    const majors = NODE_ENGINES.node.split('||').map(part => Number(/\d+/.exec(part)?.[0]));
    expect(Math.min(...majors)).toBeGreaterThanOrEqual(24);
  });
});
