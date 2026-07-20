/* eslint-disable quotes */
import { expect, describe, it } from 'vitest';

import { processTwig } from '../..';

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

    it('returns JSON object when asRaw=false (double braces now JSON-serialise objects)', () => {
      const template = 'Data: {{ data }}';
      const result = processTwig(template, { data: { key: 'value', nested: { a: 1 } } }, false, false);
      expect(result).toBe('Data: {"key":"value","nested":{"a":1}}');
    });

    it('returns parsed object when asRaw=true', () => {
      const template = 'Data: {{ data | object_as_json }}';
      const result = processTwig(template, { data: { key: 'value', nested: { a: 1 } } }, false, true);
      expect(result).toBe(`Data: ${JSON.stringify({ key: 'value', nested: { a: 1 } })}`);
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

    it('loop with double braces — objects in loop body rendered as JSON', () => {
      const result = processTwig(
        '{% for item in items %}{{ item }}{% endfor %}',
        { items: [{ a: 1 }, { b: 2 }] },
        false,
        true
      );
      expect(result).toEqual('{"a":1}{"b":2}');
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

    it('cycle with empty array literal — renders empty for each iteration', () => {
      const result = processTwig('{% for i in 0..2 %}{{ cycle([], loop.index0) }}{% endfor %}', {});
      expect(result).toBe('');
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

    it('loop with token that resolves to object — rendered as JSON via double braces', () => {
      const result = processTwig('{% for item in items %}{{ item }}{% endfor %}', {
        items: [{ a: 1 }, [1, 2], 'str']
      });
      expect(result).toBe('{"a":1}[1,2]str');
    });

    it('loop with token + asRaw — objects in loop rendered as JSON via double braces', () => {
      const result = processTwig(
        '{% for item in items %}{{ item }}{% endfor %}',
        { items: [{ a: 1 }, [1, 2]] },
        false,
        true
      );
      expect(result).toBe('{"a":1}[1,2]');
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

  describe('{% set %} tag', () => {
    it('sets variable from literal and uses it', () => {
      const result = processTwig('{% set greeting = "Hello" %}{{ greeting }}', {});
      expect(result).toBe('Hello');
    });

    it('sets variable from number', () => {
      const result = processTwig('{% set count = 42 %}{{ count }}', {});
      expect(result).toBe('42');
    });

    it('sets variable from another variable', () => {
      const result = processTwig('{% set b = a %}{{ b }}', { a: 'fromA' });
      expect(result).toBe('fromA');
    });

    it('sets variable from expression', () => {
      const result = processTwig('{% set x = 10 %}{% set y = x %}{{ y }}', {});
      expect(result).toBe('10');
    });

    it('block set captures content', () => {
      const result = processTwig('{% set content %}Hello World{% endset %}{{ content }}', {});
      expect(result).toBe('Hello World');
    });

    it('block set captures HTML', () => {
      const result = processTwig('{% set html %}<div>test</div>{% endset %}{{ html }}', {});
      expect(result).toBe('<div>test</div>');
    });

    it('set tag produces no output', () => {
      const result = processTwig('{% set x = "value" %}after', {});
      expect(result).toBe('after');
    });

    it('block set tag produces no output', () => {
      const result = processTwig('{% set x %}captured{% endset %}after', {});
      expect(result).toBe('after');
    });

    it('set variable available in subsequent tokens', () => {
      const result = processTwig(
        '{% set a = "hello" %}{% set b = "world" %}{{ a }} {{ b }}',
        {}
      );
      expect(result).toBe('hello world');
    });

    it('set variable available in conditionals', () => {
      const result = processTwig(
        '{% set status = "active" %}{% if status == "active" %}ON{% else %}OFF{% endif %}',
        {}
      );
      expect(result).toBe('ON');
    });

    it('set variable available in loops', () => {
      const result = processTwig(
        '{% set prefix = "item" %}{% for i in items %}{{ prefix }}-{{ i }} {% endfor %}',
        { items: [1, 2, 3] }
      );
      expect(result).toBe('item-1 item-2 item-3 ');
    });
  });

  describe('{% apply %} tag', () => {
    it('applies upper filter to content', () => {
      const result = processTwig('{% apply upper %}hello{% endapply %}', {});
      expect(result).toBe('HELLO');
    });

    it('applies lower filter to content', () => {
      const result = processTwig('{% apply lower %}HELLO{% endapply %}', {});
      expect(result).toBe('hello');
    });

    it('applies chained filters', () => {
      const result = processTwig('{% apply upper|trim %}  hello  {% endapply %}', {});
      expect(result).toBe('HELLO');
    });

    it('applies default filter', () => {
      const result = processTwig('{% apply default("fallback") %}{% endapply %}', {});
      expect(result).toBe('fallback');
    });

    it('does not produce output outside filter', () => {
      const result = processTwig('before{% apply upper %}middle{% endapply %}after', {});
      expect(result).toBe('beforeMIDDLEafter');
    });

    it('applies nl2br filter', () => {
      const result = processTwig(
        '{% apply nl2br %}hello\nworld{% endapply %}',
        {}
      );
      expect(result).toBe('hello<br>world');
    });

    it('applies striptags filter', () => {
      const result = processTwig('{% apply striptags %}<b>bold</b>{% endapply %}', {});
      expect(result).toBe('bold');
    });
  });
});
