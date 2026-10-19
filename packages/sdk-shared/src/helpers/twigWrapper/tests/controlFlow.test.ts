/* eslint-disable quotes */
import { expect, describe, it } from 'vitest';

import { processTwig } from '../index';

describe('AST processTwig — {% if %} control flow', () => {
  it('renders an if/else on truthiness', () => {
    const tpl = '{% if source %}Yes{% else %}No{% endif %}';
    expect(processTwig(tpl, { source: 'x' })).toBe('Yes');
    expect(processTwig(tpl, { source: '' })).toBe('No');
    expect(processTwig(tpl, {})).toBe('No');
  });

  it('renders an if on an equality comparison, plain and nested', () => {
    expect(processTwig('{% if a == b %}(You){% endif %}', { a: 5, b: 5 })).toBe('(You)');
    expect(processTwig('{% if a == b %}(You){% endif %}', { a: 5, b: 6 })).toBe('');
    expect(processTwig('{% if u.id == it.uid %}(You){% endif %}', { u: { id: 'z' }, it: { uid: 'z' } })).toBe('(You)');
  });

  it('supports relational operators', () => {
    const context = { source: 's', a: { b: 'AB' }, x: 5, y: 3 };
    expect(processTwig('{% if x > y %}G{% endif %}', context)).toBe('G');
    expect(processTwig('{% if x < y %}L{% else %}NL{% endif %}', context)).toBe('NL');
    expect(processTwig('{% if x >= 5 %}GE{% endif %}', context)).toBe('GE');
    expect(processTwig('{% if missing %}U{% else %}NU{% endif %}', context)).toBe('NU');
  });

  it('resolves nested blocks inner-first', () => {
    const context = { source: 's', a: { b: 'AB' }, x: 5, y: 3 };
    expect(processTwig('{% if a %}{% if source %}N{% endif %}{% endif %}', {})).toBe('');
    expect(processTwig('{% if source %}[{% if x == 5 %}IN{% endif %}]{% endif %}', context)).toBe('[IN]');
    expect(processTwig('{% if source %}{% if y == 5 %}A{% else %}B{% endif %}{% endif %}', context)).toBe('B');
  });

  it('supports elseif chains', () => {
    expect(processTwig('{% if a %}A{% elseif b %}B{% else %}C{% endif %}', { a: false, b: true })).toBe('B');
    expect(processTwig('{% if a %}A{% elseif b %}B{% else %}C{% endif %}', { a: false, b: false })).toBe('C');
  });

  it('leaves malformed if blocks untouched', () => {
    const context = { source: 's' };
    const malformed = [
      '{% if %}empty{% endif %}',
      '{% if source %}no endif here',
      'a{% endif %}b',
      'a{% else %}b',
      '{% if source %}A{% else %}B'
    ];
    for (const template of malformed) {
      expect(() => processTwig(template, context)).not.toThrow();
      expect(processTwig(template, context)).toBe(template);
    }
  });
});

