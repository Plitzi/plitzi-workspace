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

  /** The project's data is beside its functions, and the one thing outside them code reaches for: it is read, not built in. */
  it('names the boundary, and ctx.data, for an import that climbs out of functions/', async () => {
    const problems = await problemsOf({
      'index.ts': 'import "./lib/feed";\nexport default {};',
      'lib/feed.ts':
        'import products from "../../data/shop/products.json";\nimport "../../config";\nexport { products };'
    });

    expect(problems.map(({ file }) => file)).toEqual(['lib/feed.ts', 'lib/feed.ts']);
    expect(problems[0]?.message).toContain(
      '"../../data/shop/products.json" is outside functions/: functions import only files under functions/'
    );
    expect(problems[0]?.message).toMatch(/read the space's data with ctx\.data\('shop\/products\.json'\)$/);
    expect(problems[1]?.message).toMatch(/^"\.\.\/\.\.\/config" is outside functions\/: .* ctx\.data\('<file>'\)$/);
  });

  it('points at a syntax error in the file it is in', async () => {
    const problems = await problemsOf({ 'index.ts': 'import "./broken";', 'broken.ts': 'const = 1;' });

    expect(problems[0]).toMatchObject({ file: 'broken.ts', line: 1 });
  });

  it('needs a file at the top of functions/, and paths that stay inside it', async () => {
    const problems = await problemsOf({ 'lib/helper.ts': '', '../escape.ts': '' });

    expect(problems.map(({ message }) => message)).toEqual([
      expect.stringContaining('relative path under functions/'),
      expect.stringContaining('the files at the top of functions/')
    ]);
  });

  // encore: every domain appended to one index.ts, and four conflicts and three integration tasks were that list.
  describe('a domain a file, with nothing listing them', () => {
    const domain = (namespace: string, extra = '') => `import { defineFunctions } from '@plitzi/sdk-server/functions';

export default defineFunctions({
  tasks: [{ namespace: '${namespace}', action: 'list', title: 'List', params: {}, run: () => '${namespace}' }]${extra}
});
`;
    const load = async (source: Record<string, string>) => {
      const { code } = await buildFunctions(source);

      return (
        (await import(`data:text/javascript,${encodeURIComponent(code)}`)) as {
          default: { tasks: { namespace: string; run: () => string }[]; allow?: { hosts: string[] } };
        }
      ).default;
    };

    it('merges every top-level file’s definition — a test, a helper in a folder and a module of types left out', async () => {
      const merged = await load({
        'rooms.ts': domain('rooms', ", allow: { hosts: ['www.youtube.com'] }"),
        'queue.ts': domain('queue', ", allow: { hosts: ['www.youtube.com', 'oembed.example'] }"),
        'types.ts': 'export type Room = { slug: string };',
        'queue.test.ts': "import { test } from 'node:test';",
        'lib/helper.ts': 'export default { tasks: [] };'
      });

      expect(merged.tasks.map(task => task.namespace).sort()).toEqual(['queue', 'rooms']);
      expect(merged.allow?.hosts.sort()).toEqual(['oembed.example', 'www.youtube.com']);
    });

    it('keeps one index.ts that lists them as it was', async () => {
      const merged = await load({ 'index.ts': INDEX, 'lib/label.ts': 'export const label = () => `ok`;' });

      expect(merged.tasks.map(task => task.namespace)).toEqual(['feed']);
    });

    it('refuses a task two files define, naming both', async () => {
      await expect(load({ 'a.ts': domain('rooms'), 'b.ts': domain('rooms') })).rejects.toThrow(
        'The task rooms.list is defined twice: in a.ts and in b.ts'
      );
    });

    it('says none when no top-level file exports a definition', async () => {
      await expect(load({ 'types.ts': 'export type Room = { slug: string };' })).rejects.toThrow(
        'No file at the top of functions/ exports a definition by default'
      );
    });
  });

  it('refuses a bundle over the size a runner takes', async () => {
    const problems = await problemsOf({
      'index.ts': `export default ${JSON.stringify('x'.repeat(MAX_FUNCTIONS_BYTES))};`
    });

    expect(problems[0]?.message).toContain('at most');
  });
});
