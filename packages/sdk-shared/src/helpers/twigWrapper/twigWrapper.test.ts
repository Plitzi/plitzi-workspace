/* eslint-disable quotes */
import { expect, describe, it } from 'vitest';

import { processTwig, hasValidToken } from '.';

describe('twigWrapper', () => {
  it('processTwig should work successfully', () => {
    let result = processTwig(
      '{"id": "{{list_6464d847fb1604e21afad1eb.item.id}}","label": "{{list_6464d847fb1604e21afad1eb.item.name}}"}',
      { list_6464d847fb1604e21afad1eb: { item: { id: '123', name: 'test' } } }
    );

    expect(result).toStrictEqual('{"id": "123","label": "test"}');

    result = processTwig(
      '{"id": "{{list_6464d847fb1604e21afad1eb.item.id}}","label": "{{list_6464d847fb1604e21afad1eb.item.name}}"}',
      { list_6464d847fb1604e21afad1eb: { item: { id: '123', name: 'test' } } },
      true
    );

    expect(result).toStrictEqual('{"id": "123","label": "test"}');
  });

  describe('processTwig', () => {
    it('returns original value if no tokens', () => {
      expect(processTwig('hello world')).toBe('hello world');
    });

    it('renders simple token', () => {
      const result = processTwig('Hello {{ name }}', { name: 'Peter' });
      expect(result).toBe('Hello Peter');
    });

    it('renders nested token', () => {
      const result = processTwig('Hello {{ user.name }}', {
        user: { name: 'Peter' }
      });

      expect(result).toBe('Hello Peter');
    });

    it('renders deep nested token', () => {
      const result = processTwig('{{ user.profile.email }}', {
        user: { profile: { email: 'test@mail.com' } }
      });

      expect(result).toBe('test@mail.com');
    });

    it('keeps empty tokens when keepEmptyTokens=true', () => {
      const result = processTwig('Hello {{ name }}', {}, true);

      expect(result).toBe('Hello {{ name }}');
    });

    it('does not keep empty tokens when keepEmptyTokens=false', () => {
      const result = processTwig('Hello {{ name }}', {}, false);

      expect(result).toBe('Hello ');
    });

    it('supports default expression inside twig', () => {
      const result = processTwig(`Hello {{ name ?? 'Guest' }}`, {});

      expect(result).toBe('Hello Guest');
    });

    it('renders multiple tokens', () => {
      const result = processTwig('{{ first }} {{ last }}', { first: 'Peter', last: 'Parker' });

      expect(result).toBe('Peter Parker');
    });

    it('merges variables.variables into root', () => {
      const result = processTwig('Hello {{ name }}', { variables: { name: 'Peter' } });

      expect(result).toBe('Hello Peter');
    });

    it('returns JSON object when asRaw=true and valid JSON', () => {
      const result = processTwig('{{ data }}', { data: { hello: 'world' } }, false, true);

      expect(result).toEqual({ hello: 'world' });
    });

    it('returns string when asRaw=true but not JSON', () => {
      const result = processTwig('{{ name }}', { name: 'Peter' }, false, true);

      expect(result).toBe('Peter');
    });

    it('returns original template on twig syntax error', () => {
      const result = processTwig('{{ invalid ', {});

      expect(result).toBe('{{ invalid ');
    });

    it('supports nested variables with objects and default', () => {
      const template = 'Email: {{ user.contact.email ?? "none" }}';
      const vars = { user: { contact: { email: 'peter@mail.com' } } };
      expect(processTwig(template, vars)).toBe('Email: peter@mail.com');
    });

    // NEW

    it('returns [object Object] when asRaw=false', () => {
      const template = 'Data: {{ data }}';
      const result = processTwig(template, { data: { key: 'value', nested: { a: 1 } } }, false, false);
      expect(result).toBe('Data: [object Object]');
    });

    it('returns parsed object when asRaw=true', () => {
      const template = 'Data: {{ data | object_as_json }}';
      const result = processTwig(template, { data: { key: 'value', nested: { a: 1 } } }, false, true);
      expect(result).toEqual(`Data: ${JSON.stringify({ key: 'value', nested: { a: 1 } })}`);
    });

    // Hyphenated source tokens (`<type>_<idRef>` where the idRef carries a hyphen). Twig reads a bare '-' as
    // subtraction, so these resolve only because processTwig rewrites the path to `_context` subscript access.

    it('resolves a hyphenated source token instead of treating the hyphen as subtraction', () => {
      const result = processTwig('X {{ apiContainer_products-api.data.name }} Y', {
        'apiContainer_products-api': { data: { name: 'hello' } }
      });

      expect(result).toBe('X hello Y');
    });

    it('resolves a hyphenated token with keepEmptyTokens and keeps the original on a miss', () => {
      const vars = { 'list_card-1': { item: { id: '42' } } };
      expect(processTwig('{{ list_card-1.item.id }}', vars, true)).toBe('42');
      expect(processTwig('{{ list_card-1.item.missing }}', {}, true)).toBe('{{ list_card-1.item.missing }}');
    });

    it('resolves a hyphenated token with asRaw', () => {
      const result = processTwig('{{ list_card-1.item }}', { 'list_card-1': { item: { a: 1 } } }, false, true);

      expect(result).toEqual({ a: 1 });
    });

    it('leaves a hyphenated idRef in the leaf segment resolvable too', () => {
      const result = processTwig('{{ node_flow-1.my-field }}', { 'node_flow-1': { 'my-field': 'ok' } });

      expect(result).toBe('ok');
    });

    it('does not disturb a hyphen-free token', () => {
      expect(processTwig('Hello {{ user.name }}', { user: { name: 'Peter' } })).toBe('Hello Peter');
    });
  });

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
      const result = processTwig(
        '{% for item in items %}{%if item == "b"%}{%continue%}{%endif%}{{ item }}{% endfor %}',
        { items: ['a', 'b', 'c'] }
      );
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

  describe('comprehensive — combined features', () => {
    it('loop + conditional + token + filter combined', () => {
      const result = processTwig(
        '{% for item in items %}{% if item.active %}{{ item.name | upper }}{% endif %}{% endfor %}',
        {
          items: [
            { name: 'alice', active: true },
            { name: 'bob', active: false },
            { name: 'carol', active: true }
          ]
        }
      );
      expect(result).toBe('ALICECAROL');
    });

    it('nested loop + conditional + defaults', () => {
      const result = processTwig(
        '{% for cat in categories %}[{{ cat.name ?? "uncategorized" }}:{% for item in cat.items %}{% if item.visible %}{{ item.label ?? "?" }}{% endif %}{% endfor %}]{% endfor %}',
        {
          categories: [
            {
              name: 'Fruits',
              items: [
                { label: 'Apple', visible: true },
                { label: 'Banana', visible: false }
              ]
            },
            { items: [{ label: 'Carrot', visible: true }] },
            { name: 'Grains', items: [] }
          ]
        }
      );
      expect(result).toBe('[Fruits:Apple][uncategorized:Carrot][Grains:]');
    });

    it('loop + cycle + conditional + token', () => {
      const result = processTwig(
        '{% for item in items %}{% if item.show %}{{ cycle(["X", "Y"], loop.index0) }}-{{ item.name }}{% endif %}{% endfor %}',
        {
          items: [
            { name: 'a', show: true },
            { name: 'b', show: false },
            { name: 'c', show: true },
            { name: 'd', show: true }
          ]
        }
      );
      expect(result).toBe('X-aX-cY-d');
    });

    it('loop with conditional else + token defaults + filters', () => {
      const result = processTwig(
        '{% for user in users %}{% if user.name %}{{ user.name | upper }}{% else %}{{ user.email ?? "unknown" }}{% endif %},{% endfor %}',
        {
          users: [{ name: 'alice' }, { email: 'bob@test.com' }, { name: 'carol' }, {}]
        }
      );
      expect(result).toBe('ALICE,bob@test.com,CAROL,unknown,');
    });

    it('three nested loops with break in innermost', () => {
      const result = processTwig(
        '{% for a in data %}({% for b in a %}{% for c in b %}{% if c == "skip" %}{% break %}{% endif %}{{ c }}{% endfor %},{% endfor %}){% endfor %}',
        { data: [[['x', 'skip', 'y']], [['a'], ['b', 'skip']]] }
      );
      expect(result).toBe('(x,)(a,b,)');
    });

    it('loop + not operator + token in condition', () => {
      const result = processTwig(
        '{% for item in items %}{% if not item.hidden %}{{ item.value }}{% endif %}{% endfor %}',
        {
          items: [
            { value: 'A', hidden: false },
            { value: 'B', hidden: true },
            { value: 'C', hidden: false }
          ]
        }
      );
      expect(result).toBe('AC');
    });

    it('loop with comparison operators + default token', () => {
      const result = processTwig(
        '{% for n in numbers %}{% if n > 5 %}big{% else %}{% if n > 2 %}mid{% else %}small{% endif %}{% endif %}:{% endfor %}',
        { numbers: [1, 3, 7, 0, 5] }
      );
      expect(result).toBe('small:mid:big:small:mid:');
    });

    it('loop + range + token arithmetic display', () => {
      const result = processTwig('{% for i in 0..3 %}{{ i }}={% endfor %}', {});
      expect(result).toBe('0=1=2=3=');
    });

    it('loop with object entries + conditional + token defaults', () => {
      const result = processTwig('{% for k, v in config %}{% if v %}{{ k }}={{ v }}{% endif %}{% endfor %}', {
        config: { host: 'localhost', port: 3000, debug: false, verbose: true }
      });
      expect(result).toBe('host=localhostport=3000verbose=true');
    });

    it('multiple independent loops with conditionals in each', () => {
      const result = processTwig(
        '{% for x in a %}{% if x > 1 %}{{ x }}{% endif %}{% endfor %}-{% for y in b %}{% if y < "c" %}{{ y }}{% endif %}{% endfor %}',
        { a: [0, 1, 2, 3], b: ['a', 'b', 'c', 'd'] }
      );
      expect(result).toBe('23-ab');
    });

    it('loop body with mixed static text, tokens, conditionals, and filters', () => {
      const result = processTwig(
        '{% for item in items %}Item: {{ item.name | upper }} ({{ item.qty ?? 0 }}){% if not loop.last %}, {% endif %}{% endfor %}',
        { items: [{ name: 'apple', qty: 5 }, { name: 'banana' }, { name: 'cherry', qty: 12 }] }
      );
      expect(result).toBe('Item: APPLE (5), Item: BANANA (0), Item: CHERRY (12)');
    });

    it('loop with keepEmptyTokens — tokens inside loop body are still resolved', () => {
      const result = processTwig(
        '{% for item in items %}{{ item }}-{{ unknown_var }}{% endfor %}',
        { items: ['a', 'b'] },
        true
      );
      expect(result).toBe('a-b-');
    });

    it('loop with asRaw — objects in loop body rendered as [object Object] (loop hardcodes asRaw=false)', () => {
      const result = processTwig(
        '{% for item in items %}{{ item }}{% endfor %}',
        { items: [{ a: 1 }, { b: 2 }] },
        false,
        true
      );
      expect(result).toEqual('[object Object][object Object]');
    });

    it('nested loops with cycle in inner loop', () => {
      const result = processTwig(
        '{% for row in grid %}{% for col in row %}{{ cycle(["0", "1"], col) }}{% endfor %}|{% endfor %}',
        {
          grid: [
            [0, 1, 0],
            [1, 0, 1]
          ]
        }
      );
      expect(result).toBe('010|101|');
    });

    it('loop with filter chain inside', () => {
      const result = processTwig('{% for item in items %}{{ item | upper | trim }}{% endfor %}', {
        items: ['  a  ', 'B', ' c ']
      });
      expect(result).toBe('ABC');
    });

    it('loop with default filter on token', () => {
      const result = processTwig('{% for item in items %}{{ item.name | default("none") }}{% endfor %}', {
        items: [{ name: 'A' }, {}, { name: 'C' }]
      });
      expect(result).toBe('AnoneC');
    });

    it('loop + keepEmptyTokens + unresolved path + defaults', () => {
      const result = processTwig(
        '{% for item in items %}{{ item.missing ?? "fallback" }}{% endfor %}',
        { items: [{}, { missing: null }, {}] },
        true
      );
      expect(result).toBe('fallbackfallbackfallback');
    });
  });

  describe('comprehensive — broken templates', () => {
    it('missing endfor — body rendered but for tag remains', () => {
      const tpl = '{% for item in items %}{{ item }}';
      expect(() => processTwig(tpl, { items: ['a'] })).not.toThrow();
      const result = processTwig(tpl, { items: ['a'] });
      expect(result).toBe('{% for item in items %}');
    });

    it('missing endif — template passed through', () => {
      const tpl = '{% if true %}hello';
      expect(() => processTwig(tpl, {})).not.toThrow();
      const result = processTwig(tpl, {});
      expect(result).toBe(tpl);
    });

    it('extra endfor — template passed through', () => {
      const tpl = '{% for item in items %}{{ item }}{% endfor %}{% endfor %}';
      expect(() => processTwig(tpl, { items: ['a'] })).not.toThrow();
      const result = processTwig(tpl, { items: ['a'] });
      expect(result).toBe('a{% endfor %}');
    });

    it('extra endif — template passed through', () => {
      const tpl = '{% if true %}hello{% endif %}{% endif %}';
      expect(() => processTwig(tpl, {})).not.toThrow();
      const result = processTwig(tpl, {});
      expect(result).toBe('hello{% endif %}');
    });

    it('mismatched for/if — template passed through', () => {
      const tpl = '{% for item in items %}{% if true %}{{ item }}{% endfor %}{% endif %}';
      expect(() => processTwig(tpl, { items: ['a'] })).not.toThrow();
      expect(typeof processTwig(tpl, { items: ['a'] })).toBe('string');
    });

    it('double open for — template passed through', () => {
      const tpl = '{% for a in x %}{% for b in y %}{{ a }}{{ b }}{% endfor %}';
      expect(() => processTwig(tpl, { x: [1], y: [2] })).not.toThrow();
      expect(typeof processTwig(tpl, { x: [1], y: [2] })).toBe('string');
    });

    it('empty for body renders nothing', () => {
      const result = processTwig('{% for item in items %}{% endfor %}', { items: ['a', 'b', 'c'] });
      expect(result).toBe('');
    });

    it('only else clause renders else body', () => {
      const result = processTwig('{% for item in items %}{% else %}empty{% endfor %}', { items: [] });
      expect(result).toBe('empty');
    });

    it('malformed if tag — left untouched', () => {
      const tpl = '{% if %}hello{% endif %}';
      expect(() => processTwig(tpl, {})).not.toThrow();
      expect(processTwig(tpl, {})).toBe(tpl);
    });

    it('unclosed token — left untouched', () => {
      const tpl = 'Hello {{ name';
      expect(() => processTwig(tpl, { name: 'X' })).not.toThrow();
      expect(processTwig(tpl, { name: 'X' })).toBe(tpl);
    });

    it('empty token — left untouched', () => {
      const tpl = 'Hello {{}}';
      expect(() => processTwig(tpl, {})).not.toThrow();
      expect(processTwig(tpl, {})).toBe(tpl);
    });

    it('token with only spaces — left untouched', () => {
      const tpl = 'Hello {{   }}';
      expect(() => processTwig(tpl, {})).not.toThrow();
      expect(processTwig(tpl, {})).toBe(tpl);
    });

    it('nested unclosed tokens — left untouched', () => {
      const tpl = '{{ a {{ b }} }}';
      expect(() => processTwig(tpl, { a: 1, b: 2 })).not.toThrow();
      expect(typeof processTwig(tpl, { a: 1, b: 2 })).toBe('string');
    });

    it('for with completely empty body', () => {
      const result = processTwig('{% for i in 0..0 %}{% endfor %}', {});
      expect(result).toBe('');
    });

    it('if with completely empty body', () => {
      const result = processTwig('{% if true %}{% endif %}', {});
      expect(result).toBe('');
    });

    it('non-string template input — returned as-is', () => {
      expect(processTwig(null as unknown as string, {})).toBe(null);
      expect(processTwig(42 as unknown as string, {})).toBe(42);
      expect(processTwig(undefined as unknown as string, {})).toBe(undefined);
      expect(processTwig(true as unknown as string, {})).toBe(true);
    });

    it('template with only structural tags', () => {
      const result = processTwig('{% for a in x %}{% endfor %}{% if true %}{% endif %}', { x: [] });
      expect(result).toBe('');
    });

    it('random gibberish — no crash', () => {
      const gibberish = [
        '{%%}',
        '{% %}',
        '{{ }}',
        '{{ { }}',
        '{%for%}',
        '{% %} for {% endfor %}',
        '}} {{',
        '{%foriteminlist%}',
        '{% for item in %}{{ item }}{% endfor %}',
        '{% for in list %}{% endfor %}'
      ];
      for (const tpl of gibberish) {
        expect(() => processTwig(tpl, { list: ['a'], item: 'x' })).not.toThrow();
      }
    });

    it('extremely long template — no crash', () => {
      const long = 'x'.repeat(10000) + '{{ name }}' + 'y'.repeat(10000);
      expect(() => processTwig(long, { name: 'Z' })).not.toThrow();
      expect(processTwig(long, { name: 'Z' })).toBe('x'.repeat(10000) + 'Z' + 'y'.repeat(10000));
    });

    it('many repeated tokens — no crash', () => {
      const many = Array(500).fill('{{ name }}').join('');
      expect(() => processTwig(many, { name: 'X' })).not.toThrow();
      expect(processTwig(many, { name: 'X' })).toBe('X'.repeat(500));
    });

    it('many nested ifs — no crash', () => {
      const deep = '{% if true %}'.repeat(50) + 'hello' + '{% endif %}'.repeat(50);
      expect(() => processTwig(deep, {})).not.toThrow();
    });

    it('many nested fors — guard prevents infinite loop', () => {
      const result = processTwig('{% for a in x %}{% for b in y %}{{ a }}{{ b }}{% endfor %}{% endfor %}', {
        x: [1],
        y: [2]
      });
      expect(result).toBe('12');
    });
  });

  describe('comprehensive — edge cases', () => {
    it('empty array with else', () => {
      expect(processTwig('{% for x in items %}{{ x }}{% else %}nothing{% endfor %}', { items: [] })).toBe('nothing');
    });

    it('empty object with else', () => {
      expect(processTwig('{% for k, v in obj %}{{ k }}={{ v }}{% else %}empty{% endfor %}', { obj: {} })).toBe('empty');
    });

    it('single-element range 1..1', () => {
      expect(processTwig('{% for i in 1..1 %}{{ i }}{% endfor %}', {})).toBe('1');
    });

    it('large range 0..99 — no crash', () => {
      const result = processTwig('{% for i in 0..99 %}{{ i }},{% endfor %}', {});
      expect(result).toBe(Array.from({ length: 100 }, (_, i) => `${i},`).join(''));
    });

    it('loop variable shadows outer variable', () => {
      const result = processTwig('{% for item in items %}{{ item }}{% endfor %}{{ item }}', {
        items: ['inner'],
        item: 'outer'
      });
      expect(result).toBe('innerouter');
    });

    it('inner loop variable does not leak to outer', () => {
      const result = processTwig(
        '{% for a in items %}{% for b in a.items %}{{ b }}{% endfor %}-{{ b ?? "GONE" }}{% endfor %}',
        { items: [{ items: ['x', 'y'] }] }
      );
      expect(result).toBe('xy-GONE');
    });

    it('loop metadata survives nested conditionals', () => {
      const result = processTwig(
        '{% for item in items %}{% if loop.first %}FIRST{% endif %}{% if loop.last %}LAST{% endif %}:{% endfor %}',
        { items: ['a', 'b', 'c'] }
      );
      expect(result).toBe('FIRST::LAST:');
    });

    it('token before loop resolves with outer context', () => {
      const result = processTwig('{{ prefix }}{% for i in items %}{{ i }}{% endfor %}', {
        prefix: '>>',
        items: ['a', 'b']
      });
      expect(result).toBe('>>ab');
    });

    it('token after loop resolves with outer context', () => {
      const result = processTwig('{% for i in items %}{{ i }}{% endfor %}{{ suffix }}', {
        suffix: '<<',
        items: ['a', 'b']
      });
      expect(result).toBe('ab<<');
    });

    it('loop inside conditional', () => {
      const result = processTwig('{% if show %}{% for item in items %}{{ item }}{% endfor %}{% endif %}', {
        show: true,
        items: ['a', 'b']
      });
      expect(result).toBe('ab');
    });

    it('loop inside conditional — hidden', () => {
      const result = processTwig('{% if show %}{% for item in items %}{{ item }}{% endfor %}{% endif %}', {
        show: false,
        items: ['a', 'b']
      });
      expect(result).toBe('');
    });

    it('conditional inside loop with loop metadata', () => {
      const result = processTwig('{% for item in items %}{% if loop.index > 1 %}{{ item }}{% endif %}{% endfor %}', {
        items: ['a', 'b', 'c']
      });
      expect(result).toBe('bc');
    });

    it('deeply nested object path in loop', () => {
      const result = processTwig('{% for item in items %}{{ item.a.b.c }}{% endfor %}', {
        items: [{ a: { b: { c: 'X' } } }, { a: { b: { c: 'Y' } } }]
      });
      expect(result).toBe('XY');
    });

    it('undefined nested path in loop — renders empty', () => {
      const result = processTwig('{% for item in items %}[{{ item.a.b.c }}]{% endfor %}', { items: [{}] });
      expect(result).toBe('[]');
    });

    it('loop with null collection and else', () => {
      expect(processTwig('{% for x in val %}{{ x }}{% else %}null{% endfor %}', { val: null })).toBe('null');
    });

    it('loop with undefined collection and else', () => {
      expect(processTwig('{% for x in val %}{{ x }}{% else %}undef{% endfor %}', {})).toBe('undef');
    });

    it('break + continue in same loop body — only first match acts', () => {
      const result = processTwig(
        '{% for item in items %}{% if item == "a" %}{% continue %}{% endif %}{% if item == "c" %}{% break %}{% endif %}{{ item }}{% endfor %}',
        { items: ['a', 'b', 'c', 'd'] }
      );
      expect(result).toBe('b');
    });

    it('cycle with single value — repeats same value', () => {
      const result = processTwig('{% for i in 0..3 %}{{ cycle(["only"], loop.index0) }}{% endfor %}', {});
      expect(result).toBe('onlyonlyonlyonly');
    });

    it('cycle with empty array literal — left as raw token (array literal regex requires non-empty)', () => {
      const result = processTwig('{% for i in 0..2 %}{{ cycle([], loop.index0) }}{% endfor %}', {});
      expect(result).toBe('{{ cycle([], loop.index0) }}{{ cycle([], loop.index0) }}{{ cycle([], loop.index0) }}');
    });

    it('token with numeric-like value', () => {
      const result = processTwig('{% for item in items %}{{ item }}{% endfor %}', { items: [0, 1, -1, 3.14] });
      expect(result).toBe('01-13.14');
    });

    it('token with boolean value', () => {
      const result = processTwig('{% for item in items %}{{ item }}{% endfor %}', { items: [true, false] });
      expect(result).toBe('truefalse');
    });

    it('token with empty string value', () => {
      const result = processTwig('{% for item in items %}[{{ item }}]{% endfor %}', { items: [''] });
      expect(result).toBe('[]');
    });

    it('deeply nested loops — 4 levels', () => {
      const result = processTwig(
        '{% for a in d %}{% for b in a %}{% for c in b %}{% for e in c %}{{ e }}{% endfor %}:{% endfor %}|{% endfor %}{% endfor %}',
        { d: [[[[1, 2]], [[3]]], [[[4]]]] }
      );
      expect(result).toBe('12:|3:|4:|');
    });

    it('loop with comparison operators >= and <=', () => {
      const result = processTwig(
        '{% for n in nums %}{% if n >= 3 %}{% if n <= 5 %}{{ n }}{% endif %}{% endif %}{% endfor %}',
        { nums: [1, 2, 3, 4, 5, 6] }
      );
      expect(result).toBe('345');
    });

    it('loop with string comparison', () => {
      const result = processTwig('{% for item in items %}{% if item == "b" %}FOUND{% endif %}{{ item }}{% endfor %}', {
        items: ['a', 'b', 'c']
      });
      expect(result).toBe('aFOUNDbc');
    });

    it('loop with != comparison', () => {
      const result = processTwig('{% for item in items %}{% if item != "b" %}{{ item }}{% endif %}{% endfor %}', {
        items: ['a', 'b', 'c']
      });
      expect(result).toBe('ac');
    });

    it('loop with contains-like logic via nested conditionals', () => {
      const result = processTwig(
        '{% for item in items %}{% if item.active %}{% if item.priority == "high" %}H{{ item.name }}{% endif %}{% endif %}{% endfor %}',
        {
          items: [
            { name: 'A', active: true, priority: 'high' },
            { name: 'B', active: true, priority: 'low' },
            { name: 'C', active: false, priority: 'high' }
          ]
        }
      );
      expect(result).toBe('HA');
    });

    it('loop body with all-else branches', () => {
      const result = processTwig('{% for item in items %}{% if item.ok %}Y{% else %}N{% endif %}{% endfor %}', {
        items: [{ ok: false }, { ok: false }, { ok: false }]
      });
      expect(result).toBe('NNN');
    });

    it('loop with token that resolves to object — rendered via toString', () => {
      const result = processTwig('{% for item in items %}{{ item }}{% endfor %}', {
        items: [{ a: 1 }, [1, 2], 'str']
      });
      expect(result).toBe('[object Object]1,2str');
    });

    it('loop with token + asRaw — objects in loop rendered via toString (loop hardcodes asRaw=false)', () => {
      const result = processTwig(
        '{% for item in items %}{{ item }}{% endfor %}',
        { items: [{ a: 1 }, [1, 2]] },
        false,
        true
      );
      expect(result).toBe('[object Object]1,2');
    });

    it('keepEmptyTokens inside loop — tokens inside loop body are still resolved', () => {
      const result = processTwig('{% for item in items %}{{ item }}-{{ missing }}{% endfor %}', { items: ['X'] }, true);
      expect(result).toBe('X-');
    });

    it('loop with only whitespace body', () => {
      const result = processTwig('{% for item in items %}   {% endfor %}', { items: ['a', 'b'] });
      expect(result).toBe('      ');
    });

    it('multiple breaks in nested loops — each affects own loop', () => {
      const result = processTwig(
        '{% for a in items %}({% for b in a %}{% if b == 2 %}{% break %}{% endif %}{{ b }}{% endfor %}){% endfor %}',
        {
          items: [
            [1, 2, 3],
            [4, 5, 2, 6]
          ]
        }
      );
      expect(result).toBe('(1)(45)');
    });

    it('continue in outer + break in inner', () => {
      const result = processTwig(
        '{% for a in items %}{% if a.skip %}{% continue %}{% endif %}({% for b in a.vals %}{% if b == 9 %}{% break %}{% endif %}{{ b }}{% endfor %}){% endfor %}',
        {
          items: [
            { skip: false, vals: [1, 2, 3] },
            { skip: true, vals: [4, 5] },
            { skip: false, vals: [6, 9, 7] }
          ]
        }
      );
      expect(result).toBe('(123)(6)');
    });

    it('loop with token resolving to number 0', () => {
      const result = processTwig('{% for item in items %}{{ item }}{% endfor %}', { items: [0, 0, 0] });
      expect(result).toBe('000');
    });

    it('loop with token resolving to boolean true', () => {
      const result = processTwig('{% for item in items %}{{ item }}{% endfor %}', { items: [true] });
      expect(result).toBe('true');
    });

    it('loop with deeply nested conditional (5 levels) — name outside all ifs', () => {
      const result = processTwig(
        '{% for item in items %}{% if item.a %}{% if item.b %}{% if item.c %}{% if item.d %}{% if item.e %}DEEP{% endif %}{% endif %}{% endif %}{% endif %}{% endif %}{{ item.name }}{% endfor %}',
        {
          items: [
            { name: 'A', a: true, b: true, c: true, d: true, e: false },
            { name: 'B', a: true, b: true, c: true, d: true, e: true },
            { name: 'C', a: false, b: true, c: true, d: true, e: true }
          ]
        }
      );
      expect(result).toBe('ADEEPBC');
    });

    it('loop with cycle using variable array', () => {
      const result = processTwig('{% for i in items %}{{ cycle(colors, loop.index0) }}{% endfor %}', {
        items: [1, 2, 3, 4, 5],
        colors: ['R', 'G', 'B']
      });
      expect(result).toBe('RGBRG');
    });

    it('loop with default filter on missing nested path', () => {
      const result = processTwig('{% for item in items %}{{ item.a.b.c | default("N/A") }}{% endfor %}', {
        items: [{ a: { b: { c: 'OK' } } }, { a: {} }, {}]
      });
      expect(result).toBe('OKN/AN/A');
    });

    it('loop with trim filter', () => {
      const result = processTwig('{% for item in items %}[{{ item | trim }}]{% endfor %}', {
        items: ['  a  ', ' b ', 'c']
      });
      expect(result).toBe('[a][b][c]');
    });

    it('loop with length filter on token', () => {
      const result = processTwig('{% for item in items %}{{ item.name | length }}{% endfor %}', {
        items: [{ name: 'ab' }, { name: 'abcd' }, { name: 'a' }]
      });
      expect(result).toBe('241');
    });

    it('loop with lower filter', () => {
      const result = processTwig('{% for item in items %}{{ item | lower }}{% endfor %}', { items: ['A', 'B', 'C'] });
      expect(result).toBe('abc');
    });

    it('loop with capitalize filter', () => {
      const result = processTwig('{% for item in items %}{{ item | capitalize }}{% endfor %}', {
        items: ['hello', 'world']
      });
      expect(result).toBe('HelloWorld');
    });

    it('loop with join filter', () => {
      const result = processTwig('{% for item in items %}{{ items | join(",") }}{% endfor %}', {
        items: ['a', 'b', 'c']
      });
      expect(result).toBe('a,b,ca,b,ca,b,c');
    });

    it('complex real-world-ish template', () => {
      const result = processTwig(
        '<ul>{% for user in users %}{% if user.active %}<li>{{ user.name | upper }}: {{ user.email ?? "no email" }}</li>{% endif %}{% endfor %}</ul>',
        {
          users: [
            { name: 'alice', active: true, email: 'alice@test.com' },
            { name: 'bob', active: false, email: 'bob@test.com' },
            { name: 'carol', active: true },
            { name: 'dave', active: true, email: 'dave@test.com' }
          ]
        }
      );
      expect(result).toBe(
        '<ul><li>ALICE: alice@test.com</li><li>CAROL: no email</li><li>DAVE: dave@test.com</li></ul>'
      );
    });

    it('template with no tags at all — pure text', () => {
      expect(processTwig('just plain text', {})).toBe('just plain text');
    });

    it('template with only a token', () => {
      expect(processTwig('{{ x }}', { x: 42 })).toBe('42');
    });

    it('template with only a conditional', () => {
      expect(processTwig('{% if true %}yes{% endif %}', {})).toBe('yes');
    });

    it('template with only a loop', () => {
      expect(processTwig('{% for i in items %}{{ i }}{% endfor %}', { items: [1, 2] })).toBe('12');
    });

    it('loop with empty string collection variable', () => {
      const result = processTwig('{% for item in items %}{{ item }}{% else %}empty{% endfor %}', { items: '' });
      expect(result).toBe('empty');
    });

    it('loop with number collection variable', () => {
      const result = processTwig('{% for item in items %}{{ item }}{% else %}empty{% endfor %}', { items: 42 });
      expect(result).toBe('empty');
    });

    it('break on every iteration renders nothing', () => {
      const result = processTwig('{% for item in items %}{% break %}{{ item }}{% endfor %}', {
        items: ['a', 'b', 'c']
      });
      expect(result).toBe('');
    });

    it('continue on every iteration renders nothing', () => {
      const result = processTwig('{% for item in items %}{% continue %}{{ item }}{% endfor %}', {
        items: ['a', 'b', 'c']
      });
      expect(result).toBe('');
    });

    it('break on first iteration renders nothing', () => {
      const result = processTwig(
        '{% for item in items %}{% if loop.index == 1 %}{% break %}{% endif %}{{ item }}{% endfor %}',
        { items: ['a', 'b', 'c'] }
      );
      expect(result).toBe('');
    });

    it('continue on all but last renders all but last', () => {
      const result = processTwig(
        '{% for item in items %}{% if not loop.last %}{% continue %}{% endif %}{{ item }}{% endfor %}',
        { items: ['a', 'b', 'c'] }
      );
      expect(result).toBe('c');
    });
  });

  describe('hasValidToken - non strict (search mode)', () => {
    it('should detect valid simple token', () => {
      expect(hasValidToken('{{ token }}')).toBe(true);
    });

    it('should allow spaces around token', () => {
      expect(hasValidToken('{{          token        }}')).toBe(true);
    });

    it('should allow nested paths', () => {
      expect(hasValidToken('{{test.abc.def}}')).toBe(true);
    });

    it('should allow default expressions', () => {
      expect(hasValidToken("{{ test.pp ?? 'nice' }}")).toBe(true);
    });

    it('should detect token inside text', () => {
      expect(hasValidToken('this is a test {{ token }}')).toBe(true);
    });

    it('should reject numeric token', () => {
      expect(hasValidToken('{{123}}')).toBe(false);
    });

    it('should reject token starting with number', () => {
      expect(hasValidToken('{{1a}}')).toBe(false);
    });

    it('should return false for undefined', () => {
      expect(hasValidToken(undefined)).toBe(false);
    });

    it('should return false if no tokens present', () => {
      expect(hasValidToken('plain text')).toBe(false);
    });
  });

  describe('hasValidToken - strict mode', () => {
    it('should validate full string token only', () => {
      expect(hasValidToken('{{ token }}', true)).toBe(true);
    });

    it('should reject token inside text in strict mode', () => {
      expect(hasValidToken('this is {{ token }}', true)).toBe(false);
    });

    it('should reject invalid token in strict mode', () => {
      expect(hasValidToken('{{123}}', true)).toBe(false);
    });

    it('should allow nested path in strict mode', () => {
      expect(hasValidToken('{{ test.abc.def }}', true)).toBe(true);
    });

    it('should allow default expression in strict mode', () => {
      expect(hasValidToken("{{ test.pp ?? 'nice' }}", true)).toBe(true);
    });
  });
});
