/* eslint-disable quotes */
import { expect, describe, it } from 'vitest';

import { processTwig } from '.';
import { applyFilters, filters } from './filters';

const ctx = {};

describe('twig filters — value transforms', () => {
  it('upper, lower and trim transform only strings', () => {
    expect(processTwig('{{ name | upper }}', { name: 'peter' })).toBe('PETER');
    expect(processTwig('{{ name | lower }}', { name: 'PETER' })).toBe('peter');
    expect(processTwig('{{ name | trim }}', { name: '  hi  ' })).toBe('hi');
  });

  it('capitalize uppercases the first char and lowercases the rest', () => {
    expect(processTwig('{{ name | capitalize }}', { name: 'hELLO' })).toBe('Hello');
  });

  it('length counts a string, an array and an object', () => {
    expect(processTwig('{{ v | length }}', { v: 'abcd' })).toBe('4');
    expect(processTwig('{{ v | length }}', { v: [1, 2, 3] })).toBe('3');
    expect(processTwig('{{ v | length }}', { v: { a: 1, b: 2 } })).toBe('2');
  });

  it('join concatenates an array with the given separator', () => {
    expect(processTwig('{{ v | join(", ") }}', { v: ['a', 'b', 'c'] })).toBe('a, b, c');
    expect(processTwig('{{ v | join }}', { v: ['a', 'b'] })).toBe('ab');
  });

  it('chains filters left to right', () => {
    expect(processTwig('{{ name | trim | upper }}', { name: '  hi  ' })).toBe('HI');
  });

  it('ignores an unknown filter instead of throwing', () => {
    expect(() => processTwig('{{ name | wat }}', { name: 'x' })).not.toThrow();
    expect(processTwig('{{ name | wat }}', { name: 'x' })).toBe('x');
  });

  it('leaves a non-matching value type untouched', () => {
    expect(applyFilters(5, '| upper', ctx)).toBe(5);
    expect(applyFilters({ a: 1 }, '| trim', ctx)).toEqual({ a: 1 });
  });
});

describe('twig filters — default value support', () => {
  it('substitutes the default when the value is undefined, null or empty', () => {
    expect(processTwig("{{ missing | default('x') }}", {})).toBe('x');
    expect(processTwig("{{ v | default('x') }}", { v: '' })).toBe('x');
    expect(processTwig("{{ v | default('x') }}", { v: null })).toBe('x');
  });

  it('keeps a present value, including zero and false', () => {
    expect(processTwig("{{ v | default('x') }}", { v: 'here' })).toBe('here');
    expect(processTwig("{{ v | default('x') }}", { v: 0 })).toBe('0');
    expect(processTwig("{{ v | default('x') }}", { v: false })).toBe('false');
  });

  it('accepts another path as the default', () => {
    expect(processTwig('{{ missing | default(fallback) }}', { fallback: 'from-var' })).toBe('from-var');
  });

  it('the ?? operator remains an alias for a missing default', () => {
    expect(processTwig("{{ missing ?? 'x' }}", {})).toBe('x');
    expect(processTwig("{{ v ?? 'x' }}", { v: 'here' })).toBe('here');
  });

  it('exposes the filter registry for extension', () => {
    expect(typeof filters.default).toBe('function');
    expect(typeof filters.object_as_json).toBe('function');
  });
});

describe('twig filters — raw', () => {
  it('renders object as toString with double braces via | raw', () => {
    expect(processTwig('{{ o | raw }}', { o: { a: 1 } })).toBe('[object Object]');
  });

  it('renders string unchanged', () => {
    expect(processTwig('{{ name | raw }}', { name: 'hello' })).toBe('hello');
  });

  it('renders number unchanged', () => {
    expect(processTwig('{{ n | raw }}', { n: 42 })).toBe('42');
  });

  it('renders null/undefined as empty', () => {
    expect(processTwig('{{ v | raw }}', { v: null })).toBe('');
    expect(processTwig('{{ v | raw }}', {})).toBe('');
  });

  it('bypasses JSON serialization for objects in double braces', () => {
    expect(processTwig('{{ data | raw }}', { data: { x: 1, y: 2 } })).not.toBe('{"x":1,"y":2}');
    expect(processTwig('{{ data | raw }}', { data: { x: 1, y: 2 } })).toBe('[object Object]');
  });

  it('works with triple braces too', () => {
    expect(processTwig('{{{ v | raw }}}', { v: { a: 1 } })).toBe('[object Object]');
  });

  it('works with nested path', () => {
    expect(processTwig('{{ user.name | raw }}', { user: { name: 'Alice' } })).toBe('Alice');
  });

  it('works chained after other filters', () => {
    expect(processTwig('{{ name | upper | raw }}', { name: 'peter' })).toBe('PETER');
  });
});

