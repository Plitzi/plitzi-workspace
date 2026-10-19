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

  it('body with title filter', () => {
    expect(
      processTwig('{{ items | map(i => i.v | title) | join(", ") }}', {
        items: [{ v: 'hello world' }]
      })
    ).toBe('Hello World');
  });

  it('body with capitalize filter', () => {
    expect(
      processTwig('{{ items | map(i => i.v | capitalize) | join(", ") }}', {
        items: [{ v: 'hello' }]
      })
    ).toBe('Hello');
  });

  it('body with raw filter', () => {
    // raw wraps in RawMarker — when joined, the marker object renders as [object Object]
    expect(
      processTwig('{{ items | map(i => i.v | raw) | join(", ") }}', {
        items: [{ v: '<b>bold</b>' }]
      })
    ).toBe('[object Object]');
  });

  it('body with spaceless filter', () => {
    // spaceless removes inter-tag whitespace and trims
    expect(
      processTwig('{{ items | map(i => i.v | spaceless) | join(" | ") }}', {
        items: [{ v: '  a  b  ' }]
      })
    ).toBe('a  b');
  });

  it('body with date filter', () => {
    expect(
      processTwig('{{ items | map(i => i.d | date("Y-m-d")) | join(", ") }}', {
        items: [{ d: '2025-01-15' }, { d: '2025-12-25' }]
      })
    ).toBe('2025-01-15, 2025-12-25');
  });

  it('body with keys filter', () => {
    expect(
      processTwig('{{ items | map(i => i | keys | length) | join(", ") }}', {
        items: [{ a: 1, b: 2 }, { c: 3 }]
      })
    ).toBe('2, 1');
  });

  it('body with values filter', () => {
    expect(
      processTwig('{{ items | map(i => i | values | join("-")) | join(", ") }}', {
        items: [{ a: 1, b: 2 }, { c: 3 }]
      })
    ).toBe('1-2, 3');
  });

  it('body with first/last filters', () => {
    expect(
      processTwig('{{ items | map(i => i.vals | first) | join(", ") }}', {
        items: [{ vals: [10, 20] }, { vals: [30, 40] }]
      })
    ).toBe('10, 30');
    expect(
      processTwig('{{ items | map(i => i.vals | last) | join(", ") }}', {
        items: [{ vals: [10, 20] }, { vals: [30, 40] }]
      })
    ).toBe('20, 40');
  });

  it('body with merge filter', () => {
    // merge works on arrays — objects aren't supported via expression syntax
    expect(
      processTwig('{{ items | map(i => i.vals | merge(i.extra)) | join(", ") }}', {
        items: [
          { vals: [1, 2], extra: [3] },
          { vals: [4], extra: [5, 6] }
        ]
      })
    ).toBe('1,2,3, 4,5,6');
  });

  it('body with without filter', () => {
    expect(
      processTwig('{{ items | map(i => i | without("secret")) | to_json }}', {
        items: [{ name: 'a', secret: 'x' }]
      })
    ).toBe('[{"name":"a"}]');
  });

  it('body with only filter', () => {
    expect(
      processTwig('{{ items | map(i => i | only("name")) | to_json }}', {
        items: [{ name: 'a', secret: 'x' }]
      })
    ).toBe('[{"name":"a"}]');
  });

  it('body with column filter', () => {
    expect(
      processTwig('{{ items | map(i => i.people | column("name") | join(",")) | join(" | ") }}', {
        items: [{ people: [{ name: 'A' }, { name: 'B' }] }]
      })
    ).toBe('A,B');
  });

  it('body with pluck filter', () => {
    expect(
      processTwig('{{ items | map(i => i.people | pluck("name") | join(",")) | join(" | ") }}', {
        items: [{ people: [{ name: 'A' }, { name: 'B' }] }]
      })
    ).toBe('A,B');
  });

  it('body with unique filter', () => {
    expect(
      processTwig('{{ items | map(i => i.tags | unique | join(",")) | join(" | ") }}', {
        items: [{ tags: ['a', 'b', 'a'] }]
      })
    ).toBe('a,b');
  });

  it('body with sort filter', () => {
    expect(
      processTwig('{{ items | map(i => i.vals | sort | join(",")) | join(" | ") }}', {
        items: [{ vals: [3, 1, 2] }]
      })
    ).toBe('1,2,3');
  });

  it('body with sum filter', () => {
    expect(
      processTwig('{{ items | map(i => i.vals | sum) | join(", ") }}', {
        items: [{ vals: [1, 2, 3] }, { vals: [10, 20] }]
      })
    ).toBe('6, 30');
  });

  it('body with flatten filter', () => {
    expect(
      processTwig('{{ items | map(i => i.vals | flatten | join(",")) | join(" | ") }}', {
        items: [{ vals: [[1, 2], [3]] }]
      })
    ).toBe('1,2,3');
  });

  it('body with random filter', () => {
    expect(
      processTwig('{{ items | map(i => i.pool | random) | length }}', {
        items: [{ pool: [1, 2, 3] }, { pool: [4, 5] }]
      })
    ).toBe('2');
  });

  it('body with find filter (nested arrow)', () => {
    expect(
      processTwig('{{ items | map(i => i.people | find(p => p.age > 25) | default({}) | to_json) | join(", ") }}', {
        items: [
          {
            people: [
              { name: 'A', age: 20 },
              { name: 'B', age: 30 }
            ]
          }
        ]
      })
    ).toBe('{"name":"B","age":30}');
  });

  // ── Arrow producing objects / arrays ──────────────────────────────────────

  it('produces objects then accesses property', () => {
    expect(
      processTwig('{{ items | map(i => { k: i.name, v: i.val }) | map(o => o.k ~ "=" ~ o.v) | join(", ") }}', {
        items: [
          { name: 'a', val: 1 },
          { name: 'b', val: 2 }
        ]
      })
    ).toBe('a=1, b=2');
  });

  it('produces arrays then reduces', () => {
    expect(
      processTwig('{{ items | map(i => [i.a, i.b]) | flatten | reduce((a, b) => a + b, 0) }}', {
        items: [
          { a: 1, b: 2 },
          { a: 3, b: 4 }
        ]
      })
    ).toBe('10');
  });

  // ── Map chaining ──────────────────────────────────────────────────────────

  it('triple chained maps', () => {
    expect(
      processTwig('{{ items | map(i => i.v) | map(x => x * 2) | map(x => x + 1) | join(", ") }}', {
        items: [{ v: 1 }, { v: 2 }, { v: 3 }]
      })
    ).toBe('3, 5, 7');
  });

  it('map then filter then map', () => {
    expect(
      processTwig('{{ items | map(i => i.v) | filter(x => x > 2) | map(x => x * 10) | join(", ") }}', {
        items: [{ v: 1 }, { v: 3 }, { v: 5 }]
      })
    ).toBe('30, 50');
  });

  it('map then sort then map', () => {
    expect(
      processTwig(
        '{{ items | map(i => { "label": i.name, "order": i.order }) | sort(a => a.order) | map(x => x.label) | join(", ") }}',
        {
          items: [
            { name: 'C', order: 3 },
            { name: 'A', order: 1 },
            { name: 'B', order: 2 }
          ]
        }
      )
    ).toBe('A, B, C');
  });

  it('complex pipeline: map, filter, reduce', () => {
    expect(
      processTwig('{{ items | map(i => i.price) | filter(p => p > 10) | reduce((a, b) => a + b, 0) }}', {
        items: [{ price: 5 }, { price: 15 }, { price: 20 }, { price: 8 }]
      })
    ).toBe('35');
  });

  it('complex pipeline: map, unique, sort, join', () => {
    expect(
      processTwig('{{ items | map(i => i.city) | unique | sort | join(", ") }}', {
        items: [{ city: 'NYC' }, { city: 'LA' }, { city: 'NYC' }, { city: 'SF' }, { city: 'LA' }]
      })
    ).toBe('LA, NYC, SF');
  });

  // ── Arrow with set / if / for ─────────────────────────────────────────────

  it('set with map then if', () => {
    expect(
      processTwig('{% set names = items | map(i => i.name) %}{% if "Alice" in names %}found{% endif %}', {
        items: [{ name: 'Alice' }, { name: 'Bob' }]
      })
    ).toBe('found');
  });

  it('set with reduce then comparison', () => {
    expect(
      processTwig(
        '{% set total = nums | reduce((a, b) => a + b, 0) %}{% if total > 50 %}big{% elseif total > 20 %}medium{% else %}small{% endif %}',
        { nums: [10, 15, 20] }
      )
    ).toBe('medium');
  });

  it('map in for loop with loop variable', () => {
    expect(
      processTwig('{% for item in items %}{{ loop.index }}:{{ item.tags | map(t => t) | join(",") }} {% endfor %}', {
        items: [{ tags: ['a', 'b'] }, { tags: ['c'] }]
      })
    ).toBe('1:a,b 2:c ');
  });

  it('map producing array for loop iteration', () => {
    expect(
      processTwig('{% for name in items | map(i => i.name) %}[{{ name }}]{% endfor %}', {
        items: [{ name: 'X' }, { name: 'Y' }]
      })
    ).toBe('[X][Y]');
  });

  it('map inside for loop accessing parent scope', () => {
    expect(
      processTwig('{% for item in items %}[{{ item.tags | map(t => t | upper) | join(",") }}]{% endfor %}', {
        items: [{ tags: ['a', 'b'] }, { tags: ['c'] }]
      })
    ).toBe('[A,B][C]');
  });

  it('set with map then set', () => {
    expect(
      processTwig('{% set mapped = items | map(i => i.x) | join(",") %}Result:{{ mapped }}', {
        items: [{ x: 1 }, { x: 2 }, { x: 3 }]
      })
    ).toBe('Result:1,2,3');
  });

  it('multiple set blocks with arrows', () => {
    expect(
      processTwig(
        '{% set names = items | map(i => i.name) | join(",") %}' +
          '{% set count = items | map(i => i.name) | length %}' +
          '{{ names }} ({{ count }})',
        { items: [{ name: 'A' }, { name: 'B' }, { name: 'C' }] }
      )
    ).toBe('A,B,C (3)');
  });

  // ── Empty / edge-case arrays ──────────────────────────────────────────────

  it('map on empty array returns empty', () => {
    expect(processTwig('{{ items | map(i => i.name) | join(", ") }}', { items: [] })).toBe('');
  });

  it('reduce on empty array with initial returns initial', () => {
    expect(processTwig('{{ items | reduce((a, b) => a + b, 0) }}', { items: [] })).toBe('0');
  });

  it('reduce without initial on empty array returns empty', () => {
    expect(processTwig('{{ items | reduce((a, b) => a + b) }}', { items: [] })).toBe('');
  });

  it('map on single-element array', () => {
    expect(processTwig('{{ items | map(i => i.x) | join(", ") }}', { items: [{ x: 42 }] })).toBe('42');
  });

  it('reduce on single-element array without initial', () => {
    expect(processTwig('{{ items | reduce((a, b) => a + b) }}', { items: [99] })).toBe('99');
  });

  it('reduce with initial on single element', () => {
    expect(processTwig('{{ items | reduce((a, b) => a + b, 100) }}', { items: [5] })).toBe('105');
  });

  it('map on array with null values', () => {
    expect(
      processTwig('{{ items | map(i => i | default("N/A")) | join(", ") }}', {
        items: [null, 'hello', null]
      })
    ).toBe('N/A, hello, N/A');
  });

  it('map on array with mixed types', () => {
    expect(
      processTwig('{{ items | map(i => i | length) | join(", ") }}', {
        items: ['hi', 123, [1, 2, 3], { a: 1 }]
      })
    ).toBe('2, 3, 3, 1');
  });

  it('reduce concatenating mixed types', () => {
    expect(
      processTwig('{{ items | reduce((a, b) => a ~ b, "") }}', {
        items: ['a', 1, 'b', true]
      })
    ).toBe('a1btrue');
  });

  // ── Arrow body returning special values ───────────────────────────────────

  it('body returning null', () => {
    expect(
      processTwig('{{ items | map(i => i.v) | join(", ") }}', {
        items: [{ v: null }, { v: 'x' }]
      })
    ).toBe(', x');
  });

  it('body returning undefined', () => {
    expect(processTwig('{{ items | map(i => i.missing) | join(", ") }}', { items: [{}] })).toBe('');
  });

  it('body returning boolean true', () => {
    expect(processTwig('{{ items | map(i => true) | join(", ") }}', { items: [1, 2, 3] })).toBe('true, true, true');
  });

  it('body returning number zero', () => {
    expect(processTwig('{{ items | map(i => 0) | join(", ") }}', { items: [1, 2, 3] })).toBe('0, 0, 0');
  });

  it('body returning empty string', () => {
    expect(processTwig('{{ items | map(i => "") | join(", ") }}', { items: [1, 2, 3] })).toBe(', , ');
  });

  // ── Reduce edge cases ─────────────────────────────────────────────────────

  it('reduce using index', () => {
    expect(
      processTwig('{{ items | reduce((acc, item, idx) => acc ~ idx ~ ":" ~ item ~ " ", "") }}', {
        items: ['a', 'b', 'c']
      })
    ).toBe('0:a 1:b 2:c ');
  });

  it('reduce building string with separator', () => {
    expect(
      processTwig('{{ items | reduce((acc, item) => acc ? acc ~ ", " ~ item : item, "") }}', {
        items: ['a', 'b', 'c']
      })
    ).toBe('a, b, c');
  });

  it('reduce max', () => {
    expect(
      processTwig('{{ nums | reduce((max, n) => n > max ? n : max, nums | first) }}', {
        nums: [3, 7, 2, 9, 4]
      })
    ).toBe('9');
  });

  it('reduce min', () => {
    expect(
      processTwig('{{ nums | reduce((min, n) => n < min ? n : min, nums | first) }}', {
        nums: [3, 7, 2, 9, 4]
      })
    ).toBe('2');
  });

  it('reduce product', () => {
    expect(
      processTwig('{{ nums | reduce((acc, n) => acc * n, 1) }}', {
        nums: [2, 3, 4]
      })
    ).toBe('24');
  });

  // ── Deep nesting ──────────────────────────────────────────────────────────

  it('nested maps on nested data', () => {
    expect(
      processTwig('{{ groups | map(g => g.items | map(i => i.v) | join(",")) | join(" | ") }}', {
        groups: [{ items: [{ v: 1 }, { v: 2 }] }, { items: [{ v: 3 }, { v: 4 }, { v: 5 }] }]
      })
    ).toBe('1,2 | 3,4,5');
  });

  it('nested reduces', () => {
    expect(
      processTwig('{{ groups | map(g => g.items | reduce((a, b) => a + b, 0)) | reduce((a, b) => a + b, 0) }}', {
        groups: [{ items: [1, 2, 3] }, { items: [4, 5, 6] }]
      })
    ).toBe('21');
  });

  it('deeply nested map + reduce + filter', () => {
    expect(
      processTwig(
        '{{ data | map(d => d.items | filter(i => i.active) | map(i => i.score) | reduce((a, b) => a + b, 0)) | reduce((a, b) => a + b, 0) }}',
        {
          data: [
            {
              items: [
                { active: true, score: 10 },
                { active: false, score: 5 },
                { active: true, score: 20 }
              ]
            },
            {
              items: [
                { active: true, score: 30 },
                { active: true, score: 5 }
              ]
            }
          ]
        }
      )
    ).toBe('65');
  });

  it('arrow body using nested arrow (filter with arrow)', () => {
    expect(
      processTwig('{{ items | map(i => i.vals | filter(x => x > 2) | join(",")) | join(" | ") }}', {
        items: [{ vals: [1, 2, 3, 4] }, { vals: [5, 6] }]
      })
    ).toBe('3,4 | 5,6');
  });

  it('arrow body using nested arrow (map with arrow)', () => {
    expect(
      processTwig('{{ items | map(i => i.vals | map(x => x * 10) | join(",")) | join(" | ") }}', {
        items: [{ vals: [1, 2] }, { vals: [3] }]
      })
    ).toBe('10,20 | 30');
  });

  it('arrow body using nested arrow (reduce with arrow)', () => {
    expect(
      processTwig('{{ items | map(i => i.vals | reduce((a, b) => a + b, 0)) | join(", ") }}', {
        items: [{ vals: [1, 2, 3] }, { vals: [4, 5] }]
      })
    ).toBe('6, 9');
  });

  // ── Large data sets ───────────────────────────────────────────────────────

  it('map over 100 elements', () => {
    const items = Array.from({ length: 100 }, (_, i) => ({ v: i }));
    expect(processTwig('{{ items | map(i => i.v) | length }}', { items })).toBe('100');
  });

  it('reduce sum over 100 elements', () => {
    const nums = Array.from({ length: 100 }, (_, i) => i + 1);
    expect(processTwig('{{ nums | reduce((a, b) => a + b, 0) }}', { nums })).toBe('5050');
  });

  it('map + reduce pipeline on large data', () => {
    const items = Array.from({ length: 50 }, (_, i) => ({ price: i * 2 }));
    expect(processTwig('{{ items | map(i => i.price) | reduce((a, b) => a + b, 0) }}', { items })).toBe('2450');
  });

  it('map producing large array then join', () => {
    const items = Array.from({ length: 200 }, (_, i) => ({ id: i }));
    expect(processTwig('{{ items | map(i => i.id) | length }}', { items })).toBe('200');
  });

  // ── Reduce without arrow (non-function arg) ──────────────────────────────

  it('map without arrow returns original value', () => {
    expect(processTwig('{{ items | map }}', { items: [1, 2, 3] })).toBe('[1,2,3]');
  });

  it('reduce without arrow returns original value', () => {
    expect(processTwig('{{ items | reduce }}', { items: [1, 2, 3] })).toBe('[1,2,3]');
  });

  it('map on non-array returns original', () => {
    expect(processTwig('{{ val | map(x => x) }}', { val: 'hello' })).toBe('hello');
  });

  it('reduce on non-array returns original', () => {
    expect(processTwig('{{ val | reduce((a, b) => a + b) }}', { val: 'hello' })).toBe('hello');
  });
});

