import { expect, describe, it } from 'vitest';

import { processTwig } from '../index';

// ── Comprehensive arrow function / map / reduce tests ──────────────────────────
describe('AST processTwig — arrow functions comprehensive', () => {
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
});