describe('twig filters — to_json / json_encode', () => {
  it('serialises an object', () => {
    expect(processTwig('{{ o | to_json }}', { o: { a: 1 } })).toBe('{"a":1}');
  });

  it('serialises an array', () => {
    expect(processTwig('{{ v | to_json }}', { v: [1, 2, 3] })).toBe('[1,2,3]');
  });

  it('renders a string as-is (not quoted)', () => {
    expect(processTwig('{{ v | to_json }}', { v: 'hello' })).toBe('hello');
  });

  it('renders a number as string', () => {
    expect(processTwig('{{ v | to_json }}', { v: 42 })).toBe('42');
  });

  it('renders null as empty string', () => {
    expect(processTwig('{{ v | to_json }}', { v: null })).toBe('');
  });

  it('json_encode is an alias for to_json', () => {
    expect(processTwig('{{ v | json_encode }}', { v: { a: 1 } })).toBe('{"a":1}');
  });
});

describe('twig filters — title', () => {
  it('uppercases the first letter of each word', () => {
    expect(processTwig('{{ v | title }}', { v: 'hello world' })).toBe('Hello World');
  });

  it('handles single word', () => {
    expect(processTwig('{{ v | title }}', { v: 'hello' })).toBe('Hello');
  });

  it('leaves non-string untouched', () => {
    expect(applyFilters(42, '| title', ctx)).toBe(42);
  });
});

describe('twig filters — camelize', () => {
  it('converts snake_case to camelCase', () => {
    expect(processTwig('{{ v | camelize }}', { v: 'foo_bar' })).toBe('fooBar');
  });

  it('converts kebab-case to camelCase', () => {
    expect(processTwig('{{ v | camelize }}', { v: 'foo-bar' })).toBe('fooBar');
  });

  it('handles single word', () => {
    expect(processTwig('{{ v | camelize }}', { v: 'hello' })).toBe('hello');
  });
});

describe('twig filters — kebab', () => {
  it('converts camelCase to kebab-case', () => {
    expect(processTwig('{{ v | kebab }}', { v: 'fooBar' })).toBe('foo-bar');
  });

  it('converts spaces to kebab-case', () => {
    expect(processTwig('{{ v | kebab }}', { v: 'Foo Bar' })).toBe('foo-bar');
  });

  it('converts underscores to kebab-case', () => {
    expect(processTwig('{{ v | kebab }}', { v: 'foo_bar' })).toBe('foo-bar');
  });
});

describe('twig filters — snake', () => {
  it('converts camelCase to snake_case', () => {
    expect(processTwig('{{ v | snake }}', { v: 'fooBar' })).toBe('foo_bar');
  });

  it('converts kebab-case to snake_case', () => {
    expect(processTwig('{{ v | snake }}', { v: 'foo-bar' })).toBe('foo_bar');
  });

  it('handles already snake_case', () => {
    expect(processTwig('{{ v | snake }}', { v: 'foo_bar' })).toBe('foo_bar');
  });
});

describe('twig filters — replace', () => {
  it('replaces a substring with a replacement', () => {
    expect(processTwig("{{ v | replace('hello', 'hi') }}", { v: 'hello world' })).toBe('hi world');
  });

  it('replaces all occurrences', () => {
    expect(processTwig("{{ v | replace('o', '0') }}", { v: 'foo boo' })).toBe('f00 b00');
  });

  it('leaves non-string untouched', () => {
    expect(applyFilters(42, "| replace('a', 'b')", ctx)).toBe(42);
  });
});