// ── Arrow function robustness ──────────────────────────────────────────────────
describe('AST processTwig — arrow parsing robustness', () => {
  it('parses a zero-parameter arrow returning a literal', () => {
    expect(processTwig('{{ items | map(() => 1) | join(",") }}', { items: [0, 0, 0] })).toBe('1,1,1');
  });

  it('parses a zero-parameter arrow that reads the captured scope', () => {
    expect(processTwig('{{ items | map(() => a + b) | join(",") }}', { items: [0, 0], a: 2, b: 3 })).toBe('5,5');
  });

  it('tolerates arbitrary whitespace around => and params', () => {
    expect(processTwig('{{ n | map(  x  =>  x  *  2  ) | join(",") }}', { n: [1, 2] })).toBe('2,4');
    expect(processTwig('{{ n | map( ( a , b ) => a + b , 0 ) | join(",") }}', { n: [1] })).toBe('1');
  });

  it('distinguishes an arrow from a parenthesised expression', () => {
    // `(a + b)` is a grouped expression, not an arrow; only `(a) =>` is an arrow.
    expect(processTwig('{{ (a + b) * 2 }}', { a: 2, b: 3 })).toBe('10');
    expect(processTwig('{{ n | filter((x) => x > 1) | join(",") }}', { n: [1, 2, 3] })).toBe('2,3');
  });

  it('renders a standalone arrow as an empty string', () => {
    expect(processTwig('{{ x => x }}', {})).toBe('');
    expect(processTwig('before {{ (a, b) => a + b }} after', {})).toBe('before  after');
  });

  it('supports a single-parameter arrow without parentheses', () => {
    expect(processTwig('{{ n | map(x => x + 1) | join(",") }}', { n: [1, 2, 3] })).toBe('2,3,4');
  });
});

