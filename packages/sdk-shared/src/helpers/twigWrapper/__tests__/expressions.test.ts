/* eslint-disable quotes */
import { expect, describe, it } from 'vitest';

import { processTwig } from '../index';

describe('AST processTwig — default (??) coalescing', () => {
  it('uses the default only when the value is undefined', () => {
    expect(processTwig("{{ x ?? 'def' }}", {})).toBe('def');
  });

  it('keeps an empty string and a zero rather than coalescing', () => {
    expect(processTwig("{{ x ?? 'def' }}", { x: '' })).toBe('');
    expect(processTwig("{{ x ?? 'def' }}", { x: 0 })).toBe('0');
  });
});

describe('AST processTwig — operator expressions', () => {
  it('supports not in operator', () => {
    expect(processTwig('{% if "x" not in items %}not found{% endif %}', { items: ['a', 'b', 'c'] })).toBe('not found');
    expect(processTwig('{% if "a" not in items %}not found{% endif %}', { items: ['a', 'b', 'c'] })).toBe('');
  });

  it('supports is operator (identity)', () => {
    expect(processTwig('{% if a is b %}same{% endif %}', { a: 5, b: 5 })).toBe('same');
    expect(processTwig('{% if a is b %}same{% endif %}', { a: 5, b: 6 })).toBe('');
  });

  it('supports is not operator', () => {
    expect(processTwig('{% if a is not b %}diff{% endif %}', { a: 5, b: 6 })).toBe('diff');
    expect(processTwig('{% if a is not b %}diff{% endif %}', { a: 5, b: 5 })).toBe('');
  });

  it('supports ~ (concat) operator', () => {
    expect(processTwig('{{ a ~ b ~ c }}', { a: 'hello', b: ' ', c: 'world' })).toBe('hello world');
  });

  it('supports concat with non-string values', () => {
    expect(processTwig('{{ a ~ b }}', { a: 'count: ', b: 42 })).toBe('count: 42');
  });

  it('supports and operator', () => {
    expect(processTwig('{% if a and b %}yes{% endif %}', { a: true, b: true })).toBe('yes');
    expect(processTwig('{% if a and b %}yes{% endif %}', { a: true, b: false })).toBe('');
    expect(processTwig('{% if a and b %}yes{% endif %}', { a: false, b: true })).toBe('');
  });

  it('supports or operator', () => {
    expect(processTwig('{% if a or b %}yes{% endif %}', { a: true, b: false })).toBe('yes');
    expect(processTwig('{% if a or b %}yes{% endif %}', { a: false, b: false })).toBe('');
  });

  it('supports not operator', () => {
    expect(processTwig('{% if not a %}yes{% endif %}', { a: false })).toBe('yes');
    expect(processTwig('{% if not a %}yes{% endif %}', { a: true })).toBe('');
  });

  it('supports combined and/or precedence', () => {
    expect(processTwig('{% if a and b or c %}yes{% endif %}', { a: true, b: false, c: true })).toBe('yes');
    expect(processTwig('{% if a and b or c %}yes{% endif %}', { a: false, b: false, c: false })).toBe('');
  });

  it('supports not in combination with and', () => {
    expect(processTwig('{% if "x" not in items and active %}yes{% endif %}', { items: ['a', 'b'], active: true })).toBe(
      'yes'
    );
  });
});

describe('AST processTwig — range() function', () => {
  it('generates range with single arg', () => {
    expect(processTwig('{% for i in range(5) %}{{ i }} {% endfor %}', {})).toBe('0 1 2 3 4 5 ');
  });

  it('generates range with start and end', () => {
    expect(processTwig('{% for i in range(2, 6) %}{{ i }} {% endfor %}', {})).toBe('2 3 4 5 6 ');
  });

  it('generates range with step', () => {
    expect(processTwig('{% for i in range(0, 10, 2) %}{{ i }} {% endfor %}', {})).toBe('0 2 4 6 8 10 ');
  });

  it('generates reverse range with negative step', () => {
    expect(processTwig('{% for i in range(10, 0, -3) %}{{ i }} {% endfor %}', {})).toBe('10 7 4 1 ');
  });
});

describe('AST processTwig — min/max functions', () => {
  it('computes max of multiple args', () => {
    expect(processTwig('{{ max(3, 7, 1) }}', {})).toBe('7');
  });

  it('computes min of multiple args', () => {
    expect(processTwig('{{ min(3, 7, 1) }}', {})).toBe('1');
  });

  it('computes max of array', () => {
    expect(processTwig('{{ max([3, 7, 1]) }}', {})).toBe('7');
  });

  it('computes min of array', () => {
    expect(processTwig('{{ min([3, 7, 1]) }}', {})).toBe('1');
  });

  it('returns empty for no args', () => {
    expect(processTwig('{{ max() }}', {})).toBe('');
    expect(processTwig('{{ min() }}', {})).toBe('');
  });
});

describe('AST processTwig — ternary expressions', () => {
  it('simple ternary true/false', () => {
    expect(processTwig('{{ active ? "yes" : "no" }}', { active: true })).toBe('yes');
    expect(processTwig('{{ active ? "yes" : "no" }}', { active: false })).toBe('no');
  });

  it('nested ternary', () => {
    expect(processTwig('{{ score >= 90 ? "A" : (score >= 80 ? "B" : "C") }}', { score: 85 })).toBe('B');
  });

  it('triple nested ternary', () => {
    expect(processTwig("{{ v == 1 ? 'one' : (v == 2 ? 'two' : (v == 3 ? 'three' : 'other')) }}", { v: 3 })).toBe(
      'three'
    );
  });

  it('right-associates an unparenthesised nested ternary in the false branch', () => {
    // Regression: the false branch must recurse into parseTernary, not parseOr, so `? :` can chain.
    const tmpl = '{{ x == 1 ? "one" : x == 2 ? "two" : "other" }}';
    expect(processTwig(tmpl, { x: 1 })).toBe('one');
    expect(processTwig(tmpl, { x: 2 })).toBe('two');
    expect(processTwig(tmpl, { x: 9 })).toBe('other');
  });

  it('unary minus negates a variable and a parenthesised expression', () => {
    expect(processTwig('{{ -x }}', { x: 5 })).toBe('-5');
    expect(processTwig('{{ -x }}', { x: -5 })).toBe('5');
    expect(processTwig('{{ -(a + b) }}', { a: 2, b: 3 })).toBe('-5');
    expect(processTwig('{{ 10 - -2 }}', {})).toBe('12');
  });

  it('ternary with expressions on both sides', () => {
    expect(processTwig('{{ x > 0 ? x * 2 : 0 }}', { x: 5 })).toBe('10');
    expect(processTwig('{{ x > 0 ? x * 2 : 0 }}', { x: -1 })).toBe('0');
  });
});

describe('AST processTwig — default coalescing edge cases', () => {
  it('default with nested path', () => {
    expect(processTwig("{{ a.b ?? 'none' }}", { a: {} })).toBe('none');
  });

  it('default with nested path present', () => {
    expect(processTwig("{{ a.b ?? 'none' }}", { a: { b: 'found' } })).toBe('found');
  });

  it('chained default', () => {
    expect(processTwig("{{ a ?? b ?? 'fallback' }}", {})).toBe('fallback');
  });

  it('chained default with first present', () => {
    expect(processTwig("{{ a ?? b ?? 'fallback' }}", { a: 'first' })).toBe('first');
  });

  it('chained default with second present', () => {
    expect(processTwig("{{ a ?? b ?? 'fallback' }}", { b: 'second' })).toBe('second');
  });
});
