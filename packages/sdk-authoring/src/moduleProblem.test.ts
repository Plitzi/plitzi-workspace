import { describe, expect, it } from 'vitest';

import { moduleProblem } from './node';

// A project's file that does not parse is said at its line, as the problem — never a stack the command dies with.
describe('a project that does not load', () => {
  it('is said at the first of its own files the error points at', () => {
    const error = new SyntaxError('Expected a comma, got class');
    error.stack = [
      'file:///work/shop/src/space/hero.ts:139',
      'SyntaxError: Expected a comma, got class',
      '    at parseTypeScript (node:internal/modules/typescript:72:36)'
    ].join('\n');

    expect(moduleProblem(error, '/work/shop')).toMatch(/src\/space\/hero\.ts:139: Expected a comma, got class$/);
  });

  it('says only what it says when no file of the project is in it', () => {
    expect(moduleProblem(new Error('out of memory'), '/work/shop')).toBe('out of memory');
  });
});
