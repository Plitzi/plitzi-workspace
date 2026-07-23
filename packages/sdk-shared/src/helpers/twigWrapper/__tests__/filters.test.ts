/* eslint-disable quotes */
import { expect, describe, it } from 'vitest';

import { processTwig } from '../index';

describe('AST processTwig — filters', () => {
  it('upper filter', () => {
    expect(processTwig('{{ name | upper }}', { name: 'alice' })).toBe('ALICE');
  });

  it('lower filter', () => {
    expect(processTwig('{{ name | lower }}', { name: 'ALICE' })).toBe('alice');
  });

  it('trim filter', () => {
    expect(processTwig('{{ name | trim }}', { name: '  hi  ' })).toBe('hi');
  });

  it('capitalize filter', () => {
    expect(processTwig('{{ name | capitalize }}', { name: 'alice' })).toBe('Alice');
  });

  it('title filter', () => {
    expect(processTwig('{{ name | title }}', { name: 'hello world' })).toBe('Hello World');
  });

  it('length filter on string', () => {
    expect(processTwig('{{ name | length }}', { name: 'hello' })).toBe('5');
  });

  it('length filter on array', () => {
    expect(processTwig('{{ items | length }}', { items: [1, 2, 3] })).toBe('3');
  });

  it('length filter on object', () => {
    expect(processTwig('{{ obj | length }}', { obj: { a: 1, b: 2, c: 3 } })).toBe('3');
  });

  it('join filter', () => {
    expect(processTwig('{{ items | join(", ") }}', { items: ['a', 'b', 'c'] })).toBe('a, b, c');
  });

  it('reverse filter on string', () => {
    expect(processTwig('{{ name | reverse }}', { name: 'abc' })).toBe('cba');
  });

  it('reverse filter on array', () => {
    expect(processTwig('{{ items | reverse | join(", ") }}', { items: ['a', 'b', 'c'] })).toBe('c, b, a');
  });

  it('slice filter on string', () => {
    expect(processTwig('{{ name | slice(1, 3) }}', { name: 'hello' })).toBe('ell');
  });

  it('slice filter on array', () => {
    expect(processTwig('{{ items | slice(1, 2) | join(", ") }}', { items: ['a', 'b', 'c', 'd'] })).toBe('b, c');
  });

  it('split filter', () => {
    expect(processTwig('{{ data | split(",") | join("-") }}', { data: 'a,b,c' })).toBe('a-b-c');
  });

  it('contains filter on string', () => {
    expect(processTwig('{{ name | contains("ell") }}', { name: 'hello' })).toBe('true');
    expect(processTwig('{{ name | contains("xyz") }}', { name: 'hello' })).toBe('false');
  });

  it('contains filter on array', () => {
    expect(processTwig('{{ items | contains("b") }}', { items: ['a', 'b', 'c'] })).toBe('true');
    expect(processTwig('{{ items | contains("x") }}', { items: ['a', 'b', 'c'] })).toBe('false');
  });

  it('startswith filter', () => {
    expect(processTwig('{{ name | startswith("hel") }}', { name: 'hello' })).toBe('true');
    expect(processTwig('{{ name | startswith("xyz") }}', { name: 'hello' })).toBe('false');
  });

  it('endswith filter', () => {
    expect(processTwig('{{ name | endswith("llo") }}', { name: 'hello' })).toBe('true');
    expect(processTwig('{{ name | endswith("xyz") }}', { name: 'hello' })).toBe('false');
  });

  it('first filter on string', () => {
    expect(processTwig('{{ name | first }}', { name: 'hello' })).toBe('h');
  });

  it('first filter on array', () => {
    expect(processTwig('{{ items | first }}', { items: ['a', 'b', 'c'] })).toBe('a');
  });

  it('last filter on string', () => {
    expect(processTwig('{{ name | last }}', { name: 'hello' })).toBe('o');
  });

  it('last filter on array', () => {
    expect(processTwig('{{ items | last }}', { items: ['a', 'b', 'c'] })).toBe('c');
  });

  it('sort filter', () => {
    expect(processTwig('{{ items | sort | join(", ") }}', { items: ['c', 'a', 'b'] })).toBe('a, b, c');
  });

  it('keys filter', () => {
    expect(processTwig('{{ obj | keys | join(", ") }}', { obj: { b: 2, a: 1 } })).toBe('b, a');
  });

  it('values filter', () => {
    expect(processTwig('{{ obj | values | join(", ") }}', { obj: { a: 1, b: 2 } })).toBe('1, 2');
  });

  it('merge filter on arrays', () => {
    expect(processTwig('{{ a | merge(b) | join(", ") }}', { a: [1, 2], b: [3, 4] })).toBe('1, 2, 3, 4');
  });

  it('merge filter on objects', () => {
    expect(processTwig('{{ a | merge(b) | keys | join(", ") }}', { a: { x: 1 }, b: { y: 2 } })).toBe('x, y');
  });

  it('column filter', () => {
    expect(
      processTwig('{{ items | column("name") | join(", ") }}', {
        items: [{ name: 'A' }, { name: 'B' }, { name: 'C' }]
      })
    ).toBe('A, B, C');
  });

  it('batch filter', () => {
    expect(
      processTwig('{% for batch in items | batch(2) %}[{{ batch | join(",") }}]{% endfor %}', {
        items: [1, 2, 3, 4, 5]
      })
    ).toBe('[1,2][3,4][5]');
  });

  it('abs filter', () => {
    expect(processTwig('{{ val | abs }}', { val: -42 })).toBe('42');
    expect(processTwig('{{ val | abs }}', { val: 42 })).toBe('42');
  });

  it('round filter', () => {
    expect(processTwig('{{ val | round }}', { val: 3.7 })).toBe('4');
    expect(processTwig('{{ val | round(2) }}', { val: 3.14159 })).toBe('3.14');
  });

  it('replace filter', () => {
    expect(processTwig('{{ name | replace("a", "o") }}', { name: 'banana' })).toBe('bonono');
  });

  it('nl2br filter', () => {
    expect(processTwig('{{ text | nl2br }}', { text: 'line1\nline2' })).toBe('line1<br>line2');
  });

  it('url_encode filter', () => {
    expect(processTwig('{{ text | url_encode }}', { text: 'hello world' })).toBe('hello%20world');
  });

  it('format filter', () => {
    expect(processTwig("{{ tpl | format('Alice', 30) }}", { tpl: '%s is %d' })).toBe('Alice is 30');
  });

  it('filter chaining (5 filters)', () => {
    expect(processTwig('{{ name | trim | lower | capitalize | reverse | title }}', { name: '  hello  ' })).toBe(
      'OlleH'
    );
  });

  it('default filter with missing value', () => {
    expect(processTwig('{{ missing | default("fallback") }}', {})).toBe('fallback');
  });

  it('default filter with present value', () => {
    expect(processTwig('{{ present | default("fallback") }}', { present: 'actual' })).toBe('actual');
  });

  it('default filter with empty string (is empty)', () => {
    expect(processTwig('{{ val | default("fallback") }}', { val: '' })).toBe('fallback');
  });

  it('default filter with zero (not empty)', () => {
    expect(processTwig('{{ val | default("fallback") }}', { val: 0 })).toBe('0');
  });

  it('to_json filter', () => {
    expect(processTwig('{{ obj | to_json }}', { obj: { a: 1 } })).toBe('{"a":1}');
  });

  it('raw filter bypasses JSON serialization', () => {
    expect(processTwig('{{ obj | raw }}', { obj: { a: 1 } })).toBe('[object Object]');
  });

  it('filter with computed expression argument', () => {
    expect(processTwig('{{ name | slice(0, n) }}', { name: 'hello', n: 3 })).toBe('hel');
  });
});

