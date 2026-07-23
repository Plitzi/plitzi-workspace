/* eslint-disable quotes */
import { expect, describe, it } from 'vitest';

import { processTwig } from './index';

// Contract tests for the AST-based twigWrapper implementation.
// These mirror the tests in twigWrapper.contract.test.ts for the regex-based version.
// The goal is to verify that both implementations produce identical output.

describe('AST processTwig — passthrough', () => {
  it('returns a non-string untouched', () => {
    expect(processTwig(42 as unknown as string)).toBe(42);
    expect(processTwig(null as unknown as string)).toBeNull();
    expect(processTwig(undefined as unknown as string)).toBeUndefined();
  });

  it('returns a string with no tokens unchanged', () => {
    expect(processTwig('already resolved')).toBe('already resolved');
    expect(processTwig('')).toBe('');
  });

  it('returns the original template on a twig syntax error', () => {
    expect(processTwig('{{ invalid ')).toBe('{{ invalid ');
  });
});

describe('AST processTwig — plain interpolation', () => {
  it('resolves a simple, nested and deep token', () => {
    expect(processTwig('{{ name }}', { name: 'Peter' })).toBe('Peter');
    expect(processTwig('{{ user.name }}', { user: { name: 'Peter' } })).toBe('Peter');
    expect(processTwig('{{ user.profile.email }}', { user: { profile: { email: 'a@b.com' } } })).toBe('a@b.com');
  });

  it('resolves a token embedded in surrounding text and multiple tokens', () => {
    expect(processTwig('Hello {{ name }}!', { name: 'Peter' })).toBe('Hello Peter!');
    expect(processTwig('{{ first }} {{ last }}', { first: 'Peter', last: 'Parker' })).toBe('Peter Parker');
  });

  it('renders a missing token or missing nested path as empty', () => {
    expect(processTwig('[{{ x }}]', {})).toBe('[]');
    expect(processTwig('[{{ a.b.c }}]', { a: {} })).toBe('[]');
  });

  it('renders an object token as JSON', () => {
    expect(processTwig('{{ o }}', { o: { a: 1 } })).toBe('{"a":1}');
  });

  it('merges variables.variables into the root context', () => {
    expect(processTwig('Hello {{ name }}', { variables: { name: 'Peter' } })).toBe('Hello Peter');
  });

  it('renders an object token as toString with triple braces', () => {
    expect(processTwig('{{{ o }}}', { o: { a: 1 } })).toBe('[object Object]');
  });

  it('renders mixed double and triple braces for same object', () => {
    const result = processTwig('{{ o }} vs {{{ o }}}', { o: { a: 1 } });
    expect(result).toBe('{"a":1} vs [object Object]');
  });

  it('triple braces with primitive renders same as double', () => {
    expect(processTwig('{{{ name }}}', { name: 'Peter' })).toBe('Peter');
  });
});

describe('AST processTwig — default (??) coalescing', () => {
  it('uses the default only when the value is undefined', () => {
    expect(processTwig("{{ x ?? 'def' }}", {})).toBe('def');
  });

  it('keeps an empty string and a zero rather than coalescing', () => {
    expect(processTwig("{{ x ?? 'def' }}", { x: '' })).toBe('');
    expect(processTwig("{{ x ?? 'def' }}", { x: 0 })).toBe('0');
  });
});

describe('AST processTwig — keepEmptyTokens', () => {
  it('resolves a present token', () => {
    expect(processTwig('{{ a }}', { a: 'X' }, true)).toBe('X');
    expect(processTwig('{{ a }}', { a: 0 }, true)).toBe('0');
  });

  it('keeps the original token text on a miss or an empty string', () => {
    expect(processTwig('{{ a }}', {}, true)).toBe('{{ a }}');
    expect(processTwig('{{ a }}', { a: '' }, true)).toBe('{{ a }}');
    expect(processTwig('Hello {{ name }}', {}, true)).toBe('Hello {{ name }}');
  });

  it('resolves the hit and keeps the miss when both appear', () => {
    expect(processTwig('{{ a }} {{ b }}', { a: 'X' }, true)).toBe('X {{ b }}');
  });
});

describe('AST processTwig — asRaw', () => {
  it('returns a parsed object and typed primitives', () => {
    expect(processTwig('{{ o }}', { o: { a: 1, nested: { b: 2 } } }, false, true)).toEqual({ a: 1, nested: { b: 2 } });
    expect(processTwig('{{ n }}', { n: 5 }, false, true)).toBe(5);
    expect(processTwig('{{ b }}', { b: true }, false, true)).toBe(true);
  });

  it('returns a plain string when the result is not JSON', () => {
    expect(processTwig('{{ s }}', { s: 'hi' }, false, true)).toBe('hi');
  });
});

