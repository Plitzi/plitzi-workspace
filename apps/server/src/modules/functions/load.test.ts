import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { FunctionsBuildError } from './build';
import { loadFunctions } from './load';
import { functionTryEntry } from './tryEntry';
import { createActionsModule } from '../actions';

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(path.join(tmpdir(), 'functions-'));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

const write = async (file: string, text: string) => {
  await mkdir(path.dirname(path.join(dir, file)), { recursive: true });
  await writeFile(path.join(dir, file), text);
};

describe('a server’s own functions from a directory', () => {
  it('are built as the platform builds a space’s, extensionless imports included, and loaded', async () => {
    await write(
      'index.ts',
      'import { defineFunctions } from "@plitzi/sdk-server/functions";\nimport { label } from "./lib/label";\nexport default defineFunctions({ tasks: [{ namespace: "own", action: "label", title: "Label", params: {}, run: () => label(3) }] });'
    );
    await write('lib/label.ts', 'export const label = (n: number): string => `${String(n)} items`;');
    const module = createActionsModule({
      lookups: { getAction: () => Promise.resolve(undefined) },
      functions: { native: await loadFunctions(dir) }
    });
    const result = await module.runAction({
      entry: functionTryEntry('own.label', {}),
      input: {},
      callerId: 'local',
      user: { id: 1, username: 'ada', email: 'ada@example.com', verified: true, permissions: [], roles: [], token: '' },
      spaceId: 1,
      environment: 'main',
      trigger: 'call',
      runId: 'run-1'
    });

    expect(result.output.value).toBe('3 items');
  });

  // The bundle carries its own copy of the class: told apart by its name, the reason reached the page; by `instanceof`, never.
  it('refuse with a reason that reaches whoever ran them', async () => {
    await write(
      'index.ts',
      'import { ActionRefusal, defineFunctions } from "@plitzi/sdk-server/functions";\nexport default defineFunctions({ tasks: [{ namespace: "own", action: "make", title: "Make", params: {}, run: () => { throw new ActionRefusal("The link has to start with https://"); } }] });'
    );
    const module = createActionsModule({
      lookups: { getAction: () => Promise.resolve(undefined) },
      functions: { native: await loadFunctions(dir) }
    });
    const result = await module.runAction({
      entry: functionTryEntry('own.make', {}),
      input: {},
      callerId: 'local',
      user: { id: 1, username: 'ada', email: 'ada@example.com', verified: true, permissions: [], roles: [], token: '' },
      spaceId: 1,
      environment: 'main',
      trigger: 'call',
      runId: 'run-1'
    });

    expect([result.status, result.error]).toEqual(['failed', 'The link has to start with https://']);
  });

  it('are none where there is nothing', async () => {
    expect(await loadFunctions(path.join(dir, 'missing'))).toEqual([]);
  });

  it('stop the server where they do not build', async () => {
    await write('index.ts', 'import fs from "node:fs";\nexport default { fs };');

    await expect(loadFunctions(dir)).rejects.toBeInstanceOf(FunctionsBuildError);
  });
});