describe('AST processTwig — arrow scope and closures', () => {
  it('binds the parameter over a captured variable of the same name (shadowing)', () => {
    expect(processTwig('{% set x = 999 %}{{ n | map(x => x) | join(",") }}', { n: [1, 2] })).toBe('1,2');
  });

  it('captures the enclosing loop variable at call time', () => {
    const tmpl = '{% for base in bases %}{{ subs | map(x => x + base) | join(",") }};{% endfor %}';
    expect(processTwig(tmpl, { bases: [10, 20], subs: [1, 2] })).toBe('11,12;21,22;');
  });

  it('captures a set variable defined before the arrow', () => {
    expect(processTwig('{% set k = 100 %}{{ n | map(x => x + k) | join(",") }}', { n: [1, 2] })).toBe('101,102');
  });

  it('does not leak arrow parameters into the outer scope', () => {
    expect(processTwig('{{ n | map(x => x) | join(",") }}{{ x ?? "unset" }}', { n: [1, 2] })).toBe('1,2unset');
  });

  it('evaluates a closure stored in a set variable', () => {
    expect(processTwig('{% set doubled = n | map(x => x * 10) %}{{ doubled | join(",") }}', { n: [1, 2] })).toBe(
      '10,20'
    );
  });
});

describe('AST processTwig — nested arrows', () => {
  it('maps a matrix with an inner map', () => {
    expect(
      processTwig('{{ m | map(row => row | map(c => c * 2) | join("-")) | join("|") }}', {
        m: [
          [1, 2],
          [3, 4]
        ]
      })
    ).toBe('2-4|6-8');
  });

  it('lets an inner arrow capture the outer arrow parameter', () => {
    expect(
      processTwig('{{ rows | map(r => cols | map(c => r ~ c) | join("")) | join(",") }}', {
        rows: ['A', 'B'],
        cols: ['1', '2']
      })
    ).toBe('A1A2,B1B2');
  });

  it('applies a map inside another map with independent parameters', () => {
    expect(
      processTwig('{{ groups | map(g => g.items | map(x => x * g.factor) | join("+")) | join(" ; ") }}', {
        groups: [
          { factor: 2, items: [1, 2] },
          { factor: 10, items: [3, 4] }
        ]
      })
    ).toBe('2+4 ; 30+40');
  });
});