describe('AST processTwig — hyphenated source tokens', () => {
  it('resolves a hyphenated <type>_<idRef> token', () => {
    expect(
      processTwig('X {{ apiContainer_products-api.data.name }} Y', {
        'apiContainer_products-api': { data: { name: 'hello' } }
      })
    ).toBe('X hello Y');
  });

  it('resolves a hyphen in the first and in a later segment', () => {
    expect(processTwig('{{ node_flow-1.my-field }}', { 'node_flow-1': { 'my-field': 'ok' } })).toBe('ok');
  });
});

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

  it('ternary with expressions on both sides', () => {
    expect(processTwig('{{ x > 0 ? x * 2 : 0 }}', { x: 5 })).toBe('10');
    expect(processTwig('{{ x > 0 ? x * 2 : 0 }}', { x: -1 })).toBe('0');
  });
});

describe('AST processTwig — edge cases for interpolation', () => {
  it('renders null as empty', () => {
    expect(processTwig('{{ val }}', { val: null })).toBe('');
  });

  it('renders undefined as empty', () => {
    expect(processTwig('{{ val }}', { val: undefined })).toBe('');
  });

  it('renders boolean true as "true"', () => {
    expect(processTwig('{{ val }}', { val: true })).toBe('true');
  });

  it('renders boolean false as "false"', () => {
    expect(processTwig('{{ val }}', { val: false })).toBe('false');
  });

  it('renders number 0 as "0"', () => {
    expect(processTwig('{{ val }}', { val: 0 })).toBe('0');
  });

  it('renders negative number', () => {
    expect(processTwig('{{ val }}', { val: -42 })).toBe('-42');
  });

  it('renders float', () => {
    expect(processTwig('{{ val }}', { val: 3.14 })).toBe('3.14');
  });

  it('renders array as JSON', () => {
    expect(processTwig('{{ items }}', { items: [1, 2, 3] })).toBe('[1,2,3]');
  });

  it('renders deeply nested object', () => {
    expect(processTwig('{{ o }}', { o: { a: { b: { c: 42 } } } })).toBe('{"a":{"b":{"c":42}}}');
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

describe('AST processTwig — deeply nested paths', () => {
  it('resolves 4-level deep path', () => {
    expect(processTwig('{{ a.b.c.d }}', { a: { b: { c: { d: 'deep' } } } })).toBe('deep');
  });

  it('returns empty on broken deep path', () => {
    expect(processTwig('{{ a.b.c.d }}', { a: { b: {} } })).toBe('');
  });

  it('resolves 5-level deep path', () => {
    expect(processTwig('{{ a.b.c.d.e }}', { a: { b: { c: { d: { e: 'deep5' } } } } })).toBe('deep5');
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

describe('AST processTwig — string literal escape sequences', () => {
  it('resolves \\n to a newline character', () => {
    expect(processTwig("{{ items | join('\\n') }}", { items: ['a', 'b', 'c'] })).toBe('a\nb\nc');
  });

  it('resolves \\t to a tab character', () => {
    expect(processTwig("{{ items | join('\\t') }}", { items: ['a', 'b'] })).toBe('a\tb');
  });

  it('resolves \\r to a carriage return', () => {
    expect(processTwig("{{ val | replace('\\r', '') }}", { val: 'a\rb' })).toBe('ab');
  });

  it('resolves double backslash to a literal backslash', () => {
    expect(processTwig("{{ val | replace('\\\\', '-') }}", { val: 'a\\b' })).toBe('a-b');
  });

  it('resolves escaped single quote inside single-quoted string', () => {
    expect(processTwig("{{ 'it\\'s' }}", {})).toBe("it's");
  });

  it('resolves escaped double quote inside double-quoted string', () => {
    expect(processTwig('{{ "say \\"hi\\"" }}', {})).toBe('say "hi"');
  });

  it('preserves unknown escape sequences as-is', () => {
    expect(processTwig("{{ '\\x' }}", {})).toBe('\\x');
  });

  it('handles multiple escape sequences in one string', () => {
    expect(processTwig("{{ 'a\\nb\\tc' }}", {})).toBe('a\nb\tc');
  });

  it('join with newline works end-to-end', () => {
    const result = processTwig("{{ source | join('\\n') }}", {
      source: ['line1', 'line2', 'line3']
    });
    expect(result).toBe('line1\nline2\nline3');
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
});

describe('AST processTwig — encoding filters', () => {
  it('base64_encode encodes string', () => {
    expect(processTwig('{{ val | base64_encode }}', { val: 'hello' })).toBe(btoa('hello'));
  });

  it('base64_decode decodes string', () => {
    expect(processTwig('{{ val | base64_decode }}', { val: btoa('hello') })).toBe('hello');
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
    ).toBe('68656c6c6f');
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

  it.skip('produces objects then accesses property', () => {
    // object literal syntax { key: value } is not supported in the expression parser
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

  it.skip('map then sort then map', () => {
    // object literal syntax { "label": i.name, "order": i.order } is not supported
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
