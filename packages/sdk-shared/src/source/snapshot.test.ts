import { describe, expect, it } from 'vitest';

import { readSourceSnapshot, secretIn, sourcePathProblem } from './snapshot';

const encode = (text: string): string => Buffer.from(text).toString('base64');

const decode = (base64: string): string => Buffer.from(base64, 'base64').toString('utf-8');

const snapshot = (overrides: Record<string, unknown> = {}) => ({
  format: 1,
  kind: 'runtime',
  name: 'runtime',
  entries: ['runtime.ts'],
  files: {
    'runtime.ts': encode('import { model } from "./board/model.ts";\nexport default model;\n'),
    'board/model.ts': encode('export const model = 1;\n')
  },
  dependencies: { ioredis: '^5.4.0' },
  ...overrides
});

describe('a source snapshot', () => {
  it('is read back as it was packed', () => {
    const reading = readSourceSnapshot(snapshot(), decode);

    expect(reading).toMatchObject({ ok: true, snapshot: { kind: 'runtime', entries: ['runtime.ts'] } });
  });

  it('is refused with every problem at once', () => {
    const reading = readSourceSnapshot(
      snapshot({
        kind: 'theme',
        entries: ['missing.ts'],
        files: { '../outside.ts': encode('x'), '.env': encode('A=1'), 'node_modules/x/index.js': encode('x') }
      }),
      decode
    );

    expect(reading.ok).toBe(false);
    expect(reading.ok ? [] : reading.problems).toEqual([
      'Its kind is one of plugin, runtime',
      'Its entry "missing.ts" is not among its files',
      '"../outside.ts" climbs out of the project, or has an empty part',
      '".env" is a file of credentials: they stay where the project runs, never in what Plitzi keeps',
      '"node_modules/x/index.js" is in node_modules or .git: a package is a dependency, not a file of the project'
    ]);
  });

  it('never keeps a credential written into the code', () => {
    const reading = readSourceSnapshot(
      snapshot({
        files: {
          'runtime.ts': encode('export const key = "AKIAABCDEFGHIJKLMNOP";\n'),
          'board/model.ts': encode('export const model = 1;\n')
        }
      }),
      decode
    );

    expect(reading.ok ? [] : reading.problems).toEqual([
      '"runtime.ts" holds an AWS access key: take it out of the code and give it to the project as a variable'
    ]);
  });

  it('is not some other thing that happens to be JSON', () => {
    expect(readSourceSnapshot({ format: 2 }, decode)).toEqual({
      ok: false,
      problems: ['Not a source snapshot of format 1']
    });
  });
});

describe('what a snapshot never holds', () => {
  it('takes paths inside the project only', () => {
    expect(sourcePathProblem('plugins/Board/index.ts')).toBeUndefined();
    expect(sourcePathProblem('/etc/passwd')).toBeDefined();
    expect(sourcePathProblem('C:/x.ts')).toBeDefined();
    expect(sourcePathProblem('a\\b.ts')).toBeDefined();
    expect(sourcePathProblem('certs/server.pem')).toBeDefined();
    expect(sourcePathProblem('.env.local')).toBeDefined();
  });

  it('tells a credential from code that only names one', () => {
    expect(secretIn('-----BEGIN RSA PRIVATE KEY-----\nabc')).toBe('a private key');
    expect(secretIn('const PASSWORD_MIN = 12; const SECRET_NAME = "STRIPE_KEY";')).toBeUndefined();
  });
});