describe('AST processTwig — new string filters', () => {
  it('ltrim trims from start', () => {
    expect(processTwig('{{ val | ltrim }}', { val: '  hello  ' })).toBe('hello  ');
  });

  it('rtrim trims from end', () => {
    expect(processTwig('{{ val | rtrim }}', { val: '  hello  ' })).toBe('  hello');
  });

  it('pad pads from left', () => {
    expect(processTwig('{{ val | pad(6, "0") }}', { val: '42' })).toBe('000042');
  });

  it('padRight pads from right', () => {
    expect(processTwig('{{ val | padRight(6, ".") }}', { val: 'hi' })).toBe('hi....');
  });

  it('number extracts first number from string', () => {
    expect(processTwig('{{ val | number }}', { val: 'price is 42.5 dollars' })).toBe('42.5');
    expect(processTwig('{{ val | number }}', { val: 'no numbers' })).toBe('0');
  });
});

describe('AST processTwig — spaceless filter', () => {
  it('removes whitespace between tags', () => {
    expect(processTwig('{{ val | spaceless }}', { val: '<div>  <span> hi </span>  </div>' })).toBe(
      '<div><span> hi </span></div>'
    );
  });
});

describe('AST processTwig — date filter', () => {
  it('formats a date string', () => {
    const result = processTwig('{{ val | date("Y-m-d") }}', { val: '2025-01-15T10:30:00' });
    expect(result).toBe('2025-01-15');
  });

  it('formats with time', () => {
    const result = processTwig('{{ val | date("H:i:s") }}', { val: '2025-01-15T14:30:45' });
    expect(result).toBe('14:30:45');
  });

  it('formats month and day names', () => {
    const result = processTwig('{{ val | date("l, F d, Y") }}', { val: '2025-01-15' });
    expect(result).toBe('Wednesday, January 15, 2025');
  });

  it('does not re-substitute letters inside an inserted month name', () => {
    // "March" (from F) must not have its "M" turned into "Mar" by a later token pass → "Mararch".
    expect(processTwig('{{ val | date("F") }}', { val: '2026-03-15' })).toBe('March');
    expect(processTwig('{{ val | date("F") }}', { val: '2026-05-10' })).toBe('May');
  });

  it('substitutes every occurrence of a repeated token', () => {
    expect(processTwig('{{ val | date("m/m") }}', { val: '2026-03-15' })).toBe('03/03');
    expect(processTwig('{{ val | date("Y-Y") }}', { val: '2026-03-15' })).toBe('2026-2026');
  });

  it('keeps literal characters that are not tokens', () => {
    expect(processTwig('{{ val | date("[Y] Y") }}', { val: '2026-03-15' })).toBe('[2026] 2026');
  });

  it('returns empty string for an unparseable date', () => {
    expect(processTwig('{{ val | date("Y-m-d") }}', { val: 'not-a-date' })).toBe('');
  });
});

