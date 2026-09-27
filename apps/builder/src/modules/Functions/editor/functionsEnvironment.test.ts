import { getAutocompletion, getLints } from '@valtown/codemirror-ts';
import { describe, expect, it } from 'vitest';

import { createFunctionsEnvironment } from './functionsEnvironment';
import { workerPathOf } from './useFunctionsTypeScript';

const INDEX = `import { defineFunctions } from '@plitzi/sdk-server/functions';
import { label } from './lib/label';

export default defineFunctions({
  allow: { hosts: ['api.example.com'] },
  tasks: [
    {
      namespace: 'feed',
      action: 'read',
      title: 'Read',
      params: {},
      run: async (_params, ctx) => {
        const response = await ctx.fetch('https://api.example.com/items');
        await ctx.kv.set('last', label(response.status));
        return ctx.user?.username;
      }
    }
  ]
});
`;

const environmentWith = (files: Record<string, string>) => {
  const env = createFunctionsEnvironment();
  Object.entries(files).forEach(([file, code]) => env.createFile(workerPathOf(file), code));

  return env;
};

const lintsOf = (files: Record<string, string>, file = 'index.ts') =>
  getLints({ env: environmentWith(files), path: workerPathOf(file), diagnosticCodesToIgnore: [] }).map(
    lint => lint.message
  );

describe('the TypeScript a space’s functions are checked with', () => {
  it('knows the contract and the space’s own files, and finds nothing wrong in correct code', () => {
    expect(
      lintsOf({ 'index.ts': INDEX, 'lib/label.ts': 'export const label = (n: number): string => String(n);' })
    ).toEqual([]);
  });

  it('underlines what the contract does not have', () => {
    const lints = lintsOf({
      'index.ts': INDEX.replace('ctx.kv.set(', 'ctx.kv.put('),
      'lib/label.ts': 'export const label = (n: number): string => String(n);'
    });

    expect(lints.some(message => message.includes('does not exist') && message.includes('put'))).toBe(true);
  });

  it('offers what ctx has', async () => {
    const code =
      'import { defineFunctions } from "@plitzi/sdk-server/functions";\nexport default defineFunctions({ tasks: [{ namespace: "a", action: "b", title: "B", params: {}, run: (_p, ctx) => ctx. }] });';
    const env = environmentWith({ 'index.ts': code });
    const completion = await getAutocompletion({
      env,
      path: workerPathOf('index.ts'),
      context: { pos: code.indexOf('ctx. ') + 4, explicit: true }
    });

    expect(completion?.options.map(option => option.label)).toEqual(
      expect.arrayContaining(['kv', 'fetch', 'log', 'user'])
    );
  });

  it('knows no Node', () => {
    expect(lintsOf({ 'index.ts': 'import fs from "node:fs";\nexport default fs;' })[0]).toContain('node:fs');
  });
});
