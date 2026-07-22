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
});
