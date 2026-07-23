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
});
