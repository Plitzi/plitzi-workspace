import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { localPackages } from './localPackages';

describe('localPackages', () => {
  let root = '';

  const write = async (file: string, value: unknown): Promise<void> => {
    await fs.mkdir(path.dirname(path.join(root, file)), { recursive: true });
    await fs.writeFile(path.join(root, file), typeof value === 'string' ? value : JSON.stringify(value));
  };

  /** One package of the scope, installed as npm installs it: its manifest in `node_modules`, and its row in a lock. */
  const installed = async (name: string, version: string): Promise<void> => {
    await write(`node_modules/${name}/package.json`, { name, version });
  };

  const npmLock = (packages: Record<string, { version: string; resolved: string }>) => ({
    lockfileVersion: 3,
    packages: Object.fromEntries(Object.entries(packages).map(([name, entry]) => [`node_modules/${name}`, entry]))
  });

  const registry = (name: string, version: string) => ({
    version,
    resolved: `https://registry.npmjs.org/${name}/-/${name.split('/')[1]}-${version}.tgz`
  });

  beforeEach(async () => {
    root = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'plitzi-local-packages-')));
    await write('package.json', {
      dependencies: { '@plitzi/sdk-authoring': '^0.38.6', '@plitzi/sdk-server': '^0.38.6' }
    });
  });

  afterEach(async () => {
    await fs.rm(root, { recursive: true, force: true });
  });

  it('finds nothing in a project installed from the registry as its lockfile says', async () => {
    await installed('@plitzi/sdk-authoring', '0.38.6');
    const lock = npmLock({ '@plitzi/sdk-authoring': registry('@plitzi/sdk-authoring', '0.38.6') });
    await write('package-lock.json', lock);
    await write('node_modules/.package-lock.json', lock);

    expect(await localPackages(root)).toEqual([]);
  });

  // What `npm install --no-save ./tgz/*.tgz` leaves: the saved lockfile says the registry, the installed one the tarball.
  it('finds a tarball installed by hand, at the version the registry has too', async () => {
    await installed('@plitzi/sdk-authoring', '0.38.6');
    await installed('@plitzi/sdk-shared', '0.38.6');
    await write(
      'package-lock.json',
      npmLock({
        '@plitzi/sdk-authoring': registry('@plitzi/sdk-authoring', '0.38.6'),
        '@plitzi/sdk-shared': registry('@plitzi/sdk-shared', '0.38.6')
      })
    );
    await write(
      'node_modules/.package-lock.json',
      npmLock({
        '@plitzi/sdk-authoring': { version: '0.38.6', resolved: 'file:../tgz/plitzi-sdk-authoring-0.38.6.tgz' },
        '@plitzi/sdk-shared': registry('@plitzi/sdk-shared', '0.38.6')
      })
    );

    expect(await localPackages(root)).toEqual([
      {
        name: '@plitzi/sdk-authoring',
        from: 'installed from file:../tgz/plitzi-sdk-authoring-0.38.6.tgz, not from the registry'
      }
    ]);
  });

  it('finds another version installed than the one the lockfile saved', async () => {
    await installed('@plitzi/sdk-server', '0.39.0-dev');
    await write('package-lock.json', npmLock({ '@plitzi/sdk-server': registry('@plitzi/sdk-server', '0.38.6') }));
    await write(
      'node_modules/.package-lock.json',
      npmLock({ '@plitzi/sdk-server': registry('@plitzi/sdk-server', '0.39.0-dev') })
    );

    expect(await localPackages(root)).toEqual([
      { name: '@plitzi/sdk-server', from: 'installed at 0.39.0-dev by hand — package-lock.json has 0.38.6' }
    ]);
  });

  it('finds a package linked in, whatever installed it', async () => {
    await write('checkouts/sdk-authoring/package.json', { name: '@plitzi/sdk-authoring', version: '0.39.0' });
    await fs.mkdir(path.join(root, 'node_modules/@plitzi'), { recursive: true });
    await fs.symlink(path.join(root, 'checkouts/sdk-authoring'), path.join(root, 'node_modules/@plitzi/sdk-authoring'));

    expect(await localPackages(root)).toEqual([
      { name: '@plitzi/sdk-authoring', from: 'linked to checkouts/sdk-authoring' }
    ]);
  });

  it('finds what package.json asks for off the registry, or overrides — each package once', async () => {
    await write('package.json', {
      dependencies: { '@plitzi/sdk-authoring': 'file:../tgz/sdk-authoring.tgz', '@plitzi/sdk-server': '^0.38.6' },
      devDependencies: { '@plitzi/cli': 'portal:../cli' },
      overrides: { '@plitzi/sdk-server': 'file:../tgz/sdk-server.tgz', '@plitzi/sdk-authoring': '0.38.6' },
      resolutions: { '**/@plitzi/sdk-shared': 'link:../sdk-shared' },
      pnpm: { overrides: { '@plitzi/sdk-style@0.38': '0.38.7' } }
    });

    expect(await localPackages(root)).toEqual([
      { name: '@plitzi/cli', from: 'package.json asks for portal:../cli' },
      { name: '@plitzi/sdk-authoring', from: 'package.json asks for file:../tgz/sdk-authoring.tgz' },
      { name: '@plitzi/sdk-server', from: 'package.json overrides it ("overrides": "file:../tgz/sdk-server.tgz")' },
      { name: '@plitzi/sdk-shared', from: 'package.json overrides it ("resolutions": "link:../sdk-shared")' },
      { name: '@plitzi/sdk-style', from: 'package.json overrides it ("pnpm.overrides": "0.38.7")' }
    ]);
  });
});
