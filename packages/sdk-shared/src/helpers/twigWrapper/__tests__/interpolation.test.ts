import { expect, describe, it } from 'vitest';

import { processTwig } from '../index';

describe('AST processTwig — passthrough', () => {
  it('returns a non-string untouched', () => {
    expect(processTwig(42 as unknown as string)).toBe(42);
    expect(processTwig(null as unknown as string)).toBeNull();
    expect(processTwig(undefined as unknown as string)).toBeUndefined();
  });

  it('returns a string with no tokens unchanged', () => {
    expect(processTwig('already resolved')).toBe('already resolved');
    expect(processTwig('')).toBe('');
  });

  it('returns the original template on a twig syntax error', () => {
    expect(processTwig('{{ invalid ')).toBe('{{ invalid ');
  });
});

describe('AST processTwig — plain interpolation', () => {
  it('resolves a simple, nested and deep token', () => {
    expect(processTwig('{{ name }}', { name: 'Peter' })).toBe('Peter');
    expect(processTwig('{{ user.name }}', { user: { name: 'Peter' } })).toBe('Peter');
    expect(processTwig('{{ user.profile.email }}', { user: { profile: { email: 'a@b.com' } } })).toBe('a@b.com');
  });

  it('resolves a token embedded in surrounding text and multiple tokens', () => {
    expect(processTwig('Hello {{ name }}!', { name: 'Peter' })).toBe('Hello Peter!');
    expect(processTwig('{{ first }} {{ last }}', { first: 'Peter', last: 'Parker' })).toBe('Peter Parker');
  });

  it('renders a missing token or missing nested path as empty', () => {
    expect(processTwig('[{{ x }}]', {})).toBe('[]');
    expect(processTwig('[{{ a.b.c }}]', { a: {} })).toBe('[]');
  });

  it('renders an object token as JSON', () => {
    expect(processTwig('{{ o }}', { o: { a: 1 } })).toBe('{"a":1}');
  });

  it('merges variables.variables into the root context', () => {
    expect(processTwig('Hello {{ name }}', { variables: { name: 'Peter' } })).toBe('Hello Peter');
  });

  it('renders an object token as toString with triple braces', () => {
    expect(processTwig('{{{ o }}}', { o: { a: 1 } })).toBe('[object Object]');
  });

  it('renders mixed double and triple braces for same object', () => {
    const result = processTwig('{{ o }} vs {{{ o }}}', { o: { a: 1 } });
    expect(result).toBe('{"a":1} vs [object Object]');
  });

  it('triple braces with primitive renders same as double', () => {
    expect(processTwig('{{{ name }}}', { name: 'Peter' })).toBe('Peter');
  });
});

describe('AST processTwig — edge cases for interpolation', () => {
  it('renders null as empty', () => {
    expect(processTwig('{{ val }}', { val: null })).toBe('');
  });

  it('renders undefined as empty', () => {
    expect(processTwig('{{ val }}', { val: undefined })).toBe('');
  });

  it('renders boolean true as "true"', () => {
    expect(processTwig('{{ val }}', { val: true })).toBe('true');
  });

  it('renders boolean false as "false"', () => {
    expect(processTwig('{{ val }}', { val: false })).toBe('false');
  });

  it('renders number 0 as "0"', () => {
    expect(processTwig('{{ val }}', { val: 0 })).toBe('0');
  });

  it('renders negative number', () => {
    expect(processTwig('{{ val }}', { val: -42 })).toBe('-42');
  });

  it('renders float', () => {
    expect(processTwig('{{ val }}', { val: 3.14 })).toBe('3.14');
  });

  it('renders array as JSON', () => {
    expect(processTwig('{{ items }}', { items: [1, 2, 3] })).toBe('[1,2,3]');
  });

  it('renders deeply nested object', () => {
    expect(processTwig('{{ o }}', { o: { a: { b: { c: 42 } } } })).toBe('{"a":{"b":{"c":42}}}');
  });
});

describe('AST processTwig — deeply nested paths', () => {
  it('resolves 4-level deep path', () => {
    expect(processTwig('{{ a.b.c.d }}', { a: { b: { c: { d: 'deep' } } } })).toBe('deep');
  });

  it('returns empty on broken deep path', () => {
    expect(processTwig('{{ a.b.c.d }}', { a: { b: {} } })).toBe('');
  });

  it('resolves 5-level deep path', () => {
    expect(processTwig('{{ a.b.c.d.e }}', { a: { b: { c: { d: { e: 'deep5' } } } } })).toBe('deep5');
  });
});