describe('AST processTwig — arrow bodies with full expressions', () => {
  it('supports ternaries in the body', () => {
    expect(processTwig('{{ n | map(x => x > 2 ? "big" : "small") | join(",") }}', { n: [1, 2, 3] })).toBe(
      'small,small,big'
    );
  });

  it('supports logical operators in a filter predicate', () => {
    expect(processTwig('{{ n | filter(x => x > 1 and x < 4) | join(",") }}', { n: [1, 2, 3, 4] })).toBe('2,3');
  });

  it('supports the not in operator in a predicate', () => {
    expect(processTwig('{{ n | filter(x => x not in bad) | join(",") }}', { n: [1, 2, 3], bad: [2] })).toBe('1,3');
  });

  it('supports the ?? default operator', () => {
    expect(processTwig('{{ items | map(i => i.name ?? "anon") | join(",") }}', { items: [{ name: 'a' }, {}] })).toBe(
      'a,anon'
    );
  });

  it('supports deep path access', () => {
    expect(
      processTwig('{{ items | map(i => i.a.b.c) | join(",") }}', {
        items: [{ a: { b: { c: 1 } } }, { a: { b: { c: 2 } } }]
      })
    ).toBe('1,2');
  });

  it('supports concatenation in the body', () => {
    expect(processTwig('{{ items | map(i => i.f ~ " " ~ i.l) | join(", ") }}', { items: [{ f: 'A', l: 'B' }] })).toBe(
      'A B'
    );
  });

  it('supports unary minus in the body', () => {
    expect(processTwig('{{ n | map(x => -x) | join(",") }}', { n: [1, -2, 3] })).toBe('-1,2,-3');
  });

  it('exposes the element index as a second parameter', () => {
    expect(processTwig('{{ n | map((x, i) => x ~ ":" ~ i) | join(",") }}', { n: ['a', 'b', 'c'] })).toBe('a:0,b:1,c:2');
  });

  it('produces objects from a map then filters and reads them', () => {
    expect(
      processTwig('{{ n | map(x => { v: x }) | filter(o => o.v > 1) | map(o => o.v) | join(",") }}', { n: [1, 2, 3] })
    ).toBe('2,3');
  });
});

describe('AST processTwig — arrow callbacks across filters', () => {
  it('reduce without an initial value seeds from the first element', () => {
    expect(processTwig('{{ n | reduce((a, b) => a + b) }}', { n: [1, 2, 3, 4] })).toBe('10');
  });

  it('reduce with an initial value of 0', () => {
    expect(processTwig('{{ n | reduce((a, b) => a + b, 0) }}', { n: [] })).toBe('0');
  });

  it('chains filter, map and reduce', () => {
    expect(
      processTwig('{{ n | filter(x => x > 0) | map(x => x * x) | reduce((a, b) => a + b, 0) }}', { n: [-1, 2, 3] })
    ).toBe('13');
  });

  it('find returns the first element matching an arrow predicate', () => {
    expect(
      processTwig('{{ items | find(i => i.age > 30) | to_json }}', {
        items: [
          { name: 'A', age: 25 },
          { name: 'B', age: 35 },
          { name: 'C', age: 40 }
        ]
      })
    ).toBe('{"name":"B","age":35}');
  });

  it('sort with a comparator arrow orders descending', () => {
    expect(processTwig('{{ n | sort((a, b) => b - a) | join(",") }}', { n: [3, 1, 4, 1, 5] })).toBe('5,4,3,1,1');
  });
});
