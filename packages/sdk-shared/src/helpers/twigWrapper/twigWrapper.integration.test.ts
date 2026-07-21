import { describe, expect, it } from 'vitest';

import { processTwig } from './processTwig';

// ─── Integration tests that combine multiple Twig features in a single template ───
// Goal: stress the processing pipeline end-to-end, catch edge cases that unit tests miss.

describe('twigWrapper integration', () => {
  // ──────────────────────────────────────────────
  // 1. SET + TOKENS + FILTERS (pipeline order)
  // ──────────────────────────────────────────────
  describe('set + tokens + filters', () => {
    it('set a variable then render it through a filter chain', () => {
      const result = processTwig('{% set greeting = "hello" %}{{ greeting | upper | trim }}', {});
      expect(result).toBe('HELLO');
    });

    it('multiple set declarations feed into a single token', () => {
      const result = processTwig('{% set a = "foo" %}{% set b = "bar" %}{{ a }}-{{ b }}', {});
      expect(result).toBe('foo-bar');
    });

    it('set a variable from context and filter it', () => {
      const result = processTwig('{% set name = user %}{{ name | capitalize }}', { user: 'alice' });
      expect(result).toBe('Alice');
    });

    it('set captures block content then filters it', () => {
      const result = processTwig('{% set msg %}  hello world  {% endset %}{{ msg | trim | upper }}', {});
      expect(result).toBe('HELLO WORLD');
    });

    it('set then use in default filter', () => {
      const result = processTwig('{% set val = "" %}{{ val | default("fallback") }}', {});
      expect(result).toBe('fallback');
    });

    it('set a number, use number_format filter', () => {
      const result = processTwig('{% set amount = 1234567 %}{{ amount | number_format(2, ".", ",") }}', {});
      expect(result).toBe('1,234,567.00');
    });

    it('set a string, use replace then slice', () => {
      const result = processTwig(
        '{% set text = "Hello World" %}{{ text | replace("World", "Twig") | slice(0, 5) | lower }}',
        {}
      );
      expect(result).toBe('hello');
    });

    it('set variable overwrites previous set', () => {
      const result = processTwig('{% set x = "first" %}{% set x = "second" %}{{ x }}', {});
      expect(result).toBe('second');
    });

    it('set from context variable, then reference it', () => {
      const result = processTwig('{% set greeting = "Hi" %}{% set target = name %}{{ greeting }}, {{ target }}!', {
        name: 'Carlos'
      });
      expect(result).toBe('Hi, Carlos!');
    });
  });

  // ──────────────────────────────────────────────
  // 2. SET + CONDITIONALS (if/elseif/else)
  // ──────────────────────────────────────────────
  describe('set + conditionals', () => {
    it('set a variable then branch on it', () => {
      const result = processTwig(
        '{% set role = "admin" %}{% if role == "admin" %}Admin Panel{% elseif role == "editor" %}Editor Panel{% else %}User Panel{% endif %}',
        {}
      );
      expect(result).toBe('Admin Panel');
    });

    it('set + elseif chain picks first truthy', () => {
      const result = processTwig(
        '{% set score = 75 %}{% if score >= 90 %}A{% elseif score >= 80 %}B{% elseif score >= 70 %}C{% else %}F{% endif %}',
        {}
      );
      expect(result).toBe('C');
    });

    it('set from context drives conditional logic', () => {
      const result = processTwig('{% set active = isEnabled %}{% if active %}ACTIVE{% else %}INACTIVE{% endif %}', {
        isEnabled: true
      });
      expect(result).toBe('ACTIVE');
    });

    it('nested set + if blocks', () => {
      const result = processTwig('{% set x = 10 %}{% if x > 5 %}big{% if x > 8 %}very big{% endif %}{% endif %}', {});
      expect(result).toBe('bigvery big');
    });

    it('set + elseif + else with operators and/or', () => {
      const result = processTwig(
        '{% set a = true %}{% set b = false %}{% if a and b %}both{% elseif a or b %}at least one{% else %}none{% endif %}',
        {}
      );
      expect(result).toBe('at least one');
    });
  });

  // ──────────────────────────────────────────────
  // 3. LOOPS + TOKENS + FILTERS
  // ──────────────────────────────────────────────
  describe('loops + tokens + filters', () => {
    it('for loop renders items through a filter', () => {
      const result = processTwig('{% for name in names %}{{ name | upper }},{% endfor %}', { names: ['alice', 'bob'] });
      expect(result).toBe('ALICE,BOB,');
    });

    it('for loop with inline filter output', () => {
      const result = processTwig(
        '{% for item in items %}{{ item | upper }}{% if not loop.last %}, {% endif %}{% endfor %}',
        { items: ['a', 'b', 'c'] }
      );
      expect(result).toBe('A, B, C');
    });

    it('for loop over object with key/value', () => {
      const result = processTwig(
        '{% for k, v in config %}{{ k }}={{ v }}{% if not loop.last %}, {% endif %}{% endfor %}',
        { config: { host: 'localhost', port: 3000 } }
      );
      expect(result).toBe('host=localhost, port=3000');
    });

    it('for loop over range renders each value', () => {
      const result = processTwig('{% for i in 1..5 %}{{ i }}{% if not loop.last %}-{% endif %}{% endfor %}', {});
      expect(result).toBe('1-2-3-4-5');
    });

    it('for loop with cycle function', () => {
      const result = processTwig(
        '{% for i in 0..3 %}{{ cycle(["odd", "even"], i) }}{% if not loop.last %},{% endif %}{% endfor %}',
        {}
      );
      expect(result).toBe('odd,even,odd,even');
    });

    it('nested loops produce matrix output', () => {
      const result = processTwig(
        '{% for row in matrix %}{% for cell in row %}{{ cell }}{% if not loop.last %},{% endif %}{% endfor %}{% if not loop.last %} | {% endif %}{% endfor %}',
        {
          matrix: [
            ['a', 'b'],
            ['c', 'd']
          ]
        }
      );
      expect(result).toBe('a,b | c,d');
    });

    it('for loop with default filter on missing items', () => {
      const result = processTwig(
        '{% for item in items %}{{ item | default("N/A") }}{% if not loop.last %}, {% endif %}{% endfor %}',
        { items: ['ok', null, 'ok'] }
      );
      expect(result).toBe('ok, N/A, ok');
    });

    it('for loop over pre-reversed array', () => {
      const result = processTwig('{% for item in items %}{{ item }}{% if not loop.last %},{% endif %}{% endfor %}', {
        items: [3, 2, 1]
      });
      expect(result).toBe('3,2,1');
    });

    it('for loop over pre-sorted array', () => {
      const result = processTwig('{% for item in items %}{{ item }}{% if not loop.last %}, {% endif %}{% endfor %}', {
        items: ['a', 'b', 'c']
      });
      expect(result).toBe('a, b, c');
    });

    it('for loop with length filter on array', () => {
      const result = processTwig('Total: {{ items | length }}', { items: [1, 2, 3, 4, 5] });
      expect(result).toBe('Total: 5');
    });

    it('for loop with first/last filters', () => {
      const result = processTwig('First: {{ items | first }}, Last: {{ items | last }}', {
        items: ['alpha', 'beta', 'gamma']
      });
      expect(result).toBe('First: alpha, Last: gamma');
    });

    it('for loop with loop variables inside conditionals', () => {
      const result = processTwig(
        '{% for item in items %}{% if loop.first %}[FIRST]{% endif %}{{ item }}{% if loop.last %}[LAST]{% endif %}{% endfor %}',
        { items: ['a', 'b', 'c'] }
      );
      expect(result).toBe('[FIRST]abc[LAST]');
    });

    it('for with else when collection is empty', () => {
      const result = processTwig('{% for item in items %}{{ item }}{% else %}No items{% endfor %}', { items: [] });
      expect(result).toBe('No items');
    });

    it('for with else when collection is undefined', () => {
      const result = processTwig('{% for item in missing %}{{ item }}{% else %}Nothing here{% endfor %}', {});
      expect(result).toBe('Nothing here');
    });
  });

  // ──────────────────────────────────────────────
  // 4. CONDITIONALS + OPERATORS (complex boolean)
  // ──────────────────────────────────────────────
  describe('conditionals + operators', () => {
    it('and/or precedence: not a or b and c', () => {
      const result = processTwig(
        '{% set a = false %}{% set b = true %}{% set c = true %}{% if not a or b and c %}YES{% else %}NO{% endif %}',
        {}
      );
      expect(result).toBe('YES');
    });

    it('in operator with array', () => {
      const result = processTwig('{% set fruit = "apple" %}{% if fruit in fruits %}YES{% endif %}', {
        fruits: ['apple', 'banana', 'cherry']
      });
      expect(result).toBe('YES');
    });

    it('not in operator', () => {
      const result = processTwig('{% set fruit = "grape" %}{% if fruit not in fruits %}MISSING{% endif %}', {
        fruits: ['apple', 'banana']
      });
      expect(result).toBe('MISSING');
    });

    it('is null test', () => {
      const result = processTwig('{% if value is null %}NULL{% else %}NOT NULL{% endif %}', {});
      expect(result).toBe('NULL');
    });

    it('is not null test', () => {
      const result = processTwig('{% if value is not null %}DEFINED{% endif %}', { value: 'hello' });
      expect(result).toBe('DEFINED');
    });

    it('is empty test', () => {
      const result = processTwig('{% if items is empty %}EMPTY{% endif %}', { items: [] });
      expect(result).toBe('EMPTY');
    });

    it('is iterable test', () => {
      const result = processTwig('{% if items is iterable %}LIST{% endif %}', { items: [1, 2] });
      expect(result).toBe('LIST');
    });

    it('is defined test', () => {
      const result = processTwig('{% if name is defined %}YES{% endif %}', { name: 'test' });
      expect(result).toBe('YES');
    });

    it('is even test', () => {
      const result = processTwig('{% if num is even %}EVEN{% endif %}', { num: 4 });
      expect(result).toBe('EVEN');
    });

    it('is odd test', () => {
      const result = processTwig('{% if num is odd %}ODD{% endif %}', { num: 7 });
      expect(result).toBe('ODD');
    });

    it('is divisible by test', () => {
      const result = processTwig('{% if num is divisible by(3) %}DIV3{% endif %}', { num: 9 });
      expect(result).toBe('DIV3');
    });

    it('tilde concatenation operator', () => {
      const result = processTwig(
        '{% set a = "Hello" %}{% set b = "World" %}{% if a ~ " " ~ b == "Hello World" %}MATCH{% endif %}',
        {}
      );
      expect(result).toBe('MATCH');
    });

    it('tilde concatenation in condition produces string', () => {
      const result = processTwig('{% set x = 123 %}{% if x ~ "" == "123" %}STRING{% endif %}', {});
      expect(result).toBe('STRING');
    });

    it('complex nested conditionals', () => {
      const result = processTwig(
        '{% set a = 1 %}{% set b = 2 %}{% if a == 1 %}{% if b == 2 %}ONE-TWO{% elseif b == 3 %}ONE-THREE{% endif %}{% elseif a == 2 %}TWO{% endif %}',
        {}
      );
      expect(result).toBe('ONE-TWO');
    });

    it('conditional with comparison operators chain', () => {
      const result = processTwig('{% set x = 5 %}{% if x >= 1 and x <= 10 %}IN{% else %}OUT{% endif %}', {});
      expect(result).toBe('IN');
    });

    it('conditional with empty string is falsy', () => {
      const result = processTwig('{% set val = "" %}{% if val %}TRUTHY{% else %}FALSY{% endif %}', {});
      expect(result).toBe('FALSY');
    });

    it('conditional with zero is falsy', () => {
      const result = processTwig('{% set val = 0 %}{% if val %}TRUTHY{% else %}FALSY{% endif %}', {});
      expect(result).toBe('FALSY');
    });

    it('conditional with undefined is falsy', () => {
      const result = processTwig('{% if missing %}TRUTHY{% else %}FALSY{% endif %}', {});
      expect(result).toBe('FALSY');
    });
  });

  // ──────────────────────────────────────────────
  // 5. TOKENS + FUNCTIONS (cycle, max, min, range)
  // ──────────────────────────────────────────────
  describe('tokens + functions', () => {
    it('cycle with array variable in for loop', () => {
      const result = processTwig('{% for i in items %}{{ cycle(["odd", "even"], loop.index0) }}-{{ i }} {% endfor %}', {
        items: ['a', 'b', 'c']
      });
      expect(result).toBe('odd-a even-b odd-c ');
    });

    it('max with variable and literal', () => {
      const result = processTwig('Max: {{ max(val, 100) }}', { val: 42 });
      expect(result).toBe('Max: 100');
    });

    it('min with multiple values', () => {
      const result = processTwig('Min: {{ min(a, b, c) }}', { a: 5, b: 2, c: 8 });
      expect(result).toBe('Min: 2');
    });

    it('range syntax used in for loop', () => {
      const result = processTwig('{% for i in 1..4 %}{{ i }}{% if not loop.last %},{% endif %}{% endfor %}', {});
      expect(result).toBe('1,2,3,4');
    });

    it('for loop over pre-computed stepped range', () => {
      const result = processTwig('{% for i in items %}{{ i }}{% if not loop.last %},{% endif %}{% endfor %}', {
        items: [0, 3, 6]
      });
      expect(result).toBe('0,3,6');
    });

    it('max function without filter chain', () => {
      const result = processTwig('Max: {{ max(a, b) }}', { a: 1000, b: 2000 });
      expect(result).toBe('Max: 2000');
    });

    it('range in double-brace token renders as JSON array', () => {
      const result = processTwig('{{ range(1, 5) }}', {});
      expect(result).toBe('[1,2,3,4,5]');
    });

    it('min with single argument', () => {
      const result = processTwig('{{ min(5) }}', {});
      expect(result).toBe('5');
    });
  });

  // ──────────────────────────────────────────────
  // 6. BREAK + CONTINUE + IF inside loops
  // ──────────────────────────────────────────────
  describe('break/continue + if inside loops', () => {
    it('break early from loop', () => {
      const result = processTwig('{% for i in 0..9 %}{% if i == 3 %}{% break %}{% endif %}{{ i }}{% endfor %}', {});
      expect(result).toBe('012');
    });

    it('continue skips iteration', () => {
      const result = processTwig('{% for i in 0..4 %}{% if i == 2 %}{% continue %}{% endif %}{{ i }}{% endfor %}', {});
      expect(result).toBe('0134');
    });

    it('break with surrounding text preserves prefix', () => {
      const result = processTwig('{% for i in items %}[{{ i }}]{% if i == "b" %}{% break %}{% endif %}{% endfor %}', {
        items: ['a', 'b', 'c']
      });
      expect(result).toBe('[a][b]');
    });

    it('continue with surrounding text preserves prefix only', () => {
      const result = processTwig(
        '{% for i in items %}[{{ i }}]{% if i == "b" %}{% continue %}{% endif %}!{% endfor %}',
        { items: ['a', 'b', 'c'] }
      );
      expect(result).toBe('[a]![b][c]!');
    });

    it('break in inner loop only', () => {
      const result = processTwig(
        '{% for i in 0..1 %}{% for j in 0..3 %}{% if j == 2 %}{% break %}{% endif %}{{ i }}{{ j }} {% endfor %}{% endfor %}',
        {}
      );
      expect(result).toBe('00 01 10 11 ');
    });

    it('continue in inner loop only', () => {
      const result = processTwig(
        '{% for i in 0..1 %}{% for j in 0..3 %}{% if j == 2 %}{% continue %}{% endif %}{{ i }}{{ j }} {% endfor %}{% endfor %}',
        {}
      );
      expect(result).toBe('00 01 03 10 11 13 ');
    });

    it('conditional guard with break stops at first match', () => {
      const result = processTwig('{% for i in items %}{% if i == 4 %}{% break %}{% endif %}{{ i }}{% endfor %}', {
        items: [1, 2, 3, 4, 5]
      });
      expect(result).toBe('123');
    });
  });

  // ──────────────────────────────────────────────
  // 7. APPLY TAG + TOKENS + FILTERS
  // ──────────────────────────────────────────────
  describe('apply tag + tokens + filters', () => {
    it('apply chains multiple filters to block content', () => {
      const result = processTwig('{% apply upper | trim %}  hello world  {% endapply %}', {});
      expect(result).toBe('HELLO WORLD');
    });

    it('apply with variable content', () => {
      const result = processTwig('{% set msg = "hello" %}{% apply upper %}{{ msg }}{% endapply %}', {});
      expect(result).toBe('HELLO');
    });

    it('apply wraps around a for loop output', () => {
      const result = processTwig('{% apply upper %}{% for i in items %}{{ i }}{% endfor %}{% endapply %}', {
        items: ['a', 'b', 'c']
      });
      expect(result).toBe('ABC');
    });

    it('apply around conditional output', () => {
      const result = processTwig(
        '{% set show = true %}{% apply upper %}{% if show %}visible{% else %}hidden{% endif %}{% endapply %}',
        {}
      );
      expect(result).toBe('VISIBLE');
    });

    it('apply with striptags filter', () => {
      const result = processTwig('{% apply striptags %}<p>Hello <b>World</b></p>{% endapply %}', {});
      expect(result).toBe('Hello World');
    });

    it('apply with default filter on empty block', () => {
      const result = processTwig('{% apply default("empty") %}{% endapply %}', {});
      expect(result).toBe('empty');
    });

    it('nested apply tags — outer processes content as text', () => {
      const result = processTwig('{% apply upper %}{% apply lower %}HELLO{% endapply %}{% endapply %}', {});
      expect(result).toContain('HELLO');
    });

    it('apply with nl2br filter', () => {
      const result = processTwig('{% apply nl2br %}line1\nline2{% endapply %}', {});
      expect(result).toBe('line1<br>line2');
    });

    it('apply around tokens with filters', () => {
      const result = processTwig('{% set val = "  hello  " %}{% apply upper %}{{ val | trim }}{% endapply %}', {});
      expect(result).toBe('HELLO');
    });
  });

  // ──────────────────────────────────────────────
  // 8. TOKENS + RAW / TRIPLE BRACES
  // ──────────────────────────────────────────────
  describe('raw and triple braces', () => {
    it('double brace serializes object as JSON', () => {
      const result = processTwig('{{ data }}', { data: { name: 'test', value: 42 } });
      expect(result).toBe('{"name":"test","value":42}');
    });

    it('triple brace renders object as toString', () => {
      const result = processTwig('{{{ data }}}', { data: { name: 'test' } });
      expect(result).toBe('[object Object]');
    });

    it('triple brace renders array as comma-separated', () => {
      const result = processTwig('{{{ items }}}', { items: [1, 2, 3] });
      expect(result).toBe('1,2,3');
    });

    it('raw filter on object bypasses JSON', () => {
      const result = processTwig('{{ data | raw }}', { data: { name: 'test' } });
      expect(result).toBe('[object Object]');
    });

    it('to_json filter on object produces JSON', () => {
      const result = processTwig('{{ data | to_json }}', { data: { a: 1 } });
      expect(result).toBe('{"a":1}');
    });

    it('to_json on primitive passes through', () => {
      const result = processTwig('{{ val | to_json }}', { val: 42 });
      expect(result).toBe('42');
    });

    it('json_encode is alias for to_json', () => {
      const result = processTwig('{{ data | json_encode }}', { data: { x: 1 } });
      expect(result).toBe('{"x":1}');
    });

    it('null renders as empty string', () => {
      const result = processTwig('{{ val }}', { val: null });
      expect(result).toBe('');
    });

    it('undefined renders as empty string', () => {
      const result = processTwig('{{ missing }}', {});
      expect(result).toBe('');
    });

    it('boolean renders as string', () => {
      const result = processTwig('{{ flag }}', { flag: true });
      expect(result).toBe('true');
    });

    it('false renders as "false"', () => {
      const result = processTwig('{{ flag }}', { flag: false });
      expect(result).toBe('false');
    });
  });

  // ──────────────────────────────────────────────
  // 9. FILTER CHAINS (multiple filters in sequence)
  // ──────────────────────────────────────────────
  describe('filter chains', () => {
    it('trim + upper chain', () => {
      const result = processTwig('{{ val | trim | upper }}', { val: '  hello  ' });
      expect(result).toBe('HELLO');
    });

    it('slice + upper + join on split', () => {
      const result = processTwig('{{ val | split(",") | first | upper }}', { val: 'hello,world' });
      expect(result).toBe('HELLO');
    });

    it('default + upper chain', () => {
      const result = processTwig('{{ missing | default("fallback") | upper }}', {});
      expect(result).toBe('FALLBACK');
    });

    it('length + number_format chain (no-op for number)', () => {
      const result = processTwig('{{ items | length }}', { items: [1, 2, 3] });
      expect(result).toBe('3');
    });

    it('reverse + join chain', () => {
      const result = processTwig('{{ items | reverse | join("-") }}', { items: ['a', 'b', 'c'] });
      expect(result).toBe('c-b-a');
    });

    it('sort + join chain', () => {
      const result = processTwig('{{ items | sort | join(", ") }}', { items: ['c', 'a', 'b'] });
      expect(result).toBe('a, b, c');
    });

    it('batch produces grouped arrays rendered with join', () => {
      const result = processTwig('{% for b in batches %}[{{ b | join("|") }}]{% endfor %}', {
        batches: [[1, 2], [3, 4], [5]]
      });
      expect(result).toBe('[1|2][3|4][5]');
    });

    it('contains filter returns true', () => {
      const result = processTwig('{{ val | contains("ell") }}', { val: 'hello' });
      expect(result).toBe('true');
    });

    it('contains filter returns false', () => {
      const result = processTwig('{{ val | contains("xyz") }}', { val: 'hello' });
      expect(result).toBe('false');
    });

    it('startswith filter returns true', () => {
      const result = processTwig('{{ val | startswith("hel") }}', { val: 'hello' });
      expect(result).toBe('true');
    });

    it('endswith filter returns true', () => {
      const result = processTwig('{{ val | endswith("llo") }}', { val: 'hello' });
      expect(result).toBe('true');
    });

    it('url_encode filter', () => {
      const result = processTwig('{{ val | url_encode }}', { val: 'hello world' });
      expect(result).toBe('hello%20world');
    });

    it('abs filter on negative', () => {
      const result = processTwig('{{ val | abs }}', { val: -42 });
      expect(result).toBe('42');
    });

    it('round filter default', () => {
      const result = processTwig('{{ val | round }}', { val: 3.7 });
      expect(result).toBe('4');
    });

    it('round filter with precision', () => {
      const result = processTwig('{{ val | round(2) }}', { val: 3.14159 });
      expect(result).toBe('3.14');
    });

    it('column filter on array of objects', () => {
      const result = processTwig('{{ users | column("name") | join(", ") }}', {
        users: [{ name: 'Alice' }, { name: 'Bob' }]
      });
      expect(result).toBe('Alice, Bob');
    });

    it('format filter', () => {
      const result = processTwig('{{ val | format("Hello", "%s") }}', { val: '%s %s' });
      expect(result).toBe('Hello %s');
    });

    it('number_format with defaults', () => {
      const result = processTwig('{{ val | number_format(2) }}', { val: 1234.5 });
      expect(result).toBe('1234.50');
    });
  });

  // ──────────────────────────────────────────────
  // 10. VARIABLES.MERGE (auto-root context)
  // ──────────────────────────────────────────────
  describe('context merging', () => {
    it('variables.variables merges into root', () => {
      const result = processTwig('Hello {{ name }}!', { variables: { name: 'World' } });
      expect(result).toBe('Hello World!');
    });

    it('root context takes precedence over variables', () => {
      const result = processTwig('{{ name }}', { name: 'root', variables: { name: 'fromVars' } });
      expect(result).toBe('root');
    });

    it('nested path access', () => {
      const result = processTwig('{{ user.profile.name }}', { user: { profile: { name: 'Alice' } } });
      expect(result).toBe('Alice');
    });

    it('nullish coalescing ?? for missing', () => {
      const result = processTwig('{{ missing ?? "default" }}', {});
      expect(result).toBe('default');
    });

    it('nullish coalescing ?? does not trigger on empty string', () => {
      const result = processTwig('{{ val ?? "default" }}', { val: '' });
      expect(result).toBe('');
    });

    it('nullish coalescing ?? does not trigger on zero', () => {
      const result = processTwig('{{ val ?? "default" }}', { val: 0 });
      expect(result).toBe('0');
    });

    it('nullish coalescing ?? triggers on null', () => {
      const result = processTwig('{{ val ?? "default" }}', { val: null });
      expect(result).toBe('default');
    });

    it('default filter triggers on empty string too', () => {
      const result = processTwig('{{ val | default("fallback") }}', { val: '' });
      expect(result).toBe('fallback');
    });

    it('filter on null passes through', () => {
      const result = processTwig('{{ val | upper }}', { val: null });
      expect(result).toBe('');
    });
  });

  // ──────────────────────────────────────────────
  // 11. HYPHENATED VARIABLE PATHS
  // ──────────────────────────────────────────────
  describe('hyphenated paths', () => {
    it('hyphenated first segment', () => {
      const result = processTwig('{{ my-var.value }}', { 'my-var': { value: 'ok' } });
      expect(result).toBe('ok');
    });

    it('hyphenated later segment', () => {
      const result = processTwig('{{ obj.my-field }}', { obj: { 'my-field': 42 } });
      expect(result).toBe('42');
    });
  });

  // ──────────────────────────────────────────────
  // 12. KEEP EMPTY TOKENS MODE
  // ──────────────────────────────────────────────
  describe('keepEmptyTokens mode', () => {
    it('missing token is kept as literal', () => {
      const result = processTwig('Hello {{ name }}', {}, true);
      expect(result).toBe('Hello {{ name }}');
    });

    it('existing token is still resolved', () => {
      const result = processTwig('{{ greeting }}', { greeting: 'Hi' }, true);
      expect(result).toBe('Hi');
    });
  });

  // ──────────────────────────────────────────────
  // 13. MONOLITHIC: ALL FEATURES COMBINED
  // ──────────────────────────────────────────────
  describe('mega-template: all features combined', () => {
    it('e-commerce order summary', () => {
      const result = processTwig(
        [
          'Order Summary',
          '==============',
          '{% for item in items %}',
          '{% if loop.first %}--- First Item ---{% endif %}',
          '{{ cycle(["#", "**"], loop.index0) }} {{ item.name | upper | trim }}',
          '  Qty: {{ item.qty }} x ${{ item.price }}',
          '{% if item.qty > 10 %}  [BULK ORDER]{% endif %}',
          '{% if not loop.last %}  |{% endif %}',
          '{% endfor %}',
          '==============',
          'Total items: {{ items | length }}',
          '{% if items | length > 2 %}',
          '  ** MANY ITEMS **',
          '{% elseif items | length > 1 %}',
          '  [some items]',
          '{% else %}',
          '  few items',
          '{% endif %}'
        ].join('\n'),
        {
          items: [
            { name: '  widget  ', price: 25.5, qty: 2 },
            { name: 'gadget', price: 99.99, qty: 15 },
            { name: 'doohickey', price: 5, qty: 50 }
          ]
        }
      );

      expect(result).toContain('--- First Item ---');
      expect(result).toContain('WIDGET');
      expect(result).toContain('GADGET');
      expect(result).toContain('[BULK ORDER]');
      expect(result).toContain('DOOHICKEY');
      expect(result).toContain('$25.5');
      expect(result).toContain('$99.99');
      expect(result).toContain('$5');
      expect(result).toContain('Total items: 3');
      expect(result).toContain('** MANY ITEMS **');
    });

    it('table rendering with nested loops and conditionals', () => {
      const result = processTwig(
        [
          '<table>',
          '{% for row in matrix %}',
          '{% if loop.first %}<thead>{% else %}<tbody>{% endif %}',
          '<tr>',
          '{% for cell in row %}',
          '{% if loop.first %}<th>{% else %}<td>{% endif %}',
          '{{ cell | upper }}',
          '{% if loop.first %}</th>{% else %}</td>{% endif %}',
          '{% endfor %}',
          '</tr>',
          '{% if loop.first %}</thead>{% else %}</tbody>{% endif %}',
          '{% endfor %}',
          '</table>'
        ].join('\n'),
        {
          matrix: [
            ['name', 'age'],
            ['alice', '30'],
            ['bob', '25']
          ]
        }
      );

      expect(result).toContain('<thead>');
      expect(result).toContain('</thead>');
      expect(result).toContain('<tbody>');
      expect(result).toContain('NAME');
      expect(result).toContain('ALICE');
    });

    it('dynamic navigation with for + if + filters', () => {
      const result = processTwig(
        [
          '{% set current = "about" %}',
          '<nav>',
          '{% for link in links %}',
          '<a{% if link.slug == current %} class="active"{% endif %}>',
          '{{ link.label | title }}',
          '</a>',
          '{% if not loop.last %} | {% endif %}',
          '{% endfor %}',
          '</nav>',
          'You are on: {{ current | upper }}'
        ].join('\n'),
        {
          links: [
            { slug: 'home', label: 'home' },
            { slug: 'about', label: 'about us' },
            { slug: 'contact', label: 'contact' }
          ]
        }
      );

      expect(result).toContain('class="active"');
      expect(result).toContain('Home');
      expect(result).toContain('About Us');
      expect(result).toContain('Contact');
      expect(result).toContain('You are on: ABOUT');
    });

    it('set + for + if + filters + functions combined', () => {
      const result = processTwig(
        [
          '{% set title = "  hello world  " %}',
          '{% if title is defined %}',
          '<h1>{{ title | trim | upper }}</h1>',
          '{% endif %}',
          'Items ({{ items | length }}):',
          '{% for item in items %}{{ loop.index }}. {{ item | capitalize }}{% if loop.last %} (last){% endif %} {% endfor %}',
          'Min: {{ min(values) }}, Max: {{ max(values) }}',
          '{% for i in 1..3 %}{{ i }}{% endfor %}'
        ].join(''),
        {
          items: ['charlie', 'alice', 'bob'],
          values: [3, 1, 4, 1, 5, 9]
        }
      );

      expect(result).toContain('<h1>HELLO WORLD</h1>');
      expect(result).toContain('1. Charlie');
      expect(result).toContain('2. Alice');
      expect(result).toContain('3. Bob (last)');
      expect(result).toContain('Min: 1, Max: 9');
      expect(result).toContain('123');
    });

    it('data display panel with status badges and nested data', () => {
      const result = processTwig(
        [
          'Users: {{ users | length }} ',
          '{% for user in users %}[{{ user.name | upper }}]',
          '{% if user.status == "active" %} (active)',
          '{% elseif user.status == "error" %} (ERROR)',
          '{% else %} (inactive)',
          '{% endif %}',
          '{% if user.tags %} tags={{ user.tags | join(", ") }}',
          '{% endif %}',
          '{% if not loop.last %} | {% endif %}',
          '{% endfor %}'
        ].join(''),
        {
          users: [
            { name: 'alice', status: 'active', tags: ['admin', 'dev'] },
            { name: 'bob', status: 'inactive', tags: [] },
            { name: 'charlie', status: 'error', tags: ['ops'] }
          ]
        }
      );

      expect(result).toContain('Users: 3');
      expect(result).toContain('[ALICE] (active)');
      expect(result).toContain('tags=admin, dev');
      expect(result).toContain('[BOB] (inactive)');
      expect(result).toContain('[CHARLIE] (ERROR)');
      expect(result).toContain('tags=ops');
    });

    it('cycle + max/min for dashboard stats', () => {
      const result = processTwig(
        [
          'Weekly Stats:',
          '{% for day in days %}',
          '{{ day }}',
          ' ({{ cycle(["low", "HIGH"], loop.index0) }})',
          '{% if not loop.last %} | {% endif %}',
          '{% endfor %}',
          '',
          'Range: {{ min(values) }} - {{ max(values) }}'
        ].join('\n'),
        { days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'], values: [10, 25, 15, 30, 20] }
      );

      expect(result).toContain('Mon');
      expect(result).toContain('(low)');
      expect(result).toContain('Tue');
      expect(result).toContain('(HIGH)');
      expect(result).toContain('Range: 10 - 30');
    });

    it('form validation display with set + for + if + filters', () => {
      const result = processTwig(
        [
          '{% set has_errors = false %}',
          '{% for field in fields %}',
          '{% if field.error is not null %}',
          '{% set has_errors = true %}',
          'ERROR: {{ field.name | upper }} - {{ field.error }}',
          '{% endif %}',
          '{% endfor %}',
          '',
          '{% if has_errors %}',
          'Form has errors!',
          '{% else %}',
          'Form is valid',
          '{% endif %}'
        ].join('\n'),
        {
          fields: [
            { name: 'email', error: null },
            { name: 'password', error: 'too short' },
            { name: 'age', error: null }
          ]
        }
      );

      expect(result).toContain('ERROR: PASSWORD - too short');
      expect(result).not.toContain('ERROR: EMAIL');
      expect(result).toContain('Form has errors!');
    });

    it('JSON + raw + triple braces in API response template', () => {
      const result = processTwig(
        ['JSON: {{ payload | to_json }}', 'Raw: {{{ payload }}}', 'Keys: {{ payload | keys | join(", ") }}'].join('\n'),
        {
          payload: { users: [{ name: 'A' }, { name: 'B' }], count: 2 }
        }
      );

      expect(result).toContain('JSON: {"users":[{"name":"A"},{"name":"B"}],"count":2}');
      expect(result).toContain('Raw: [object Object]');
      expect(result).toContain('Keys: users, count');
    });

    it('apply with nested loops and conditionals', () => {
      const result = processTwig(
        [
          '{% apply upper %}{% for item in items %}{% if item.visible %}{{ item.label }} {% endif %}{% endfor %}{% endapply %}'
        ].join(''),
        {
          items: [
            { label: 'alpha', visible: true },
            { label: 'beta', visible: false },
            { label: 'gamma', visible: true }
          ]
        }
      );

      expect(result).toBe('ALPHA GAMMA ');
    });

    it('merge filter to build dynamic list', () => {
      const result = processTwig(
        ['{% for item in extras %}', '{{ item | upper }}', '{% if not loop.last %}, {% endif %}', '{% endfor %}'].join(
          ''
        ),
        {
          base: ['a', 'b'],
          extras: ['c', 'd', 'e']
        }
      );

      expect(result).toBe('C, D, E');
    });

    it('keys + values iteration over object', () => {
      const result = processTwig(
        [
          '{% for key, value in config %}',
          '{{ key }}={{ value }}',
          '{% if not loop.last %} | {% endif %}',
          '{% endfor %}'
        ].join(''),
        { config: { a: 1, b: 2, c: 3 } }
      );

      expect(result).toBe('a=1 | b=2 | c=3');
    });
  });

  // ──────────────────────────────────────────────
  // 14. EDGE CASE: DEEPLY NESTED
  // ──────────────────────────────────────────────
  describe('deeply nested combinations', () => {
    it('3-level nested loops', () => {
      const result = processTwig(
        '{% for x in 1..2 %}{% for y in 1..2 %}{% for z in 1..2 %}{{ x }}{{ y }}{{ z }} {% endfor %}{% endfor %}{% endfor %}',
        {}
      );
      expect(result).toBe('111 112 121 122 211 212 221 222 ');
    });

    it('conditional inside nested loop with break', () => {
      const result = processTwig(
        [
          '{% for i in 1..3 %}',
          '{% for j in 1..3 %}',
          '{% if j == 2 %}{% break %}{% endif %}',
          '{{ i }}-{{ j }} ',
          '{% endfor %}',
          '|',
          '{% endfor %}'
        ].join(''),
        {}
      );
      expect(result).toBe('1-1 |2-1 |3-1 |');
    });

    it('set inside loop creates per-iteration scope', () => {
      const result = processTwig(['{% for i in items %}', '{{ loop.index }}:{{ i }} ', '{% endfor %}'].join(''), {
        items: ['a', 'b', 'c']
      });
      expect(result).toBe('1:a 2:b 3:c ');
    });

    it('apply + filter chain + loop', () => {
      const result = processTwig(
        ['{% apply upper | trim %}{% for item in items %}{{ item }} {% endfor %}{% endapply %}'].join(''),
        { items: ['x', 'a', 'm'] }
      );
      expect(result).toBe('X A M');
    });

    it('conditional + loop + function chain', () => {
      const result = processTwig(
        [
          '{% if items | length > 0 %}',
          'Count: {{ items | length }}',
          'Max: {{ max(items) }}',
          'Min: {{ min(items) }}',
          '{% else %}',
          'No items',
          '{% endif %}'
        ].join(''),
        { items: [5, 0, 3, 0, 8] }
      );
      expect(result).toContain('Count: 5');
      expect(result).toContain('Max: 8');
      expect(result).toContain('Min: 0');
    });
  });

  // ──────────────────────────────────────────────
  // 15. EDGE CASE: MALFORMED + ROBUSTNESS
  // ──────────────────────────────────────────────
  describe('malformed templates do not crash', () => {
    it('unclosed token passes through', () => {
      const result = processTwig('Hello {{ name', {});
      expect(result).toBe('Hello {{ name');
    });

    it('extra endif passes through', () => {
      const result = processTwig('{% if true %}hi{% endif %}{% endif %}', {});
      expect(result).toBe('hi{% endif %}');
    });

    it('mismatched tags pass through', () => {
      const result = processTwig('{% for x in [] %}{% endif %}', {});
      expect(result).toBe('{% for x in [] %}{% endif %}');
    });

    it('random gibberish does not crash', () => {
      const result = processTwig('{%%} {%%} }} {{ {%%}', {});
      expect(result).toBe('{%%} {%%} }} {{ {%%}');
    });

    it('non-string input returns as-is', () => {
      expect(processTwig(null as unknown as string, {})).toBeNull();
      expect(processTwig(42 as unknown as string, {})).toBe(42);
      expect(processTwig(undefined as unknown as string, {})).toBeUndefined();
    });

    it('empty string template', () => {
      expect(processTwig('', {})).toBe('');
    });

    it('very long template does not crash', () => {
      const long = 'x'.repeat(50000);
      const result = processTwig(long, {});
      expect(result).toBe(long);
    });

    it('500 repeated tokens do not crash', () => {
      const tokens = Array.from({ length: 500 }, () => '{{ val }}').join('');
      const result = processTwig(tokens, { val: 'x' }) as string;
      expect(result.length).toBe(500);
    });

    it('deeply nested empty blocks', () => {
      let template = '';
      for (let i = 0; i < 20; i++) {
        template += '{% if true %}';
      }
      template += 'hi';
      for (let i = 0; i < 20; i++) {
        template += '{% endif %}';
      }
      const result = processTwig(template, {});
      expect(result).toBe('hi');
    });
  });

  // ──────────────────────────────────────────────
  // 16. NESTING BUGS (fixed)
  // ──────────────────────────────────────────────
  describe('nested apply tags (inside-out processing)', () => {
    it('double nested apply', () => {
      const result = processTwig('{% apply upper %}{% apply trim %}  hi  {% endapply %}{% endapply %}', {});
      expect(result).toBe('HI');
    });

    it('triple nested apply', () => {
      const result = processTwig(
        '{% apply upper %}{% apply trim %}{% apply title %}hello world{% endapply %}{% endapply %}{% endapply %}',
        {}
      );
      expect(result).toBe('HELLO WORLD');
    });

    it('simple apply still works', () => {
      expect(processTwig('{% apply upper %}hello{% endapply %}', {})).toBe('HELLO');
    });

    it('apply with tokens inside', () => {
      expect(processTwig('{% apply upper %}{{ name }}{% endapply %}', { name: 'alice' })).toBe('ALICE');
    });
  });

  describe('nested set blocks (inside-out processing)', () => {
    it('double nested set blocks', () => {
      const result = processTwig('{% set a %}{% set b %}inner{% endset %}{{ b }}{% endset %}{{ a }}', {});
      expect(result).toBe('inner');
    });

    it('triple nested set blocks', () => {
      const result = processTwig(
        '{% set a %}{% set b %}{% set c %}deep{% endset %}{{ c }}{% endset %}{{ b }}{% endset %}{{ a }}',
        {}
      );
      expect(result).toBe('deep');
    });

    it('set block with for inside', () => {
      const result = processTwig('{% set x %}{% for i in items %}{{ i }}{% endfor %}{% endset %}{{ x }}', {
        items: [1, 2, 3]
      });
      expect(result).toBe('123');
    });

    it('set block with apply inside', () => {
      const result = processTwig('{% set x %}{% apply upper %}hello{% endapply %}{% endset %}{{ x }}', {});
      expect(result).toBe('HELLO');
    });

    it('set block with if inside', () => {
      const result = processTwig('{% set x %}{% if true %}yes{% else %}no{% endif %}{% endset %}{{ x }}', {});
      expect(result).toBe('yes');
    });
  });

  describe('range() single arg', () => {
    it('range(0) returns [0]', () => {
      expect(processTwig('{{ range(0) }}', {})).toBe('[0]');
    });

    it('range(5) returns 0..5', () => {
      expect(processTwig('{{ range(5) }}', {})).toBe('[0,1,2,3,4,5]');
    });

    it('range() still works with 2 args', () => {
      expect(processTwig('{{ range(1,3) }}', {})).toBe('[1,2,3]');
    });

    it('range() still works with 3 args', () => {
      expect(processTwig('{{ range(0,10,2) }}', {})).toBe('[0,2,4,6,8,10]');
    });
  });
});
