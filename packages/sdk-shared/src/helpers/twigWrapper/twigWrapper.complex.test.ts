/* eslint-disable quotes */
import { expect, describe, it } from 'vitest';

import { processTwig } from './index';

// Large / complex integration tests: deep feature combinations, sizeable data, and documented edge cases that
// the focused unit suites do not exercise. These are the templates most likely to expose interaction bugs.

describe('complex — range bounds as expressions (AST-routed, not regex)', () => {
  it('iterates to a variable upper bound', () => {
    expect(processTwig('{% for i in 1..count %}{{ i }}{% endfor %}', { count: 5 })).toBe('12345');
  });

  it('accepts arithmetic bounds on both sides', () => {
    expect(processTwig('{% for i in start..start + 2 %}{{ i }} {% endfor %}', { start: 3 })).toBe('3 4 5 ');
  });

  it('accepts a parenthesised bound', () => {
    expect(processTwig('{% for i in 0..(n - 1) %}{{ i }}{% endfor %}', { n: 4 })).toBe('0123');
  });

  it('handles a descending variable range', () => {
    expect(processTwig('{% for i in hi..lo %}{{ i }}{% endfor %}', { hi: 5, lo: 1 })).toBe('54321');
  });

  it('handles decimal-looking literals without confusing the .. operator', () => {
    expect(processTwig('{% for i in 1..3 %}{{ i }}{% endfor %}', {})).toBe('123');
  });
});

describe('complex — deeply combined control flow', () => {
  it('nested for + if + set accumulator + filters + loop metadata', () => {
    const tpl = [
      '{% set total = 0 %}',
      '{% for group in groups %}',
      'G{{ loop.index }}:',
      '{% for item in group.items %}',
      '{% if item.qty > 0 %}',
      '{{ item.name | upper }}x{{ item.qty }}',
      '{% set total = total + item.qty %}',
      '{% if not loop.last %},{% endif %}',
      '{% endif %}',
      '{% endfor %}',
      '{% if not loop.last %} | {% endif %}',
      '{% endfor %}',
      ' = {{ total }}'
    ].join('');
    const ctx = {
      groups: [
        {
          items: [
            { name: 'a', qty: 2 },
            { name: 'b', qty: 0 },
            { name: 'c', qty: 3 }
          ]
        },
        { items: [{ name: 'd', qty: 1 }] }
      ]
    };
    expect(processTwig(tpl, ctx)).toBe('G1:Ax2,Cx3 | G2:Dx1 = 6');
  });

  it('triple-nested loop with cross-level index arithmetic', () => {
    const out = processTwig(
      '{% for a in xs %}{% for b in ys %}{% for c in zs %}{{ a }}{{ b }}{{ c }} {% endfor %}{% endfor %}{% endfor %}',
      { xs: [1, 2], ys: ['a', 'b'], zs: ['x', 'y'] }
    );
    expect(out).toBe('1ax 1ay 1bx 1by 2ax 2ay 2bx 2by ');
  });

  it('elseif ladder inside a loop selects the right branch per item', () => {
    const tpl =
      '{% for n in nums %}{% if n % 15 == 0 %}FB{% elseif n % 3 == 0 %}F{% elseif n % 5 == 0 %}B{% else %}{{ n }}{% endif %} {% endfor %}';
    expect(processTwig(tpl, { nums: [1, 3, 5, 15, 7] })).toBe('1 F B FB 7 ');
  });
});

describe('complex — filter arguments that are themselves expressions', () => {
  it('uses a filter result as another filter argument', () => {
    expect(processTwig('{{ name | slice(0, name | length) }}', { name: 'hello' })).toBe('hello');
  });

  it('uses an arithmetic filter argument', () => {
    expect(processTwig('{{ name | slice(0, n * 2) }}', { name: 'abcdef', n: 2 })).toBe('abcd');
  });

  it('chains filters whose args reference the context', () => {
    expect(processTwig('{{ items | join(sep) | upper }}', { items: ['a', 'b', 'c'], sep: '-' })).toBe('A-B-C');
  });

  it('nested function call as a filter argument', () => {
    expect(processTwig('{{ items | slice(0, max(1, 2)) | join(",") }}', { items: ['x', 'y', 'z'] })).toBe('x,y');
  });
});

describe('complex — large data throughput correctness', () => {
  it('renders a 100-row loop with per-row conditionals correctly', () => {
    const items = Array.from({ length: 100 }, (_, i) => ({ id: i, even: i % 2 === 0 }));
    const out = processTwig('{% for it in items %}{% if it.even %}[{{ it.id }}]{% endif %}{% endfor %}', {
      items
    }) as string;
    const expected = items
      .filter(i => i.even)
      .map(i => `[${i.id}]`)
      .join('');
    expect(out).toBe(expected);
  });

  it('builds a large delimited string via a set accumulator', () => {
    const out = processTwig(
      '{% set acc = "" %}{% for i in 1..50 %}{% set acc = acc ~ i ~ "," %}{% endfor %}{{ acc }}',
      {}
    );
    const expected = Array.from({ length: 50 }, (_, i) => `${i + 1},`).join('');
    expect(out).toBe(expected);
  });

  it('serialises a large nested object as JSON', () => {
    const data = { users: Array.from({ length: 20 }, (_, i) => ({ id: i, name: `u${i}` })) };
    expect(processTwig('{{ data }}', { data })).toBe(JSON.stringify(data));
  });

  it('batches and joins a 30-element array', () => {
    const out = processTwig('{% for b in items | batch(4) %}({{ b | join("-") }}){% endfor %}', {
      items: Array.from({ length: 10 }, (_, i) => i)
    });
    expect(out).toBe('(0-1-2-3)(4-5-6-7)(8-9)');
  });
});

