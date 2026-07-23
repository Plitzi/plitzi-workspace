import { expect, describe, it } from 'vitest';

import { processTwig } from '../index';

// Multi-line templates: Twig treats line breaks inside `{{ … }}` and `{% … %}` as insignificant whitespace,
// so an expression (an arrow body, a filter chain, an argument list) may be spread across several lines.
// Twig arrow functions are expression-only — there is no JavaScript-style `{ … }` block body; a `{ … }` in an
// arrow is always a hash literal (see the object-literal tests).

describe('multi-line — arrow bodies', () => {
  it('breaks after the => arrow', () => {
    const tmpl = '{{ items | map(item =>\n  item.name\n) | join(", ") }}';
    expect(processTwig(tmpl, { items: [{ name: 'A' }, { name: 'B' }] })).toBe('A, B');
  });

  it('breaks around a ternary body', () => {
    const tmpl = '{{ items | map(x =>\n  x > 2\n    ? "big"\n    : "small"\n) | join(",") }}';
    expect(processTwig(tmpl, { items: [1, 2, 3] })).toBe('small,small,big');
  });

  it('breaks inside the argument list', () => {
    const tmpl = '{{ items | map(\n  item => item.v\n) | join(",") }}';
    expect(processTwig(tmpl, { items: [{ v: 1 }, { v: 2 }] })).toBe('1,2');
  });

  it('breaks a reduce across arguments', () => {
    const tmpl = '{{ items | reduce(\n  (acc, x) => acc + x,\n  0\n) }}';
    expect(processTwig(tmpl, { items: [1, 2, 3, 4] })).toBe('10');
  });

  it('returns a hash from a multi-line arrow body', () => {
    const tmpl = '{{ items | map(i => {\n  name: i.n,\n  val: i.v\n}) | map(o => o.name) | join(",") }}';
    expect(
      processTwig(tmpl, {
        items: [
          { n: 'a', v: 1 },
          { n: 'b', v: 2 }
        ]
      })
    ).toBe('a,b');
  });
});

describe('multi-line — filter chains', () => {
  it('breaks before each pipe', () => {
    const tmpl = '{{ items\n  | map(x => x * 2)\n  | join(", ")\n}}';
    expect(processTwig(tmpl, { items: [1, 2, 3] })).toBe('2, 4, 6');
  });

  it('handles Windows CRLF line endings', () => {
    const tmpl = '{{ items\r\n  | map(x => x + 1)\r\n  | join(",") }}';
    expect(processTwig(tmpl, { items: [1, 2] })).toBe('2,3');
  });
});

describe('multi-line — control flow', () => {
  it('breaks inside an {% if %} condition', () => {
    const tmpl = '{% if\n  x > 5\n%}big{% else %}small{% endif %}';
    expect(processTwig(tmpl, { x: 10 })).toBe('big');
  });

  it('breaks a {% for %} across the in keyword', () => {
    const tmpl = '{% for n in\n  items\n%}{{ n }}{% endfor %}';
    expect(processTwig(tmpl, { items: [1, 2, 3] })).toBe('123');
  });

  it('breaks a {% for key, value in %} across lines', () => {
    const tmpl = '{% for k, v in\n  obj %}{{ k }}={{ v }};{% endfor %}';
    expect(processTwig(tmpl, { obj: { a: 1, b: 2 } })).toBe('a=1;b=2;');
  });

  it('does not mistake an "in" inside a loop variable name for the keyword', () => {
    expect(processTwig('{% for index in items %}{{ index }}{% endfor %}', { items: [7, 8] })).toBe('78');
  });

  it('breaks a multi-line {% set %} expression', () => {
    const tmpl = '{% set total =\n  a + b + c\n %}{{ total }}';
    expect(processTwig(tmpl, { a: 1, b: 2, c: 3 })).toBe('6');
  });
});