describe('twig filters — slice', () => {
  it('slices a string from start index', () => {
    expect(processTwig('{{ v | slice(2) }}', { v: 'hello' })).toBe('llo');
  });

  it('slices a string with start and length', () => {
    expect(processTwig('{{ v | slice(1, 3) }}', { v: 'hello' })).toBe('ell');
  });

  it('slices an array via applyFilters (returns raw array)', () => {
    expect(applyFilters([1, 2, 3], '| slice(1)', ctx)).toEqual([2, 3]);
  });

  it('slices an array with start and length via applyFilters', () => {
    expect(applyFilters([1, 2, 3], '| slice(0, 2)', ctx)).toEqual([1, 2]);
  });

  it('handles negative index on string', () => {
    expect(processTwig('{{ v | slice(-2) }}', { v: 'hello' })).toBe('lo');
  });
});

describe('twig filters — split', () => {
  it('splits a string via applyFilters (returns raw array)', () => {
    expect(applyFilters('a,b,c', "| split(',')", ctx)).toEqual(['a', 'b', 'c']);
  });

  it('splits with no matches returns single-element array', () => {
    expect(applyFilters('abc', "| split(',')", ctx)).toEqual(['abc']);
  });

  it('leaves non-string untouched', () => {
    expect(applyFilters(42, "| split(',')", ctx)).toBe(42);
  });
});

describe('twig filters — first / last', () => {
  it('first returns first character of string', () => {
    expect(processTwig('{{ v | first }}', { v: 'hello' })).toBe('h');
  });

  it('last returns last character of string', () => {
    expect(processTwig('{{ v | last }}', { v: 'hello' })).toBe('o');
  });

  it('first returns first element of array via applyFilters', () => {
    expect(applyFilters([10, 20, 30], '| first', ctx)).toBe(10);
  });

  it('last returns last element of array via applyFilters', () => {
    expect(applyFilters([10, 20, 30], '| last', ctx)).toBe(30);
  });

  it('first returns empty string for empty string', () => {
    expect(processTwig('{{ v | first }}', { v: '' })).toBe('');
  });

  it('first returns undefined for empty array via applyFilters', () => {
    expect(applyFilters([], '| first', ctx)).toBeUndefined();
  });
});

describe('twig filters — contains', () => {
  it('checks if string contains substring', () => {
    expect(processTwig("{{ v | contains('ell') }}", { v: 'hello' })).toBe('true');
  });

  it('returns false when string does not contain substring', () => {
    expect(processTwig("{{ v | contains('xyz') }}", { v: 'hello' })).toBe('false');
  });

  it('checks if array contains item via applyFilters', () => {
    expect(applyFilters([1, 2, 3], '| contains(2)', ctx)).toBe(true);
  });

  it('returns false when array does not contain item via applyFilters', () => {
    expect(applyFilters([1, 2, 3], '| contains(5)', ctx)).toBe(false);
  });
});

describe('twig filters — startswith / endswith', () => {
  it('startswith checks prefix', () => {
    expect(processTwig("{{ v | startswith('hel') }}", { v: 'hello' })).toBe('true');
    expect(processTwig("{{ v | startswith('xyz') }}", { v: 'hello' })).toBe('false');
  });

  it('endswith checks suffix', () => {
    expect(processTwig("{{ v | endswith('llo') }}", { v: 'hello' })).toBe('true');
    expect(processTwig("{{ v | endswith('xyz') }}", { v: 'hello' })).toBe('false');
  });

  it('returns false for non-string', () => {
    expect(applyFilters(42, "| startswith('4')", ctx)).toBe(false);
    expect(applyFilters(42, "| endswith('2')", ctx)).toBe(false);
  });
});

describe('twig filters — reverse', () => {
  it('reverses a string', () => {
    expect(processTwig('{{ v | reverse }}', { v: 'hello' })).toBe('olleh');
  });

  it('reverses an array via applyFilters', () => {
    expect(applyFilters([1, 2, 3], '| reverse', ctx)).toEqual([3, 2, 1]);
  });

  it('leaves non-string/non-array untouched', () => {
    expect(applyFilters(42, '| reverse', ctx)).toBe(42);
  });
});

