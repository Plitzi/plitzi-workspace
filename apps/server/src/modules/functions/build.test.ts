import { describe, expect, it } from 'vitest';

import { buildFunctions, FunctionsBuildError, MAX_FUNCTIONS_BYTES } from './build';

const INDEX = `import { defineFunctions } from '@plitzi/sdk-server/functions';
import { label } from './lib/label';

export default defineFunctions({
  tasks: [{ namespace: 'feed', action: 'label', title: 'Label', params: {}, run: () => label(2) }]
});
`;

const problemsOf = async (source: Record<string, string>) => {
  const error: unknown = await buildFunctions(source).then(
    () => undefined,
    (caught: unknown) => caught
  );
  if (!(error instanceof FunctionsBuildError)) {
    throw new Error('The build was expected to fail');
  }

  return error.problems;
};

describe('building a space’s functions', () => {
  it('bundles its own files and the contract into one module', async () => {
    const { code, bytes } = await buildFunctions({
      'index.ts': INDEX,
      'lib/label.ts': 'export const label = (count: number): string => `${String(count)} items`;'
    });
    const module = (await import(`data:text/javascript,${encodeURIComponent(code)}`)) as {
      default: { tasks: { run: () => string }[] };
    };

    expect(bytes).toBe(Buffer.byteLength(code));
    expect(code).not.toMatch(/^import /m);
    expect(module.default.tasks[0]?.run()).toBe('2 items');
  });

  it('refuses a package, a built-in and a file that is not there, saying where', async () => {
    const problems = await problemsOf({
      'index.ts':
        'import fs from "node:fs";\nimport lodash from "lodash";\nimport { x } from "./missing";\nexport default { fs, lodash, x };'
    });

    expect(problems.map(({ file, line }) => `${file ?? ''}:${String(line)}`)).toEqual([
      'index.ts:1',
      'index.ts:2',
      'index.ts:3'
    ]);
    expect(problems[0]?.message).toContain('"node:fs" cannot be imported');
    expect(problems[2]?.message).toContain('is not a file');
  });

  it('points at a syntax error in the file it is in', async () => {
    const problems = await problemsOf({ 'index.ts': 'import "./broken";', 'broken.ts': 'const = 1;' });

    expect(problems[0]).toMatchObject({ file: 'broken.ts', line: 1 });
  });

  it('needs an index.ts, and paths that stay inside functions/', async () => {
    const problems = await problemsOf({ 'main.ts': '', '../escape.ts': '' });

    expect(problems.map(({ message }) => message)).toEqual([
      expect.stringContaining('relative path under functions/'),
      expect.stringContaining('start from index.ts')
    ]);
  });

  it('refuses a bundle over the size a runner takes', async () => {
    const problems = await problemsOf({
      'index.ts': `export default ${JSON.stringify('x'.repeat(MAX_FUNCTIONS_BYTES))};`
    });

    expect(problems[0]?.message).toContain('at most');
  });
});