describe('AST processTwig — encoding filters', () => {
  it('base64_encode encodes string', () => {
    expect(processTwig('{{ val | base64_encode }}', { val: 'hello' })).toBe('aGVsbG8=');
  });

  it('base64_decode decodes string', () => {
    expect(processTwig('{{ val | base64_decode }}', { val: 'aGVsbG8=' })).toBe('hello');
  });

  it('base64_encode is UTF-8 safe for multibyte characters', () => {
    // Latin1 btoa would yield "Y2Fm6Q==" (or throw); the UTF-8 encoding is "Y2Fmw6k=".
    expect(processTwig('{{ val | base64_encode }}', { val: 'café' })).toBe('Y2Fmw6k=');
  });

  it('base64 round-trips multibyte strings', () => {
    expect(processTwig('{{ val | base64_encode | base64_decode }}', { val: 'héllo wörld 🚀' })).toBe('héllo wörld 🚀');
  });

  it('base64 filters leave non-strings untouched', () => {
    expect(processTwig('{{ val | base64_encode }}', { val: 42 })).toBe('42');
  });
});

describe('AST processTwig — md5 filter', () => {
  // Official RFC 1321 test vectors.
  it('hashes the empty string', () => {
    expect(processTwig('{{ "" | md5 }}', {})).toBe('d41d8cd98f00b204e9800998ecf8427e');
  });

  it('hashes "abc"', () => {
    expect(processTwig('{{ "abc" | md5 }}', {})).toBe('900150983cd24fb0d6963f7d28e17f72');
  });

  it('hashes "hello"', () => {
    expect(processTwig('{{ val | md5 }}', { val: 'hello' })).toBe('5d41402abc4b2a76b9719d911017c592');
  });

  it('hashes the classic pangram', () => {
    expect(processTwig('{{ val | md5 }}', { val: 'The quick brown fox jumps over the lazy dog' })).toBe(
      '9e107d9d372bb6826bd81d3542a419d6'
    );
  });

  it('hashes across a message-block boundary (> 56 bytes)', () => {
    expect(
      processTwig('{{ val | md5 }}', { val: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789' })
    ).toBe('d174ab98d277d9f5a5611c2c9f419d9f');
  });

  it('hashes multibyte input as UTF-8 bytes', () => {
    expect(processTwig('{{ val | md5 }}', { val: 'café' })).toBe('07117fe4a1ebd544965dc19573183da2');
  });

  it('is deterministic and leaves non-strings untouched', () => {
    expect(processTwig('{{ val | md5 }}', { val: 7 })).toBe('7');
  });
});

describe('AST processTwig — object manipulation filters', () => {
  it('without removes specified keys', () => {
    expect(processTwig('{{ obj | without("b", "c") }}', { obj: { a: 1, b: 2, c: 3 } })).toBe('{"a":1}');
  });

  it('only keeps specified keys', () => {
    expect(processTwig('{{ obj | only("a", "c") }}', { obj: { a: 1, b: 2, c: 3 } })).toBe('{"a":1,"c":3}');
  });
});

describe('AST processTwig — array query filters', () => {
  it('find finds first matching element', () => {
    const result = processTwig('{{ items | find("name", "Bob") | to_json }}', {
      items: [{ name: 'Alice' }, { name: 'Bob' }, { name: 'Charlie' }]
    });
    expect(result).toBe('{"name":"Bob"}');
  });

  it('pluck extracts values by key', () => {
    expect(
      processTwig('{{ items | pluck("name") | join(", ") }}', {
        items: [{ name: 'Alice' }, { name: 'Bob' }]
      })
    ).toBe('Alice, Bob');
  });

  it('unique removes duplicates', () => {
    expect(processTwig('{{ items | unique | join(", ") }}', { items: [1, 2, 2, 3, 3, 3] })).toBe('1, 2, 3');
  });

  it('flatten flattens one level', () => {
    expect(
      processTwig('{{ items | flatten | join(", ") }}', {
        items: [
          [1, 2],
          [3, 4]
        ]
      })
    ).toBe('1, 2, 3, 4');
  });

  it('sum sums array values', () => {
    expect(processTwig('{{ items | sum }}', { items: [1, 2, 3, 4] })).toBe('10');
  });

  it('chunk splits array', () => {
    expect(
      processTwig('{% for g in items | chunk(2) %}[{{ g | join(",") }}]{% endfor %}', { items: [1, 2, 3, 4, 5] })
    ).toBe('[1,2][3,4][5]');
  });

  it('index_by reindexes array', () => {
    const result = processTwig('{{ items | index_by("id") | to_json }}', {
      items: [
        { id: 'a', v: 1 },
        { id: 'b', v: 2 }
      ]
    });
    expect(result).toBe('{"a":{"id":"a","v":1},"b":{"id":"b","v":2}}');
  });

  it('group_by groups array', () => {
    const result = processTwig('{{ items | group_by("type") | to_json }}', {
      items: [
        { type: 'a', v: 1 },
        { type: 'b', v: 2 },
        { type: 'a', v: 3 }
      ]
    });
    expect(result).toBe('{"a":[{"type":"a","v":1},{"type":"a","v":3}],"b":[{"type":"b","v":2}]}');
  });

  // ── Arrow functions and map/reduce filters ─────────────────────────────────────

  it('map extracts property with arrow function', () => {
    const result = processTwig('{{ items | map(item => item.name) | join(", ") }}', {
      items: [{ name: 'Apple' }, { name: 'Banana' }, { name: 'Cherry' }]
    });
    expect(result).toBe('Apple, Banana, Cherry');
  });

  it('map transforms with expression', () => {
    const result = processTwig('{{ items | map(item => item.price * 2) | join(", ") }}', {
      items: [{ price: 10 }, { price: 20 }, { price: 30 }]
    });
    expect(result).toBe('20, 40, 60');
  });

  it('map with index parameter', () => {
    const result = processTwig('{{ items | map((item, index) => index ~ ":" ~ item) | join(", ") }}', {
      items: ['a', 'b', 'c']
    });
    expect(result).toBe('0:a, 1:b, 2:c');
  });

  it('reduce sums with initial value', () => {
    const result = processTwig('{{ items | reduce((acc, item) => acc + item, 0) }}', {
      items: [1, 2, 3, 4]
    });
    expect(result).toBe('10');
  });

  it('reduce concatenates strings', () => {
    const result = processTwig('{{ items | reduce((acc, item) => acc ~ item, "") }}', {
      items: ['Hello', ' ', 'World']
    });
    expect(result).toBe('Hello World');
  });

  it('reduce without initial value uses first element', () => {
    const result = processTwig('{{ items | reduce((acc, item) => acc + item) }}', {
      items: [10, 20, 30]
    });
    expect(result).toBe('60');
  });

  it('map with nested property', () => {
    const result = processTwig('{{ items | map(item => item.user.name) | join(", ") }}', {
      items: [{ user: { name: 'Alice' } }, { user: { name: 'Bob' } }]
    });
    expect(result).toBe('Alice, Bob');
  });

  it('chained map and reduce', () => {
    const result = processTwig('{{ items | map(item => item.price) | reduce((acc, price) => acc + price, 0) }}', {
      items: [{ price: 10 }, { price: 20 }, { price: 30 }]
    });
    expect(result).toBe('60');
  });

  it('reduce building object', () => {
    const result = processTwig('{{ items | reduce((acc, item) => acc ~ item.key ~ "=" ~ item.value, "") }}', {
      items: [
        { key: 'a', value: 1 },
        { key: 'b', value: 2 }
      ]
    });
    expect(result).toBe('a=1b=2');
  });
});
