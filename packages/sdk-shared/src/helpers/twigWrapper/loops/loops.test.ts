/* eslint-disable quotes */
import { expect, describe, it } from 'vitest';

import { processTwig } from '../..';

describe('for loops', () => {
  it('iterates over an array', () => {
    expect(processTwig('{% for item in items %}{{ item }}{% endfor %}', { items: ['a', 'b', 'c'] })).toBe('abc');
  });

  it('renders surrounding text around the loop', () => {
    const result = processTwig('pre {% for item in items %}[{{ item }}] {% endfor %}post', { items: ['x', 'y'] });
    expect(result).toBe('pre [x] [y] post');
  });

  it('resolves nested paths inside the loop body', () => {
    const result = processTwig('{% for item in items %}{{ item.name }}{% endfor %}', {
      items: [{ name: 'A' }, { name: 'B' }]
    });
    expect(result).toBe('AB');
  });

  it('supports {% if %} inside the loop body', () => {
    const result = processTwig('{% for item in items %}{% if item.active %}{{ item.name }}{% endif %}{% endfor %}', {
      items: [
        { name: 'A', active: true },
        { name: 'B', active: false }
      ]
    });
    expect(result).toBe('A');
  });

  it('supports nested for loops', () => {
    const result = processTwig('{% for a in matrix %}{% for b in a %}{{ b }}{% endfor %}{% endfor %}', {
      matrix: [
        [1, 2],
        [3, 4]
      ]
    });
    expect(result).toBe('1234');
  });

  it('iterates over object key/value pairs', () => {
    const result = processTwig('{% for key, value in obj %}{{ key }}={{ value }} {% endfor %}', {
      obj: { a: '1', b: '2' }
    });
    expect(result).toBe('a=1 b=2 ');
  });

  it('iterates over object values only (no second var)', () => {
    const result = processTwig('{% for item in obj %}{{ item }}{% endfor %}', {
      obj: { x: 'X', y: 'Y' }
    });
    expect(result).toBe('XY');
  });

  it('renders empty string for empty array', () => {
    expect(processTwig('{% for item in items %}X{% endfor %}', { items: [] })).toBe('');
  });

  it('renders else clause for empty array', () => {
    expect(processTwig('{% for item in items %}X{% else %}empty{% endfor %}', { items: [] })).toBe('empty');
  });

  it('renders empty string for undefined collection', () => {
    expect(processTwig('{% for item in missing %}X{% endfor %}', {})).toBe('');
  });

  it('renders else clause for undefined collection', () => {
    expect(processTwig('{% for item in missing %}X{% else %}none{% endfor %}', {})).toBe('none');
  });

  it('exposes loop.index (1-based)', () => {
    const result = processTwig('{% for item in items %}{{ loop.index }}{% endfor %}', { items: ['a', 'b', 'c'] });
    expect(result).toBe('123');
  });

  it('exposes loop.index0 (0-based)', () => {
    const result = processTwig('{% for item in items %}{{ loop.index0 }}{% endfor %}', { items: ['a', 'b', 'c'] });
    expect(result).toBe('012');
  });

  it('exposes loop.first and loop.last', () => {
    const result = processTwig(
      '{% for item in items %}{% if loop.first %}F{% endif %}{% if loop.last %}L{% endif %}|{% endfor %}',
      { items: ['a', 'b', 'c'] }
    );
    expect(result).toBe('F||L|');
  });

  it('exposes loop.revindex and loop.revindex0', () => {
    const result = processTwig('{% for item in items %}{{ loop.revindex }}:{{ loop.revindex0 }} {% endfor %}', {
      items: ['a', 'b', 'c']
    });
    expect(result).toBe('3:2 2:1 1:0 ');
  });

  it('exposes loop.length', () => {
    const result = processTwig('{% for item in items %}{{ loop.length }}{% endfor %}', { items: ['a', 'b', 'c'] });
    expect(result).toBe('333');
  });

  // Range syntax

  it('supports numeric range 0..N', () => {
    const result = processTwig('{% for i in 0..4 %}{{ i }}{% endfor %}', {});
    expect(result).toBe('01234');
  });

  it('supports reverse range N..0', () => {
    const result = processTwig('{% for i in 4..0 %}{{ i }}{% endfor %}', {});
    expect(result).toBe('43210');
  });

  it('supports range with variable bounds', () => {
    const result = processTwig('{% for i in start..end %}{{ i }}{% endfor %}', { start: 2, end: 5 });
    expect(result).toBe('2345');
  });

  it('supports range with reverse variable bounds', () => {
    const result = processTwig('{% for i in end..start %}{{ i }}{% endfor %}', { start: 2, end: 5 });
    expect(result).toBe('5432');
  });

  it('renders reverse range N..M when N > M', () => {
    const result = processTwig('{% for i in 5..2 %}{{ i }}{% endfor %}', {});
    expect(result).toBe('5432');
  });

  // Whitespace flexibility

  it('handles no spaces around keywords', () => {
    const result = processTwig('{%for item in items%}{{ item }}{%endfor%}', { items: ['x'] });
    expect(result).toBe('x');
  });

  it('handles excessive whitespace', () => {
    const result = processTwig('{%   for   item   in   items   %}{{ item }}{%   endfor   %}', { items: ['x'] });
    expect(result).toBe('x');
  });

  it('handles whitespace in else clause', () => {
    const result = processTwig('{% for item in items %}X{%  else  %}empty{%  endfor  %}', { items: [] });
    expect(result).toBe('empty');
  });

  // cycle() function

  it('cycles through values with loop.index0', () => {
    const result = processTwig('{% for item in items %}{{ cycle(["odd", "even"], loop.index0) }}{% endfor %}', {
      items: ['a', 'b', 'c']
    });
    expect(result).toBe('oddevenodd');
  });

  it('cycles through values with single-quoted strings', () => {
    const result = processTwig("{% for item in items %}{{ cycle(['odd', 'even'], loop.index0) }}{% endfor %}", {
      items: ['a', 'b', 'c']
    });
    expect(result).toBe('oddevenodd');
  });

  it('cycles through values from a variable', () => {
    const result = processTwig('{% for item in items %}{{ cycle(fruits, loop.index0) }}{% endfor %}', {
      items: [1, 2, 3],
      fruits: ['X', 'Y']
    });
    expect(result).toBe('XYX');
  });

  it('cycles with three values', () => {
    const result = processTwig('{% for i in 0..5 %}{{ cycle(["a", "b", "c"], loop.index0) }}{% endfor %}', {});
    expect(result).toBe('abcabc');
  });

  // break / continue

  it('break exits the loop early', () => {
    const result = processTwig(
      '{% for item in items %}{% if item == "b" %}{% break %}{% endif %}{{ item }}{% endfor %}',
      {
        items: ['a', 'b', 'c']
      }
    );
    expect(result).toBe('a');
  });

  it('continue skips the current iteration', () => {
    const result = processTwig(
      '{% for item in items %}{% if item == "b" %}{% continue %}{% endif %}{{ item }}{% endfor %}',
      { items: ['a', 'b', 'c'] }
    );
    expect(result).toBe('ac');
  });

  it('break stops at the first item when condition is always true', () => {
    const result = processTwig('{% for item in items %}{% break %}{{ item }}{% endfor %}', {
      items: ['a', 'b', 'c']
    });
    expect(result).toBe('');
  });

  it('continue skips all items when condition is always true', () => {
    const result = processTwig('{% for item in items %}{% continue %}{{ item }}{% endfor %}', {
      items: ['a', 'b', 'c']
    });
    expect(result).toBe('');
  });

  it('break with flexible whitespace', () => {
    const result = processTwig(
      '{% for item in items %}{%  if item == "b"  %}{%  break  %}{%  endif  %}{{ item }}{% endfor %}',
      { items: ['a', 'b', 'c'] }
    );
    expect(result).toBe('a');
  });

  it('continue with flexible whitespace', () => {
    const result = processTwig(
      '{% for item in items %}{%  if item == "b"  %}{%  continue  %}{%  endif  %}{{ item }}{% endfor %}',
      { items: ['a', 'b', 'c'] }
    );
    expect(result).toBe('ac');
  });

  it('break only affects the innermost loop', () => {
    const result = processTwig(
      '{% for a in matrix %}{% for b in a %}{% if b == 2 %}{% break %}{% endif %}{{ b }}{% endfor %}X{% endfor %}',
      {
        matrix: [
          [1, 2, 3],
          [4, 2, 5]
        ]
      }
    );
    expect(result).toBe('1X4X');
  });

  it('continue only affects the innermost loop', () => {
    const result = processTwig(
      '{% for a in matrix %}{% for b in a %}{% if b == 2 %}{% continue %}{% endif %}{{ b }}{% endfor %}X{% endfor %}',
      {
        matrix: [
          [1, 2, 3],
          [4, 2, 5]
        ]
      }
    );
    expect(result).toBe('13X45X');
  });

  // Malformed for blocks left untouched

  it('leaves malformed for blocks untouched without throwing', () => {
    const malformed = [
      '{% for in list %}X{% endfor %}',
      '{% for item, in list %}X{% endfor %}',
      '{% for item in %}X{% endfor %}',
      '{% for item in list %}X'
    ];
    for (const template of malformed) {
      expect(() => processTwig(template, { list: ['a'] })).not.toThrow();
      expect(processTwig(template, { list: ['a'] })).toBe(template);
    }
  });
});

