// @vitest-environment node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { checkProjectRoot, projectModule, projectRoot } from './root';

let folder: string;

beforeEach(() => {
  folder = fs.mkdtempSync(path.join(os.tmpdir(), 'plitzi-project-root-'));
});

afterEach(() => {
  vi.restoreAllMocks();
  fs.rmSync(folder, { recursive: true, force: true });
});

const project = (): string => {
  fs.writeFileSync(path.join(folder, 'package.json'), '{}\n');
  fs.mkdirSync(path.join(folder, 'src'));

  return folder;
};

describe('the root of a project', () => {
  it('is the working directory, when it holds the project’s package.json and src/', () => {
    vi.spyOn(process, 'cwd').mockReturnValue(project());

    expect(projectRoot()).toBe(folder);
  });

  it('refuses a working directory that is not one, naming all it lacks and where to run from', () => {
    vi.spyOn(process, 'cwd').mockReturnValue(folder);

    expect(() => projectRoot()).toThrow(
      `${folder} is not the root of a Plitzi project: it has no package.json and no src/. Run it from the project's root`
    );
  });

  // A process started in `src/` — `node main.ts` there — finds no package.json beside it.
  it('refuses a folder inside the project', () => {
    project();

    expect(() => checkProjectRoot(path.join(folder, 'src'))).toThrow('it has no package.json and no src/.');
  });

  // A package.json alone is any package's — a monorepo's root, the folder above the project.
  it('refuses a package with no source', () => {
    fs.writeFileSync(path.join(folder, 'package.json'), '{}\n');

    expect(() => checkProjectRoot(folder)).toThrow(`${folder} is not the root of a Plitzi project: it has no src/.`);
  });

  it('takes a root found from elsewhere, held to the same check', () => {
    expect(checkProjectRoot(project())).toBe(folder);
  });
});

describe('where a module of the project’s source is, in the form the process runs in', () => {
  const built = (): string => {
    project();
    fs.mkdirSync(path.join(folder, 'dist'));
    fs.writeFileSync(path.join(folder, 'src/main.ts'), '');
    fs.writeFileSync(path.join(folder, 'dist/main.js'), '');

    return folder;
  };

  it('is the source while the process runs from its source', () => {
    const root = built();

    expect(projectModule(root, 'src/space/index.ts', path.join(root, 'src/main.ts'))).toBe(
      path.join(root, 'src/space/index.ts')
    );
  });

  // What `build` emitted carries no TypeScript: a process run compiled never imports a `.ts` file.
  it('is the compiled one while the process runs compiled', () => {
    const root = built();

    expect(projectModule(root, 'src/runtime/index.ts', path.join(root, 'dist/main.js'))).toBe(
      path.join(root, 'dist/runtime/index.js')
    );
  });

  it('follows a link to the compiled entry', () => {
    const root = built();
    const linked = path.join(root, 'server.js');
    fs.symlinkSync(path.join(root, 'dist/main.js'), linked);

    expect(projectModule(root, 'src/space/index.ts', linked)).toBe(path.join(root, 'dist/space/index.js'));
  });

  // A folder named like it is not it: only what is under the project's own `dist/`.
  it('is the source for any script outside the project’s dist/ — a test runner, a folder beside it', () => {
    const root = built();

    expect(projectModule(root, 'src/space/index.ts', path.join(root, 'dist-old/main.js'))).toBe(
      path.join(root, 'src/space/index.ts')
    );
    expect(projectModule(root, 'src/space/index.ts', '/usr/local/bin/vitest')).toBe(
      path.join(root, 'src/space/index.ts')
    );
    expect(projectModule(root, 'src/space/index.ts', undefined)).toBe(path.join(root, 'src/space/index.ts'));
  });
});
