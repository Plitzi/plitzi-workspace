import { expect, describe, it } from 'vitest';

import { processTwig } from '../index';

// ── Comprehensive arrow function / map / reduce tests ──────────────────────────
describe('AST processTwig — arrow functions comprehensive', () => {
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