describe('twig filters — number_format', () => {
  it('formats with 2 decimal places', () => {
    expect(processTwig('{{ v | number_format(2) }}', { v: 3.14159 })).toBe('3.14');
  });

  it('formats with thousands separator', () => {
    expect(processTwig('{{ v | number_format(0, ".", ",") }}', { v: 1234567 })).toBe('1,234,567');
  });

  it('formats with custom decimal point', () => {
    expect(processTwig('{{ v | number_format(2, ",") }}', { v: 3.14 })).toBe('3,14');
  });

  it('leaves non-number untouched', () => {
    expect(applyFilters('abc', '| number_format(2)', ctx)).toBe('abc');
  });
});

describe('twig filters — sort', () => {
  it('sorts an array of strings via applyFilters', () => {
    expect(applyFilters(['c', 'a', 'b'], '| sort', ctx)).toEqual(['a', 'b', 'c']);
  });

  it('sorts an array of numbers via applyFilters', () => {
    expect(applyFilters([3, 1, 2], '| sort', ctx)).toEqual([1, 2, 3]);
  });

  it('leaves non-array untouched', () => {
    expect(applyFilters('abc', '| sort', ctx)).toBe('abc');
  });
});

describe('twig filters — batch', () => {
  it('chunks an array into groups via applyFilters', () => {
    expect(applyFilters([1, 2, 3, 4, 5], '| batch(2)', ctx)).toEqual([[1, 2], [3, 4], [5]]);
  });

  it('handles exact multiple via applyFilters', () => {
    expect(applyFilters([1, 2, 3, 4], '| batch(2)', ctx)).toEqual([[1, 2], [3, 4]]);
  });

  it('leaves non-array untouched', () => {
    expect(applyFilters('abc', '| batch(2)', ctx)).toBe('abc');
  });
});

describe('twig filters — keys / values', () => {
  it('keys returns object keys via applyFilters', () => {
    expect(applyFilters({ a: 1, b: 2 }, '| keys', ctx)).toEqual(['a', 'b']);
  });

  it('values returns object values via applyFilters', () => {
    expect(applyFilters({ a: 1, b: 2 }, '| values', ctx)).toEqual([1, 2]);
  });

  it('leaves non-object untouched', () => {
    expect(applyFilters('abc', '| keys', ctx)).toBe('abc');
    expect(applyFilters(42, '| values', ctx)).toBe(42);
  });
});

describe('twig filters — merge', () => {
  it('merges two arrays via applyFilters with variable', () => {
    expect(applyFilters([1, 2], '| merge(other)', { other: [4, 5] })).toEqual([
      1,
      2,
      4,
      5
    ]);
  });

  it('merges two objects via applyFilters with variable', () => {
    expect(applyFilters({ a: 1, b: 2 }, '| merge(other)', { other: { c: 3 } })).toEqual({ a: 1, b: 2, c: 3 });
  });
});

describe('twig filters — filter (array)', () => {
  it('filters truthy items via applyFilters', () => {
    expect(applyFilters([0, 1, false, true, ''], '| filter', ctx)).toEqual([1, true]);
  });

  it('filters by key path via applyFilters', () => {
    expect(
      applyFilters(
        [
          { active: true, name: 'a' },
          { active: false, name: 'b' }
        ],
        '| filter("active")',
        ctx
      )
    ).toEqual([{ active: true, name: 'a' }]);
  });
});

describe('twig filters — chained', () => {
  it('upper + trim', () => {
    expect(processTwig('{{ name | trim | upper }}', { name: '  hi  ' })).toBe('HI');
  });

  it('raw after to_json — raw bypasses serialization of the to_json string', () => {
    expect(processTwig('{{ o | to_json | raw }}', { o: { a: 1 } })).toBe('{"a":1}');
  });

  it('slice + upper', () => {
    expect(processTwig('{{ name | slice(0, 3) | upper }}', { name: 'hello' })).toBe('HEL');
  });

  it('default + upper', () => {
    expect(processTwig('{{ name | default("world") | upper }}', {})).toBe('WORLD');
  });
});
