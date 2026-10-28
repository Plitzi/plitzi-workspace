import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { managerAt, projectAdd, projectDlx, projectExec, projectRun, setProjectManager } from './packageManager';

let dir: string;

beforeEach(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), 'plitzi-manager-'));
});

afterEach(async () => {
  setProjectManager('npm');
  await fs.rm(dir, { recursive: true, force: true });
});

// A pnpm project read `npm run author` and `npx plitzi …` in every message, and in its agents' prompt.
describe('the commands a message names, said the project’s way', () => {
  it('reads the project’s manager off its lockfile, from a folder in it up — a workspace’s above its package', async () => {
    const app = path.join(dir, 'apps', 'site');
    await fs.mkdir(app, { recursive: true });
    expect(managerAt(app)).toBeUndefined();

    await fs.writeFile(path.join(dir, 'pnpm-lock.yaml'), "lockfileVersion: '9.0'\n");
    expect(managerAt(app)).toBe('pnpm');
    await fs.writeFile(path.join(app, 'yarn.lock'), '');
    expect(managerAt(app)).toBe('yarn');
  });

  it('says a script, a package’s command, one added and one run once, as each manager does', () => {
    const said = () => [
      projectRun('author'),
      projectRun('start'),
      projectExec('plitzi space lint'),
      projectAdd('-D typescript'),
      projectDlx('@plitzi/cli@latest doctor')
    ];

    expect(said()).toEqual([
      'npm run author',
      'npm start',
      'npx plitzi space lint',
      'npm install -D typescript',
      'npx -y @plitzi/cli@latest doctor'
    ]);
    setProjectManager('pnpm');
    expect(said()).toEqual([
      'pnpm author',
      'pnpm start',
      'pnpm exec plitzi space lint',
      'pnpm add -D typescript',
      'pnpm dlx @plitzi/cli@latest doctor'
    ]);
    setProjectManager('yarn');
    expect(said()).toEqual([
      'yarn author',
      'yarn start',
      'yarn plitzi space lint',
      'yarn add -D typescript',
      'yarn dlx @plitzi/cli@latest doctor'
    ]);
  });
});
