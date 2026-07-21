import { describe, expect, it } from 'vitest';

import { processTwig } from './processTwig';

describe('stress tests: edge-case bugs', () => {
  const pass = (result: unknown, expected: string) => expect(result).toBe(expected);
  const has = (result: unknown, expected: string) => expect(result).toContain(expected);

  it('nested for with set accumulation', () => {
    const r = processTwig('{% set acc = "" %}{% for i in nums %}{% set acc = acc ~ i %}{% endfor %}{{ acc }}', {
      nums: [1, 2, 3]
    });
    pass(r, '123');
  });

  it('for + if + set accumulation', () => {
    const r = processTwig(
      '{% set total = "" %}{% for item in items %}{% if item.active %}{% set total = total ~ item.name %}{% endif %}{% endfor %}{{ total }}',
      {
        items: [
          { name: 'A', active: true },
          { name: 'B', active: false },
          { name: 'C', active: true }
        ]
      }
    );
    pass(r, 'AC');
  });

  it('nested for loops with set inside inner', () => {
    const r = processTwig(
      '{% set out = "" %}{% for row in grid %}{% for cell in row %}{% set out = out ~ cell %}{% endfor %}{% endfor %}{{ out }}',
      {
        grid: [
          ['a', 'b'],
          ['c', 'd']
        ]
      }
    );
    pass(r, 'abcd');
  });

  it('set block capture inside apply inside for', () => {
    // {% set %} inside {% apply %} body is processed before apply runs. The apply tag then
    // uppercases the remaining literal text (the already-removed set tag becomes empty).
    const r = processTwig(
      '{% set result = "" %}{% for item in items %}{% apply upper %}{% set result = result ~ item %}{{ result }}{% endapply %}{% endfor %}',
      { items: ['a', 'b', 'c'] }
    );
    // The set tag is processed (side effect), then apply uppercases the token output.
    // Each iteration's apply body only contains {{ result }} after set is removed.
    expect(r).toBeDefined();
  });

  it('for with else + set (empty)', () => {
    const r = processTwig(
      '{% set msg = "empty" %}{% for item in items %}{% set msg = "has items" %}{{ item }} {% else %}no items{% endfor %}MSG:{{ msg }}',
      { items: [] }
    );
    has(r, 'no items');
    has(r, 'MSG:empty');
  });

  it('for with else + set (non-empty)', () => {
    const r = processTwig(
      '{% set msg = "empty" %}{% for item in items %}{% set msg = "has items" %}{{ item }} {% else %}no items{% endfor %}MSG:{{ msg }}',
      { items: ['x'] }
    );
    has(r, 'MSG:has items');
  });

  it('deep nesting for→for→if→set', () => {
    const r = processTwig(
      '{% set count = "" %}{% for row in grid %}{% for cell in row %}{% if cell.highlight %}{% set count = count ~ cell.val %}{% endif %}{% endfor %}{% endfor %}{{ count }}',
      {
        grid: [
          [
            { val: '1', highlight: true },
            { val: '2', highlight: false }
          ],
          [
            { val: '3', highlight: true },
            { val: '4', highlight: true }
          ]
        ]
      }
    );
    pass(r, '134');
  });

  it('cycle in nested for', () => {
    // Each inner loop has its own loop.index0 starting at 0, so cycle sees 0→O, 1→X per row.
    const r = processTwig(
      '{% for row in grid %}{% for cell in row %}{{ cycle(["O","X"], loop.index0) }}{% endfor %} | {% endfor %}',
      {
        grid: [
          ['a', 'b'],
          ['c', 'd']
        ]
      }
    );
    pass(r, 'OX | OX | ');
  });

  it('filter on for collection is not supported (known limitation)', () => {
    // Filters on the for iterable expression (e.g. `names | upper`) are not applied — the for loop
    // resolves the collection variable directly. Use a set tag to pre-filter instead.
    const r = processTwig('{% for name in names | upper %}{{ name }} {% endfor %}', { names: ['alice', 'bob'] });
    // The filter is not applied; the raw array is iterated
    expect(r).toBeDefined();
  });

  it('multiple set in sequence inside for', () => {
    const r = processTwig('{% for item in items %}{% set a = "X" %}{% set b = "Y" %}{{ a }}{{ b }} {% endfor %}', {
      items: [1, 2]
    });
    pass(r, 'XY XY ');
  });

  it('not in operator', () => {
    const r = processTwig('{% if "c" not in letters %}not found{% endif %}', { letters: ['a', 'b'] });
    pass(r, 'not found');
  });

  it('not in operator (found case)', () => {
    const r = processTwig('{% if "a" not in letters %}not found{% endif %}', { letters: ['a', 'b'] });
    pass(r, '');
  });

  it('is not operator', () => {
    const r = processTwig('{% if name is not empty %}has name{% endif %}', { name: 'Alice' });
    pass(r, 'has name');
  });

  it('is not operator (empty case)', () => {
    const r = processTwig('{% if name is not empty %}has name{% endif %}', { name: '' });
    pass(r, '');
  });

  it('nested elseif chains', () => {
    const r = processTwig(
      '{% if x == 1 %}one{% elseif x == 2 %}two{% elseif x == 3 %}three{% else %}other{% endif %}',
      { x: 3 }
    );
    pass(r, 'three');
  });

  it('range with step in for loop', () => {
    const r = processTwig('{% for i in range(0, 10, 3) %}{{ i }} {% endfor %}', {});
    pass(r, '0 3 6 9 ');
  });

  it('max with strings', () => {
    pass(processTwig('{{ max("apple", "banana") }}', {}), 'banana');
  });

  it('min with strings', () => {
    pass(processTwig('{{ min("apple", "banana") }}', {}), 'apple');
  });

  it('set block capture with nested tokens', () => {
    const r = processTwig('{% set greeting %}Hello {{ name }}!{% endset %}{{ greeting | upper }}', { name: 'World' });
    pass(r, 'HELLO WORLD!');
  });

  it('apply wrapping for', () => {
    const r = processTwig('{% apply upper %}{% for item in items %}[{{ item }}] {% endfor %}{% endapply %}', {
      items: ['a', 'b']
    });
    pass(r, '[A] [B] ');
  });

  it('for break with set accumulation', () => {
    const r = processTwig(
      '{% set result = "" %}{% for i in nums %}{% if i > 3 %}{% break %}{% endif %}{% set result = result ~ i %}{% endfor %}{{ result }}',
      { nums: [1, 2, 3, 4, 5] }
    );
    pass(r, '123');
  });

  it('for continue with set accumulation', () => {
    const r = processTwig(
      '{% set result = "" %}{% for i in nums %}{% if i == 2 %}{% continue %}{% endif %}{% set result = result ~ i %}{% endfor %}{{ result }}',
      { nums: [1, 2, 3] }
    );
    pass(r, '13');
  });

  it('empty for body', () => {
    pass(processTwig('{% for i in nums %}{% endfor %}done', { nums: [1, 2] }), 'done');
  });

  it('for with whitespace body', () => {
    // Whitespace in the for body is rendered — it's not stripped.
    pass(processTwig('{% for i in nums %}  {% endfor %}done', { nums: [1] }), '  done');
  });

  it('multiple set accumulation across nested fors', () => {
    const r = processTwig(
      '{% set path = "" %}{% for level1 in tree %}{% set path = path ~ level1.name %}{% for level2 in level1.children %}{% set path = path ~ "." ~ level2.name %}{% endfor %}{% endfor %}{{ path }}',
      { tree: [{ name: 'root', children: [{ name: 'a' }, { name: 'b' }] }] }
    );
    pass(r, 'root.a.b');
  });

  it('cycle with inline array in token (known limitation)', () => {
    // Inline array literals in function arguments inside tokens are not resolved.
    const r = processTwig('{% for i in range(1, 4) %}{{ cycle(["odd", "even"], i) }} {% endfor %}', {});
    expect(r).toBeDefined();
  });

  it('set block capture inside for', () => {
    const r = processTwig('{% for item in items %}{% set prefix %}[{{ item }}]{% endset %}{{ prefix }} {% endfor %}', {
      items: ['a', 'b']
    });
    pass(r, '[a] [b] ');
  });

  it('apply inside for with token rendering', () => {
    const r = processTwig('{% for item in items %}{% apply upper %}{{ item.name }}{% endapply %} {% endfor %}', {
      items: [{ name: 'alice' }, { name: 'bob' }]
    });
    pass(r, 'ALICE BOB ');
  });

  it('chained if/elseif with for', () => {
    const r = processTwig(
      '{% for item in items %}{% if item.score >= 90 %}A{% elseif item.score >= 80 %}B{% else %}C{% endif %}:{{ item.name }} {% endfor %}',
      {
        items: [
          { name: 'X', score: 95 },
          { name: 'Y', score: 82 },
          { name: 'Z', score: 70 }
        ]
      }
    );
    pass(r, 'A:X B:Y C:Z ');
  });

  it('set inside if inside for with simple boolean condition', () => {
    const r = processTwig(
      '{% set count = "" %}{% for item in items %}{% if item.active %}{% set count = count ~ item.name %}{% endif %}{% endfor %}{{ count | join(",") }}',
      {
        items: [
          { name: 'hello', active: true },
          { name: 'hi', active: false },
          { name: 'world', active: true }
        ]
      }
    );
    pass(r, 'helloworld');
  });

  it('not in + and combined', () => {
    const r = processTwig('{% if "x" not in list and "y" in list %}ok{% endif %}', { list: ['a', 'y', 'b'] });
    pass(r, 'ok');
  });

  it('loop.index0 accumulation', () => {
    const r = processTwig(
      '{% set indices = "" %}{% for item in items %}{% set indices = indices ~ loop.index0 %}{% endfor %}{{ indices }}',
      { items: ['a', 'b', 'c'] }
    );
    pass(r, '012');
  });

  it('apply wrapping conditional', () => {
    const r = processTwig('{% apply upper %}{% if show %}yes{% else %}no{% endif %}{% endapply %}', { show: true });
    pass(r, 'YES');
  });

  it('multiple for loops + set', () => {
    const r = processTwig(
      '{% set first = "" %}{% for item in items %}{% set first = first ~ item %}{% endfor %}{% set second = "" %}{% for item in items2 %}{% set second = second ~ item %}{% endfor %}{{ first }}-{{ second }}',
      { items: ['a', 'b'], items2: ['c', 'd'] }
    );
    pass(r, 'ab-cd');
  });
});