describe('AST processTwig — {% for %} loops', () => {
  it('iterates over an array', () => {
    expect(processTwig('{% for item in items %}{{ item }}{% endfor %}', { items: ['a', 'b', 'c'] })).toBe('abc');
  });

  it('renders surrounding text around the loop', () => {
    expect(processTwig('pre {% for item in items %}[{{ item }}] {% endfor %}post', { items: ['x', 'y'] })).toBe(
      'pre [x] [y] post'
    );
  });

  it('resolves nested paths inside the loop body', () => {
    expect(
      processTwig('{% for item in items %}{{ item.name }}{% endfor %}', {
        items: [{ name: 'A' }, { name: 'B' }]
      })
    ).toBe('AB');
  });

  it('supports {% if %} inside the loop body', () => {
    expect(
      processTwig('{% for item in items %}{% if item.active %}{{ item.name }}{% endif %}{% endfor %}', {
        items: [
          { name: 'A', active: true },
          { name: 'B', active: false }
        ]
      })
    ).toBe('A');
  });

  it('supports nested for loops', () => {
    expect(
      processTwig('{% for a in matrix %}{% for b in a %}{{ b }}{% endfor %}{% endfor %}', {
        matrix: [
          [1, 2],
          [3, 4]
        ]
      })
    ).toBe('1234');
  });

  it('iterates over object key/value pairs', () => {
    expect(
      processTwig('{% for key, value in obj %}{{ key }}={{ value }} {% endfor %}', { obj: { a: '1', b: '2' } })
    ).toBe('a=1 b=2 ');
  });

  it('renders empty string for empty array', () => {
    expect(processTwig('{% for item in items %}X{% endfor %}', { items: [] })).toBe('');
  });

  it('renders else clause for empty array', () => {
    expect(processTwig('{% for item in items %}X{% else %}empty{% endfor %}', { items: [] })).toBe('empty');
  });

  it('renders else clause for undefined collection', () => {
    expect(processTwig('{% for item in missing %}X{% else %}none{% endfor %}', {})).toBe('none');
  });

  it('exposes loop metadata', () => {
    const tpl =
      '{% for item in items %}{{ loop.index }}:{{ loop.index0 }}{% if loop.first %}F{% endif %}{% if loop.last %}L{% endif %}({{ loop.length }}){% if not loop.last %},{% endif %}{% endfor %}';
    expect(processTwig(tpl, { items: ['a', 'b', 'c'] })).toBe('1:0F(3),2:1(3),3:2L(3)');
  });

  it('supports numeric range 0..N', () => {
    expect(processTwig('{% for i in 0..4 %}{{ i }}{% endfor %}', {})).toBe('01234');
  });

  it('supports reverse range N..0', () => {
    expect(processTwig('{% for i in 4..0 %}{{ i }}{% endfor %}', {})).toBe('43210');
  });

  it('supports range with variable bounds', () => {
    expect(processTwig('{% for i in start..end %}{{ i }}{% endfor %}', { start: 2, end: 5 })).toBe('2345');
  });

  it('handles no spaces around keywords', () => {
    expect(processTwig('{%for item in items%}{{ item }}{%endfor%}', { items: ['x'] })).toBe('x');
  });

  it('handles excessive whitespace', () => {
    expect(processTwig('{%   for   item   in   items   %}{{ item }}{%   endfor   %}', { items: ['x'] })).toBe('x');
  });

  it('cycles through values with {{ cycle() }}', () => {
    expect(
      processTwig('{% for item in items %}{{ cycle(["odd", "even"], loop.index0) }}{% endfor %}', {
        items: ['a', 'b', 'c']
      })
    ).toBe('oddevenodd');
  });

  it('leaves malformed for blocks untouched', () => {
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

describe('AST processTwig — {% set %} tags', () => {
  it('assigns a value with {% set %}', () => {
    expect(processTwig('{% set x = 5 %}{{ x }}', {})).toBe('5');
  });

  it('uses a set variable in a for loop', () => {
    expect(
      processTwig('{% set greeting = "Hi" %}{% for item in items %}{{ greeting }} {{ item }}{% endfor %}', {
        items: ['A', 'B']
      })
    ).toBe('Hi AHi B');
  });

  it('supports set with concat expression', () => {
    expect(processTwig('{% set full = first ~ " " ~ last %}{{ full }}', { first: 'John', last: 'Doe' })).toBe(
      'John Doe'
    );
  });

  it('supports set with arithmetic expression', () => {
    expect(processTwig('{% set result = a + b * c %}{{ result }}', { a: 1, b: 2, c: 3 })).toBe('7');
  });

  it('supports set with variable reference', () => {
    expect(processTwig('{% set x = 10 %}{% set y = x %}{{ y }}', {})).toBe('10');
  });

  it('supports multiple set blocks building on each other', () => {
    expect(processTwig('{% set a = "hello" %}{% set b = a ~ " world" %}{% set c = b ~ "!" %}{{ c }}', {})).toBe(
      'hello world!'
    );
  });

  it('set inside for loop accumulates per iteration', () => {
    expect(
      processTwig('{% set r = "" %}{% for i in items %}{% set r = r ~ i %}{% endfor %}{{ r }}', {
        items: ['a', 'b', 'c']
      })
    ).toBe('abc');
  });

  it('set with numeric operations', () => {
    expect(processTwig('{% set x = 5 %}{% set y = x * 2 + 1 %}{{ y }}', {})).toBe('11');
  });

  it('set with ternary expression', () => {
    expect(processTwig("{% set label = active ? 'on' : 'off' %}{{ label }}", { active: true })).toBe('on');
    expect(processTwig("{% set label = active ? 'on' : 'off' %}{{ label }}", { active: false })).toBe('off');
  });
});

describe('AST processTwig — {% break %} and {% continue %}', () => {
  it('break exits the loop early', () => {
    expect(
      processTwig('{% for i in items %}{% if i == 3 %}{% break %}{% endif %}{{ i }}{% endfor %}', {
        items: [1, 2, 3, 4, 5]
      })
    ).toBe('12');
  });

  it('continue skips to next iteration', () => {
    expect(
      processTwig('{% for i in items %}{% if i == 3 %}{% continue %}{% endif %}{{ i }}{% endfor %}', {
        items: [1, 2, 3, 4, 5]
      })
    ).toBe('1245');
  });

  it('break in nested loop only exits inner loop', () => {
    expect(
      processTwig(
        '{% for a in outer %}{% for b in inner %}{% if b == 2 %}{% break %}{% endif %}{{ b }}{% endfor %}-{% endfor %}',
        {
          outer: [
            ['a', 'b'],
            ['c', 'd']
          ],
          inner: [1, 2, 3]
        }
      )
    ).toBe('1-1-');
  });

  it('continue in nested loop only affects inner loop', () => {
    expect(
      processTwig(
        '{% for a in outer %}{% for b in items %}{% if b == 2 %}{% continue %}{% endif %}{{ b }}{% endfor %}|{% endfor %}',
        { outer: [1, 2], items: [1, 2, 3] }
      )
    ).toBe('13|13|');
  });
});

describe('AST processTwig — {% apply %} tag', () => {
  it('applies a single filter to block content', () => {
    expect(processTwig('{% apply upper %}hello{% endapply %}', {})).toBe('HELLO');
  });

  it('applies chained filters to block content', () => {
    expect(processTwig('{% apply upper | trim | capitalize %}  hello  {% endapply %}', {})).toBe('Hello');
  });

  it('apply with variable inside block', () => {
    expect(processTwig('{% apply upper %}{{ name }}{% endapply %}', { name: 'alice' })).toBe('ALICE');
  });

  it('apply with expression inside block', () => {
    expect(processTwig('{% apply upper %}{{ first }} {{ last }}{% endapply %}', { first: 'john', last: 'doe' })).toBe(
      'JOHN DOE'
    );
  });

  it('nested apply blocks', () => {
    expect(processTwig('{% apply upper %}outer {% apply lower %}INNER{% endapply %}{% endapply %}', {})).toBe(
      'OUTER INNER'
    );
  });
});

describe('AST processTwig — loop metadata', () => {
  it('exposes loop.revindex', () => {
    expect(processTwig('{% for i in items %}{{ loop.revindex }} {% endfor %}', { items: ['a', 'b', 'c'] })).toBe(
      '3 2 1 '
    );
  });

  it('loop.first and loop.last are correct for single item', () => {
    expect(processTwig('{% for i in items %}f={{ loop.first }} l={{ loop.last }}{% endfor %}', { items: ['x'] })).toBe(
      'f=true l=true'
    );
  });

  it('loop.length reflects original array length', () => {
    expect(processTwig('{% for i in items %}{{ loop.length }}{% endfor %}', { items: ['a', 'b', 'c', 'd', 'e'] })).toBe(
      '55555'
    );
  });
});

describe('AST processTwig — for with object values', () => {
  it('iterates over object values only (no key var)', () => {
    expect(processTwig('{% for v in obj %}{{ v }} {% endfor %}', { obj: { x: 'X', y: 'Y' } })).toBe('X Y ');
  });

  it('resolves object entries with dot-access in body', () => {
    expect(
      processTwig('{% for k, v in data %}{{ k }}:{{ v.name }} {% endfor %}', {
        data: { a: { name: 'Alice' }, b: { name: 'Bob' } }
      })
    ).toBe('a:Alice b:Bob ');
  });
});

describe('AST processTwig — concatenated set blocks', () => {
  it('builds a string across multiple set blocks', () => {
    const tpl = ['{% set a = "hello" %}', '{% set b = a ~ " world" %}', '{% set c = b ~ "!" %}', '{{ c }}'].join('');
    expect(processTwig(tpl, {})).toBe('hello world!');
  });

  it('arithmetic across set blocks', () => {
    const tpl = ['{% set x = 10 %}', '{% set y = x / 2 %}', '{% set z = y + 5 %}', '{{ z }}'].join('');
    expect(processTwig(tpl, {})).toBe('10');
  });
});
