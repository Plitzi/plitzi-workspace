import { expect, describe, it } from 'vitest';

import { processTwig } from '../index';

describe('AST processTwig — object literals', () => {
  it('builds an object with unquoted keys and reads a property via a set var', () => {
    expect(processTwig('{% set o = { a: 1, b: 2 } %}{{ o.b }}', {})).toBe('2');
  });

  it('builds an object with quoted keys', () => {
    expect(processTwig('{{ { "first name": name, "age": n } | to_json }}', { name: 'Ada', n: 36 })).toBe(
      '{"first name":"Ada","age":36}'
    );
  });

  it('evaluates expression values, paths and nested objects', () => {
    expect(processTwig('{{ { total: a + b, meta: { label: name } } | to_json }}', { a: 2, b: 3, name: 'x' })).toBe(
      '{"total":5,"meta":{"label":"x"}}'
    );
  });

  it('serialises a bare object literal in double braces', () => {
    expect(processTwig('{{ { k: v } }}', { v: 7 })).toBe('{"k":7}');
  });

  it('renders an empty object literal', () => {
    expect(processTwig('{{ {} | to_json }}', {})).toBe('{}');
  });

  it('produces objects inside map then reads them back', () => {
    expect(
      processTwig('{{ items | map(i => { k: i.name, v: i.val }) | map(o => o.k ~ "=" ~ o.v) | join(", ") }}', {
        items: [
          { name: 'a', val: 1 },
          { name: 'b', val: 2 }
        ]
      })
    ).toBe('a=1, b=2');
  });

  // ── Twig hash key forms (https://twig.symfony.com/doc/3.x/templates.html) ──────
  it('supports shorthand (unquoted) keys', () => {
    expect(processTwig('{{ { name: "Fabien", city: "Paris" } | to_json }}', {})).toBe(
      '{"name":"Fabien","city":"Paris"}'
    );
  });

  it('supports integer keys', () => {
    expect(processTwig('{{ { 2: "Twig", 4: "Symfony" } | to_json }}', {})).toBe('{"2":"Twig","4":"Symfony"}');
  });

  it('supports dynamic keys from an expression', () => {
    expect(processTwig('{{ { (k): "v", (1 + 1): "two" } | to_json }}', { k: 'name' })).toBe('{"2":"two","name":"v"}');
  });

  it('treats a shorthand key as a literal, not a variable lookup', () => {
    expect(processTwig('{{ { name: name } | to_json }}', { name: 'Ada' })).toBe('{"name":"Ada"}');
  });

  it('mixes shorthand, dynamic and integer keys', () => {
    expect(processTwig('{{ { id: x, (dyn): "d", 3: "three" } | to_json }}', { x: 9, dyn: 'label' })).toBe(
      '{"3":"three","id":9,"label":"d"}'
    );
  });
});
describe('AST processTwig — sort with arrow', () => {
  it('sorts by an extracted key (single-param arrow)', () => {
    expect(
      processTwig('{{ items | sort(i => i.order) | map(x => x.label) | join(", ") }}', {
        items: [
          { label: 'C', order: 3 },
          { label: 'A', order: 1 },
          { label: 'B', order: 2 }
        ]
      })
    ).toBe('A, B, C');
  });

  it('sorts by a comparator (two-param arrow)', () => {
    expect(processTwig('{{ nums | sort((a, b) => b - a) | join(", ") }}', { nums: [1, 3, 2, 5, 4] })).toBe(
      '5, 4, 3, 2, 1'
    );
  });

  it('sorts numbers numerically without an argument', () => {
    expect(processTwig('{{ nums | sort | join(", ") }}', { nums: [10, 2, 1, 20] })).toBe('1, 2, 10, 20');
  });
});
// ── Comprehensive arrow function / map / reduce tests ──────────────────────────
describe('AST processTwig — arrow functions comprehensive', () => {
  // ── Parsing edge cases ─────────────────────────────────────────────────────
  it('standalone arrow returns empty string', () => {
    expect(processTwig('{{ x => x + 1 }}')).toBe('');
    expect(processTwig('{{ (a, b) => a + b }}')).toBe('');
  });
  it('arrow with spaces around =>', () => {
    expect(processTwig('{{ nums | map( n  =>  n + 1 ) | join(", ") }}', { nums: [1, 2] })).toBe('2, 3');
  });
  it('multi-param arrow with spaces', () => {
    // map passes (item, index) — so a=item, b=index
    expect(
      processTwig('{{ items | map( ( a , b ) => a ~ b ) | join(", ") }}', {
        items: [
          ['x', '1'],
          ['y', '2']
        ]
      })
    ).toBe('x,10, y,21');
  });
  it('arrow param named same as outer variable (shadows)', () => {
    expect(
      processTwig('{{ items | map(items => items.name) | join(", ") }}', {
        items: [{ name: 'A' }, { name: 'B' }]
      })
    ).toBe('A, B');
  });
  it('arrow param named "_"', () => {
    expect(processTwig('{{ items | map(_ => 42) | join(", ") }}', { items: [1, 2, 3] })).toBe('42, 42, 42');
  });
  // ── Single-param arrow: property access ───────────────────────────────────
  it('extracts simple property', () => {
    expect(
      processTwig('{{ items | map(item => item.name) | join(", ") }}', {
        items: [{ name: 'Apple' }, { name: 'Banana' }]
      })
    ).toBe('Apple, Banana');
  });
  it('extracts nested property', () => {
    expect(
      processTwig('{{ items | map(i => i.user.name) | join(", ") }}', {
        items: [{ user: { name: 'Alice' } }, { user: { name: 'Bob' } }]
      })
    ).toBe('Alice, Bob');
  });
  it('extracts deeply nested property', () => {
    expect(
      processTwig('{{ items | map(i => i.a.b.c) | join(", ") }}', {
        items: [{ a: { b: { c: 'deep' } } }]
      })
    ).toBe('deep');
  });
  // ── Single-param arrow: arithmetic ────────────────────────────────────────
  it('multiplication', () => {
    expect(processTwig('{{ nums | map(n => n * 3) | join(", ") }}', { nums: [1, 2, 3] })).toBe('3, 6, 9');
  });
  it('addition', () => {
    expect(processTwig('{{ nums | map(n => n + 10) | join(", ") }}', { nums: [5, 15] })).toBe('15, 25');
  });
  it('subtraction', () => {
    expect(processTwig('{{ nums | map(n => n - 1) | join(", ") }}', { nums: [10, 20] })).toBe('9, 19');
  });
  it('division', () => {
    expect(processTwig('{{ nums | map(n => n / 2) | join(", ") }}', { nums: [10, 20] })).toBe('5, 10');
  });
  it('modulo', () => {
    expect(processTwig('{{ nums | map(n => n % 2) | join(", ") }}', { nums: [1, 2, 3, 4] })).toBe('1, 0, 1, 0');
  });
  it('unary minus', () => {
    expect(processTwig('{{ nums | map(n => -n) | join(", ") }}', { nums: [1, -2, 3] })).toBe('-1, 2, -3');
  });
  it('complex math with precedence', () => {
    expect(processTwig('{{ nums | map(n => (n + 1) * 2) | join(", ") }}', { nums: [1, 2, 3] })).toBe('4, 6, 8');
  });
  it('chained arithmetic', () => {
    expect(processTwig('{{ nums | map(n => n * 3 - 1 + 10 / 2) | join(", ") }}', { nums: [1, 2] })).toBe('7, 10');
  });
  // ── Single-param arrow: comparisons / logic ───────────────────────────────
  it('comparison operators', () => {
    expect(processTwig('{{ nums | map(n => n >= 10) | join(", ") }}', { nums: [5, 10, 15] })).toBe('false, true, true');
  });
  it('logical and', () => {
    expect(
      processTwig('{{ items | map(i => i.active and i.vis > 0) | join(", ") }}', {
        items: [
          { active: true, vis: 10 },
          { active: false, vis: 5 },
          { active: true, vis: 0 }
        ]
      })
    ).toBe('true, false, false');
  });
  it('not operator', () => {
    expect(
      processTwig('{{ flags | map(f => not f) | join(", ") }}', {
        flags: [true, false, true]
      })
    ).toBe('false, true, false');
  });
  // ── Single-param arrow: ternary ───────────────────────────────────────────
  it('simple ternary', () => {
    expect(
      processTwig('{{ items | map(x => x > 5 ? "big" : "small") | join(", ") }}', {
        items: [3, 8, 2, 10]
      })
    ).toBe('small, big, small, big');
  });
  it('nested ternary', () => {
    expect(
      processTwig('{{ items | map(x => x == 1 ? "one" : x == 2 ? "two" : "other") | join(", ") }}', {
        items: [1, 2, 3]
      })
    ).toBe('one, two, other');
  });
  it('ternary with property access', () => {
    expect(
      processTwig('{{ items | map(i => i.type == "a" ? i.x : i.y) | join(", ") }}', {
        items: [
          { type: 'a', x: 1, y: 10 },
          { type: 'b', x: 2, y: 20 }
        ]
      })
    ).toBe('1, 20');
  });
  // ── Single-param arrow: concatenation ─────────────────────────────────────
  it('concat with prefix', () => {
    expect(
      processTwig('{{ names | map(n => "prefix_" ~ n) | join(", ") }}', {
        names: ['a', 'b']
      })
    ).toBe('prefix_a, prefix_b');
  });
  it('concat multi-part', () => {
    expect(
      processTwig('{{ items | map(i => i.first ~ " " ~ i.last) | join(", ") }}', {
        items: [
          { first: 'John', last: 'Doe' },
          { first: 'Jane', last: 'Smith' }
        ]
      })
    ).toBe('John Doe, Jane Smith');
  });
  // ── Multi-param arrows ────────────────────────────────────────────────────
  it('index parameter', () => {
    expect(
      processTwig('{{ items | map((item, idx) => idx ~ ":" ~ item) | join(", ") }}', {
        items: ['a', 'b', 'c']
      })
    ).toBe('0:a, 1:b, 2:c');
  });
  it('two-param addition', () => {
    // map passes (item, index), so a=item (array), b=index
    expect(
      processTwig('{{ items | map((a, b) => a ~ ":" ~ b) | join(", ") }}', {
        items: [
          [1, 10],
          [2, 20],
          [3, 30]
        ]
      })
    ).toBe('1,10:0, 2,20:1, 3,30:2');
  });
  it('multi-param referencing outer variable', () => {
    expect(
      processTwig('{{ items | map((item, idx) => item ~ idx ~ global) | join(", ") }}', {
        items: ['a', 'b'],
        global: '!'
      })
    ).toBe('a0!, b1!');
  });
  it('multi-param with comparison', () => {
    // map passes (item, index), so a=item (array), b=index; ~ stringifies arrays
    expect(
      processTwig('{{ pairs | map((a, b) => a ~ "-" ~ b) | join(", ") }}', {
        pairs: [
          [1, 5],
          [10, 3],
          [7, 7]
        ]
      })
    ).toBe('1,5-0, 10,3-1, 7,7-2');
  });
  // ── Arrow capturing outer scope ───────────────────────────────────────────
  it('captures outer variable', () => {
    expect(
      processTwig('{{ items | map(i => i ~ suffix) | join(", ") }}', {
        items: ['a', 'b'],
        suffix: '!'
      })
    ).toBe('a!, b!');
  });
  it('captures nested outer variable', () => {
    expect(
      processTwig('{{ items | map(i => i ~ ctx.val) | join(", ") }}', {
        items: ['x', 'y'],
        ctx: { val: 'Z' }
      })
    ).toBe('xZ, yZ');
  });
  it('chained arrows both capture outer scope', () => {
    expect(
      processTwig('{{ items | map(i => i.v * factor) | reduce((a, b) => a + b, 0) }}', {
        items: [{ v: 1 }, { v: 2 }, { v: 3 }],
        factor: 10
      })
    ).toBe('60');
  });
  // ── Arrow with filters in body ────────────────────────────────────────────
  it('body with default filter', () => {
    expect(
      processTwig('{{ items | map(i => i.val | default(0)) | join(", ") }}', {
        items: [{ val: 5 }, {}, { val: 10 }]
      })
    ).toBe('5, 0, 10');
  });
  it('body with upper filter', () => {
    expect(
      processTwig('{{ items | map(i => i.name | upper) | join(", ") }}', {
        items: [{ name: 'alice' }, { name: 'bob' }]
      })
    ).toBe('ALICE, BOB');
  });
  it('body with length filter', () => {
    expect(
      processTwig('{{ words | map(w => w | length) | join(", ") }}', {
        words: ['hi', 'hello', 'hey']
      })
    ).toBe('2, 5, 3');
  });
  it('body with chained filters trim|upper', () => {
    expect(
      processTwig('{{ items | map(i => i.name | trim | upper) | join(", ") }}', {
        items: [{ name: '  alice  ' }, { name: '  bob  ' }]
      })
    ).toBe('ALICE, BOB');
  });
  it('body with to_json filter', () => {
    expect(
      processTwig('{{ items | map(i => i | to_json) | join(", ") }}', {
        items: [{ a: 1 }, { b: 2 }]
      })
    ).toBe('{"a":1}, {"b":2}');
  });
  it('body with round filter', () => {
    expect(
      processTwig('{{ items | map(i => i.v | round) | join(", ") }}', {
        items: [{ v: 1.2 }, { v: 3.8 }, { v: 5.5 }]
      })
    ).toBe('1, 4, 6');
  });
  it('body with replace filter', () => {
    expect(
      processTwig('{{ items | map(i => i | replace("old", "new")) | join(", ") }}', {
        items: ['old_a', 'old_b']
      })
    ).toBe('new_a, new_b');
  });
  it('body with base64_encode filter', () => {
    expect(
      processTwig('{{ items | map(i => i | base64_encode) | join(", ") }}', {
        items: ['hello', 'world']
      })
    ).toBe('aGVsbG8=, d29ybGQ=');
  });
  it('body with base64 roundtrip', () => {
    expect(
      processTwig('{{ items | map(i => i.v | base64_encode | base64_decode) | join(", ") }}', {
        items: [{ v: 'hello' }, { v: 'world' }]
      })
    ).toBe('hello, world');
  });
  it('body with abs filter', () => {
    expect(
      processTwig('{{ items | map(i => i.v | abs) | join(", ") }}', {
        items: [{ v: -5 }, { v: 10 }]
      })
    ).toBe('5, 10');
  });
  it('body with number filter', () => {
    expect(
      processTwig('{{ items | map(i => i.v | number(2)) | join(", ") }}', {
        items: [{ v: 1.234 }, { v: 5.678 }]
      })
    ).toBe('1.23, 5.68');
  });
  it('body with url_encode filter', () => {
    expect(
      processTwig('{{ items | map(i => i | url_encode) | join(", ") }}', {
        items: ['hello world', 'a&b=c']
      })
    ).toBe('hello%20world, a%26b%3Dc');
  });
  it('body with nl2br filter', () => {
    expect(
      processTwig('{{ items | map(i => i | nl2br) | join(", ") }}', {
        items: ['a\nb', 'c\nd']
      })
    ).toBe('a<br>b, c<br>d');
  });
  it('body with format filter', () => {
    expect(
      processTwig('{{ items | map(i => i.v | format(100)) | join(", ") }}', {
        items: [{ v: 'Price: $%d' }, { v: 'Count: %d' }]
      })
    ).toBe('Price: $100, Count: 100');
  });
  it('body with md5 filter', () => {
    expect(
      processTwig('{{ items | map(i => i.v | md5) | join(", ") }}', {
        items: [{ v: 'hello' }]
      })
    ).toBe('5d41402abc4b2a76b9719d911017c592');
  });
  it('body with ltrim filter', () => {
    expect(
      processTwig('{{ items | map(i => i.v | ltrim) | join(",") }}', {
        items: [{ v: '  a' }, { v: '  b  ' }]
      })
    ).toBe('a,b  ');
  });
  it('body with rtrim filter', () => {
    expect(
      processTwig('{{ items | map(i => i.v | rtrim) | join(",") }}', {
        items: [{ v: 'a  ' }, { v: '  b  ' }]
      })
    ).toBe('a,  b');
  });
  it('body with pad filter', () => {
    expect(
      processTwig('{{ items | map(i => i.v | pad(4, "0")) | join(", ") }}', {
        items: [{ v: '1' }, { v: '22' }]
      })
    ).toBe('0001, 0022');
  });
  it('body with padRight filter', () => {
    expect(
      processTwig('{{ items | map(i => i.v | padRight(4, ".")) | join(", ") }}', {
        items: [{ v: 'a' }, { v: 'bb' }]
      })
    ).toBe('a..., bb..');
  });
});
