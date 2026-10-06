// @vitest-environment node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { checkProjectRoot, projectRoot } from './root';

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
