/* eslint-disable quotes */
import { expect, describe, it } from 'vitest';

import { processTwig } from '../index';

describe('AST processTwig — keepEmptyTokens', () => {
  it('resolves a present token', () => {
    expect(processTwig('{{ a }}', { a: 'X' }, true)).toBe('X');
    expect(processTwig('{{ a }}', { a: 0 }, true)).toBe('0');
  });

  it('keeps the original token text on a miss or an empty string', () => {
    expect(processTwig('{{ a }}', {}, true)).toBe('{{ a }}');
    expect(processTwig('{{ a }}', { a: '' }, true)).toBe('{{ a }}');
    expect(processTwig('Hello {{ name }}', {}, true)).toBe('Hello {{ name }}');
  });

  it('resolves the hit and keeps the miss when both appear', () => {
    expect(processTwig('{{ a }} {{ b }}', { a: 'X' }, true)).toBe('X {{ b }}');
  });
});

describe('AST processTwig — asRaw', () => {
  it('returns a parsed object and typed primitives', () => {
    expect(processTwig('{{ o }}', { o: { a: 1, nested: { b: 2 } } }, false, true)).toEqual({ a: 1, nested: { b: 2 } });
    expect(processTwig('{{ n }}', { n: 5 }, false, true)).toBe(5);
    expect(processTwig('{{ b }}', { b: true }, false, true)).toBe(true);
  });

  it('returns a plain string when the result is not JSON', () => {
    expect(processTwig('{{ s }}', { s: 'hi' }, false, true)).toBe('hi');
  });
});

describe('AST processTwig — hyphenated source tokens', () => {
  it('resolves a hyphenated <type>_<idRef> token', () => {
    expect(
      processTwig('X {{ apiContainer_products-api.data.name }} Y', {
        'apiContainer_products-api': { data: { name: 'hello' } }
      })
    ).toBe('X hello Y');
  });

  it('resolves a hyphen in the first and in a later segment', () => {
    expect(processTwig('{{ node_flow-1.my-field }}', { 'node_flow-1': { 'my-field': 'ok' } })).toBe('ok');
  });
});

describe('AST processTwig — string literal escape sequences', () => {
  it('resolves \\n to a newline character', () => {
    expect(processTwig("{{ items | join('\\n') }}", { items: ['a', 'b', 'c'] })).toBe('a\nb\nc');
  });

  it('resolves \\t to a tab character', () => {
    expect(processTwig("{{ items | join('\\t') }}", { items: ['a', 'b'] })).toBe('a\tb');
  });

  it('resolves \\r to a carriage return', () => {
    expect(processTwig("{{ val | replace('\\r', '') }}", { val: 'a\rb' })).toBe('ab');
  });

  it('resolves double backslash to a literal backslash', () => {
    expect(processTwig("{{ val | replace('\\\\', '-') }}", { val: 'a\\b' })).toBe('a-b');
  });

  it('resolves escaped single quote inside single-quoted string', () => {
    expect(processTwig("{{ 'it\\'s' }}", {})).toBe("it's");
  });

  it('resolves escaped double quote inside double-quoted string', () => {
    expect(processTwig('{{ "say \\"hi\\"" }}', {})).toBe('say "hi"');
  });

  it('preserves unknown escape sequences as-is', () => {
    expect(processTwig("{{ '\\x' }}", {})).toBe('\\x');
  });

  it('handles multiple escape sequences in one string', () => {
    expect(processTwig("{{ 'a\\nb\\tc' }}", {})).toBe('a\nb\tc');
  });

  it('join with newline works end-to-end', () => {
    const result = processTwig("{{ source | join('\\n') }}", {
      source: ['line1', 'line2', 'line3']
    });
    expect(result).toBe('line1\nline2\nline3');
  });
});