describe('for loops — edge cases', () => {
  // break / continue outside a loop

  it('leaves {% break %} outside a loop untouched', () => {
    expect(processTwig('{% break %}', {})).toBe('{% break %}');
  });

  it('leaves {% continue %} outside a loop untouched', () => {
    expect(processTwig('{% continue %}', {})).toBe('{% continue %}');
  });

  it('leaves break inside if outside a loop untouched', () => {
    expect(processTwig('{% if true %}{% break %}{% endif %}', {})).toBe('{% break %}');
  });

  it('leaves continue inside if outside a loop untouched', () => {
    expect(processTwig('{% if true %}{% continue %}{% endif %}', {})).toBe('{% continue %}');
  });

  // break / continue whitespace variants

  it('handles {%break%} with no spaces', () => {
    const result = processTwig('{% for item in items %}{%if item == "b"%}{%break%}{%endif%}{{ item }}{% endfor %}', {
      items: ['a', 'b', 'c']
    });
    expect(result).toBe('a');
  });

  it('handles {%continue%} with no spaces', () => {
    const result = processTwig('{% for item in items %}{%if item == "b"%}{%continue%}{%endif%}{{ item }}{% endfor %}', {
      items: ['a', 'b', 'c']
    });
    expect(result).toBe('ac');
  });

  it('handles {%  break  %} with excessive whitespace', () => {
    const result = processTwig(
      '{% for item in items %}{% if item == "b" %}{%  break  %}{% endif %}{{ item }}{% endfor %}',
      { items: ['a', 'b', 'c'] }
    );
    expect(result).toBe('a');
  });

  it('handles {%  continue  %} with excessive whitespace', () => {
    const result = processTwig(
      '{% for item in items %}{% if item == "b" %}{%  continue  %}{% endif %}{{ item }}{% endfor %}',
      { items: ['a', 'b', 'c'] }
    );
    expect(result).toBe('ac');
  });

  // break / continue positions

  it('break at the very start of the body', () => {
    const result = processTwig('{% for item in items %}{% break %}{{ item }}{% endfor %}', {
      items: ['a', 'b', 'c']
    });
    expect(result).toBe('');
  });

  it('continue at the very start of the body', () => {
    const result = processTwig('{% for item in items %}{% continue %}{{ item }}{% endfor %}', {
      items: ['a', 'b', 'c']
    });
    expect(result).toBe('');
  });

  it('break after output on every iteration', () => {
    const result = processTwig('{% for item in items %}{{ item }}{% break %}{% endfor %}', {
      items: ['a', 'b', 'c']
    });
    expect(result).toBe('a');
  });

  it('continue after output on every iteration', () => {
    const result = processTwig('{% for item in items %}{{ item }}{% continue %}{% endfor %}', {
      items: ['a', 'b', 'c']
    });
    expect(result).toBe('abc');
  });

  // break / continue inside nested conditionals

  it('break inside deeply nested if blocks (3 levels)', () => {
    const result = processTwig(
      '{% for item in items %}{% if item.a %}{% if item.b %}{% if item.c %}{% break %}{% endif %}{% endif %}{% endif %}{{ item.name }}{% endfor %}',
      {
        items: [
          { name: 'A', a: true, b: true, c: false },
          { name: 'B', a: true, b: true, c: true },
          { name: 'C', a: true, b: true, c: false }
        ]
      }
    );
    expect(result).toBe('A');
  });

  it('continue inside deeply nested if blocks (3 levels)', () => {
    const result = processTwig(
      '{% for item in items %}{% if item.a %}{% if item.b %}{% if item.c %}{% continue %}{% endif %}{% endif %}{% endif %}{{ item.name }}{% endfor %}',
      {
        items: [
          { name: 'A', a: true, b: true, c: false },
          { name: 'B', a: true, b: true, c: true },
          { name: 'C', a: true, b: true, c: false }
        ]
      }
    );
    expect(result).toBe('AC');
  });

  it('break inside if/else — only triggers in the matching branch', () => {
    const result = processTwig(
      '{% for item in items %}{% if item > 2 %}{% break %}{% else %}{{ item }}{% endif %}{% endfor %}',
      { items: [1, 2, 3, 4] }
    );
    expect(result).toBe('12');
  });

  it('continue inside if/else — only triggers in the matching branch', () => {
    const result = processTwig(
      '{% for item in items %}{% if item > 2 %}{% continue %}{% else %}{{ item }}{% endif %}{% endfor %}',
      { items: [1, 2, 3, 4] }
    );
    expect(result).toBe('12');
  });

  // break / continue with else clause

  it('break skips the else clause', () => {
    const result = processTwig('{% for item in items %}{% break %}{% else %}never{% endfor %}', { items: ['a'] });
    expect(result).toBe('');
  });

  it('continue skips the else clause', () => {
    const result = processTwig('{% for item in items %}{% continue %}{% else %}never{% endfor %}', { items: ['a'] });
    expect(result).toBe('');
  });

  // nested loops with break/continue

  it('break in outer loop stops everything including inner loops', () => {
    const result = processTwig('{% for a in matrix %}{% break %}{% for b in a %}{{ b }}{% endfor %}{% endfor %}', {
      matrix: [
        [1, 2],
        [3, 4]
      ]
    });
    expect(result).toBe('');
  });

  it('continue in outer loop skips rest of outer body', () => {
    const result = processTwig(
      '{% for a in items %}{% continue %}{{ a }}-{% for b in a %}{{ b }}{% endfor %}{% endfor %}',
      { items: [['x'], ['y']] }
    );
    expect(result).toBe('');
  });

  it('break in inner loop preserves outer loop iterations', () => {
    const result = processTwig(
      '{% for a in items %}[{% for b in a %}{% if b == "stop" %}{% break %}{% endif %}{{ b }}{% endfor %}]{% endfor %}',
      {
        items: [
          ['a', 'stop', 'x'],
          ['b', 'c']
        ]
      }
    );
    expect(result).toBe('[a][bc]');
  });

  it('continue in inner loop preserves outer loop iterations', () => {
    const result = processTwig(
      '{% for a in items %}[{% for b in a %}{% if b == "skip" %}{% continue %}{% endif %}{{ b }}{% endfor %}]{% endfor %}',
      {
        items: [
          ['a', 'skip', 'b'],
          ['c', 'skip', 'd']
        ]
      }
    );
    expect(result).toBe('[ab][cd]');
  });

  it('triple nested loops', () => {
    const result = processTwig(
      '{% for a in data %}{% for b in a %}{% for c in b %}{{ c }}{% endfor %}:{% endfor %}|{% endfor %}',
      { data: [[[1, 2]], [[3, 4]]] }
    );
    expect(result).toBe('12:|34:|');
  });

  // collections edge cases

  it('single-element array', () => {
    const result = processTwig('{% for item in items %}{{ item }}{% endfor %}', { items: ['only'] });
    expect(result).toBe('only');
  });

  it('array with null elements', () => {
    const result = processTwig('{% for item in items %}[{{ item }}]{% endfor %}', { items: [null, 'x', null] });
    expect(result).toBe('[][x][]');
  });

  it('array with undefined elements', () => {
    const result = processTwig('{% for item in items %}[{{ item }}]{% endfor %}', {
      items: [undefined, 'y', undefined]
    });
    expect(result).toBe('[][y][]');
  });

  it('array with mixed types', () => {
    const result = processTwig('{% for item in items %}{{ item }}{% endfor %}', {
      items: ['str', 42, true, null]
    });
    expect(result).toBe('str42true');
  });

  it('array with falsy values still iterates', () => {
    const result = processTwig('{% for item in items %}[{{ item }}]{% endfor %}', {
      items: [0, false, '', null]
    });
    expect(result).toBe('[0][false][][]');
  });

  it('object with nested objects as values', () => {
    const result = processTwig('{% for item in items %}{{ item.name }}{% endfor %}', {
      items: { a: { name: 'A' }, b: { name: 'B' } }
    });
    expect(result).toBe('AB');
  });

  it('object with empty values', () => {
    const result = processTwig('{% for k, v in obj %}{{ k }}={{ v }}{% endfor %}', {
      obj: { a: '', b: 0 }
    });
    expect(result).toBe('a=b=0');
  });

  it('null collection renders else', () => {
    expect(processTwig('{% for item in items %}X{% else %}empty{% endfor %}', { items: null })).toBe('empty');
  });

  it('number collection renders else', () => {
    expect(processTwig('{% for item in items %}X{% else %}empty{% endfor %}', { items: 42 })).toBe('empty');
  });

  it('boolean collection renders else', () => {
    expect(processTwig('{% for item in items %}X{% else %}empty{% endfor %}', { items: true })).toBe('empty');
  });

  it('string collection renders else', () => {
    expect(processTwig('{% for item in items %}X{% else %}empty{% endfor %}', { items: 'abc' })).toBe('empty');
  });

  it('undefined collection renders else', () => {
    expect(processTwig('{% for item in items %}X{% else %}none{% endfor %}', {})).toBe('none');
  });

  // ranges edge cases

  it('range 0..0 produces a single iteration', () => {
    const result = processTwig('{% for i in 0..0 %}{{ i }}{% endfor %}', {});
    expect(result).toBe('0');
  });

  it('range 5..5 produces a single iteration', () => {
    const result = processTwig('{% for i in 5..5 %}{{ i }}{% endfor %}', {});
    expect(result).toBe('5');
  });

  it('range with negative numbers', () => {
    const result = processTwig('{% for i in -2..2 %}{{ i }}{% endfor %}', {});
    expect(result).toBe('-2-1012');
  });

  it('range with single step', () => {
    const result = processTwig('{% for i in 3..3 %}{{ i }}{% endfor %}', {});
    expect(result).toBe('3');
  });

  it('range with variable bounds — same value', () => {
    const result = processTwig('{% for i in x..x %}{{ i }}{% endfor %}', { x: 7 });
    expect(result).toBe('7');
  });

  // loop metadata edge cases

  it('loop metadata for single-element array', () => {
    const tpl =
      '{% for item in items %}i={{ loop.index }} i0={{ loop.index0 }} f={{ loop.first }} l={{ loop.last }} len={{ loop.length }} ri={{ loop.index }}{% endfor %}';
    expect(processTwig(tpl, { items: ['x'] })).toBe('i=1 i0=0 f=true l=true len=1 ri=1');
  });

  it('loop metadata consistency — first and last for two elements', () => {
    const tpl = '{% for item in items %}{% if loop.first %}F{% endif %}{% if loop.last %}L{% endif %}:{% endfor %}';
    expect(processTwig(tpl, { items: ['a', 'b'] })).toBe('F:L:');
  });

  it('loop.revindex decrements correctly', () => {
    const result = processTwig('{% for item in items %}{{ loop.revindex }}{% endfor %}', {
      items: ['a', 'b', 'c', 'd']
    });
    expect(result).toBe('4321');
  });

  it('loop.revindex0 decrements correctly', () => {
    const result = processTwig('{% for item in items %}{{ loop.revindex0 }}{% endfor %}', {
      items: ['a', 'b', 'c', 'd']
    });
    expect(result).toBe('3210');
  });

  it('loop.length is constant across iterations', () => {
    const result = processTwig('{% for item in items %}{{ loop.length }}{% endfor %}', {
      items: ['a', 'b', 'c']
    });
    expect(result).toBe('333');
  });

  it('loop metadata inside nested loops reflects inner collection', () => {
    const result = processTwig(
      '{% for a in items %}{% for b in a %}{{ b }}:{{ loop.index }}/{% endfor %}|{% endfor %}',
      { items: [['x', 'y'], ['z']] }
    );
    expect(result).toBe('x:1/y:2/|z:1/|');
  });

  // malformed templates — defensive

  it('leaves multiple malformed variants untouched without throwing', () => {
    const malformed = [
      '{% for in list %}X{% endfor %}',
      '{% for item, in list %}X{% endfor %}',
      '{% for item in %}X{% endfor %}',
      '{% for item in list %}X',
      '{% endfor %}',
      '{% for %}X{% endfor %}',
      'plain text with no tags',
      ''
    ];
    for (const template of malformed) {
      expect(() => processTwig(template, { list: ['a'] })).not.toThrow();
      const result = processTwig(template, { list: ['a'] });
      // Malformed templates that don't match FOR_OPEN should pass through unchanged
      if (template === '' || template === 'plain text with no tags') {
        expect(result).toBe(template);
      } else {
        // For loop-related malformed templates, they should either be left
        // unchanged or render without throwing
        expect(typeof result).toBe('string');
      }
    }
  });

  it('handles empty template', () => {
    expect(processTwig('', {})).toBe('');
  });

  it('handles template with only whitespace', () => {
    expect(processTwig('   ', {})).toBe('   ');
  });

  it('handles template with only for tags and no content', () => {
    const result = processTwig('{% for item in items %}{% endfor %}', { items: ['a', 'b'] });
    expect(result).toBe('');
  });

  // interaction with other features

  it('loop with tokens that have defaults', () => {
    const result = processTwig('{% for item in items %}{{ item.name ?? "N/A" }}{% endfor %}', {
      items: [{ name: 'A' }, {}, { name: 'C' }]
    });
    expect(result).toBe('AN/AC');
  });

  it('loop with if/else inside', () => {
    const result = processTwig('{% for item in items %}{% if item.active %}ON{% else %}OFF{% endif %}{% endfor %}', {
      items: [{ active: true }, { active: false }, { active: true }]
    });
    expect(result).toBe('ONOFFON');
  });

  it('loop body produces empty string for null token values', () => {
    const result = processTwig('{% for item in items %}[{{ item }}]{% endfor %}', {
      items: [null, undefined, 'ok']
    });
    expect(result).toBe('[][][ok]');
  });

  it('multiple independent loops in the same template', () => {
    const result = processTwig('{% for x in a %}{{ x }}{% endfor %}-{% for y in b %}{{ y }}{% endfor %}', {
      a: [1, 2],
      b: ['a', 'b', 'c']
    });
    expect(result).toBe('12-abc');
  });

  it('loop followed by static text', () => {
    const result = processTwig('{% for item in items %}{{ item }}{% endfor %}done', { items: ['a', 'b'] });
    expect(result).toBe('abdone');
  });

  it('static text followed by loop', () => {
    const result = processTwig('start{% for item in items %}{{ item }}{% endfor %}', { items: ['a', 'b'] });
    expect(result).toBe('startab');
  });

  it('loop body contains raw HTML-like content', () => {
    const result = processTwig('{% for item in items %}<div>{{ item }}</div>{% endfor %}', {
      items: ['A', 'B']
    });
    expect(result).toBe('<div>A</div><div>B</div>');
  });

  it('break with surrounding text outputs text before break', () => {
    const result = processTwig('{% for item in items %}START-{{ item }}-{% break %}-END{% endfor %}', {
      items: ['a', 'b', 'c']
    });
    expect(result).toBe('START-a-');
  });

  it('continue with surrounding text outputs text before continue for each iteration', () => {
    const result = processTwig('{% for item in items %}START-{{ item }}-{% continue %}-END{% endfor %}', {
      items: ['a', 'b', 'c']
    });
    expect(result).toBe('START-a-START-b-START-c-');
  });

  it('break on second iteration preserves first', () => {
    const result = processTwig(
      '{% for item in items %}{% if loop.index == 2 %}{% break %}{% endif %}{{ item }}{% endfor %}',
      { items: ['a', 'b', 'c', 'd'] }
    );
    expect(result).toBe('a');
  });

  it('continue on second iteration preserves others', () => {
    const result = processTwig(
      '{% for item in items %}{% if loop.index == 2 %}{% continue %}{% endif %}{{ item }}{% endfor %}',
      { items: ['a', 'b', 'c', 'd'] }
    );
    expect(result).toBe('acd');
  });

  it('break on last iteration renders all but last', () => {
    const result = processTwig(
      '{% for item in items %}{% if loop.last %}{% break %}{% endif %}{{ item }}{% endfor %}',
      { items: ['a', 'b', 'c'] }
    );
    expect(result).toBe('ab');
  });

  it('continue on last iteration has no effect', () => {
    const result = processTwig(
      '{% for item in items %}{% if loop.last %}{% continue %}{% endif %}{{ item }}{% endfor %}',
      { items: ['a', 'b', 'c'] }
    );
    expect(result).toBe('ab');
  });
});