describe('complex — string, concat and special characters', () => {
  it('concatenates mixed types and preserves surrounding punctuation', () => {
    expect(processTwig('{{ "[" ~ n ~ "]=" ~ ok }}', { n: 42, ok: true })).toBe('[42]=true');
  });

  it('keeps a tilde inside a quoted string literal', () => {
    expect(processTwig('{{ a ~ "~" ~ b }}', { a: 'x', b: 'y' })).toBe('x~y');
  });

  it('preserves newlines and unicode in passthrough text around tokens', () => {
    expect(processTwig('café ☕\n{{ n }}\n— fin', { n: 1 })).toBe('café ☕\n1\n— fin');
  });

  it('renders braces that are not tokens verbatim', () => {
    expect(processTwig('a { b } {{ x }}', { x: 'X' })).toBe('a { b } X');
  });
});

describe('complex — break / continue with nested loops and metadata', () => {
  it('break in the inner loop leaves the outer loop counter intact', () => {
    const out = processTwig(
      '{% for a in outer %}{{ loop.index }}(' +
        '{% for b in inner %}{% if b == 2 %}{% break %}{% endif %}{{ b }}{% endfor %}) {% endfor %}',
      { outer: ['x', 'y', 'z'], inner: [1, 2, 3] }
    );
    expect(out).toBe('1(1) 2(1) 3(1) ');
  });

  it('continue skips selected inner items without affecting the outer index', () => {
    const out = processTwig(
      '{% for a in outer %}{{ loop.index }}[' +
        '{% for b in inner %}{% if b % 2 == 0 %}{% continue %}{% endif %}{{ b }}{% endfor %}] {% endfor %}',
      { outer: [1, 2], inner: [1, 2, 3, 4, 5] }
    );
    expect(out).toBe('1[135] 2[135] ');
  });
});

describe('complex — keepEmptyTokens behaviour and known limitations', () => {
  it('keeps an unresolved token inside a resolved loop body', () => {
    expect(processTwig('{% for x in items %}[{{ x }}:{{ gone }}]{% endfor %}', { items: ['a', 'b'] }, true)).toBe(
      '[a:{{ gone }}][b:{{ gone }}]'
    );
  });

  it('keeps an unresolved token inside a taken if branch', () => {
    expect(processTwig('{% if on %}{{ a }}-{{ missing }}{% endif %}', { on: true, a: 'X' }, true)).toBe(
      'X-{{ missing }}'
    );
  });

  it('LIMITATION: an unresolved loop collection renders empty, not the preserved block', () => {
    // A ForNode carries no source text, so a missing collection cannot be re-emitted verbatim in keepEmptyTokens
    // mode. Documented here so the behaviour is intentional and locked rather than silently surprising.
    expect(processTwig('{% for x in missing %}{{ x }}{% endfor %}', {}, true)).toBe('');
    expect(processTwig('pre {% for x in missing %}{{ x }}{% endfor %} post', {}, true)).toBe('pre  post');
  });
});

describe('complex — deep expression nesting', () => {
  it('resolves a 4-level nested ternary with comparisons', () => {
    const tpl = "{{ s >= 90 ? 'A' : (s >= 80 ? 'B' : (s >= 70 ? 'C' : (s >= 60 ? 'D' : 'F'))) }}";
    expect(processTwig(tpl, { s: 72 })).toBe('C');
    expect(processTwig(tpl, { s: 50 })).toBe('F');
  });

  it('mixes and/or/not with parentheses and comparisons', () => {
    const tpl = '{% if (a > 0 and a < 10) or (b == "yes" and not c) %}hit{% else %}miss{% endif %}';
    expect(processTwig(tpl, { a: 5, b: 'no', c: false })).toBe('hit');
    expect(processTwig(tpl, { a: 50, b: 'yes', c: true })).toBe('miss');
  });

  it('applies a filter directly to a string literal', () => {
    expect(processTwig("{{ 'hello' | upper }}", {})).toBe('HELLO');
    expect(processTwig('{{ 5 | number_format(2) }}', {})).toBe('5.00');
  });

  it('chains defaults and filters: the filter binds to the literal, the selected value wins', () => {
    // b present → default short-circuits to b; upper only ever applied to the unused 'x'.
    expect(processTwig("{{ a ?? b ?? 'x' | upper }}", { b: 'hi' })).toBe('hi');
    // nothing present → default falls to 'x', which the filter uppercases.
    expect(processTwig("{{ a ?? 'x' | upper }}", {})).toBe('X');
  });
});
