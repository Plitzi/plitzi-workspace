/* eslint-disable quotes */
import { expect, describe, it } from 'vitest';

import { processTwig } from './index';

// Tests for behaviours the contract suite did not cover, plus regressions fixed during the refactor:
// per-loop metadata isolation, the `in` operator, filter arguments as full expressions, and the
// filters/edge cases that previously had no coverage.

describe('processTwig — nested loop metadata isolation', () => {
  it('restores the outer loop counters after an inner loop finishes', () => {
    // Regression: a single shared loop object made the outer loop.index report the inner loop's last value.
    expect(
      processTwig(
        '{% for a in outer %}[{{ loop.index }}:{% for b in inner %}{{ b }}{% endfor %}={{ loop.index }}]{% endfor %}',
        {
          outer: ['x', 'y'],
          inner: [1, 2, 3]
        }
      )
    ).toBe('[1:123=1][2:123=2]');
  });

  it('keeps loop.first/last correct on the outer loop across a nested loop', () => {
    expect(
      processTwig(
        '{% for a in outer %}{% for b in inner %}{{ b }}{% endfor %}{% if loop.last %}!{% endif %}{% endfor %}',
        {
          outer: [1, 2],
          inner: ['a', 'b']
        }
      )
    ).toBe('abab!');
  });

  it('exposes the inner loop metadata while inside the inner loop', () => {
    expect(
      processTwig('{% for a in outer %}{% for b in inner %}{{ loop.index }}{% endfor %}{% endfor %}', {
        outer: [1, 2],
        inner: ['a', 'b', 'c']
      })
    ).toBe('123123');
  });
});

describe('processTwig — `in` membership operator', () => {
  it('resolves array membership', () => {
    expect(processTwig('{% if "b" in items %}yes{% else %}no{% endif %}', { items: ['a', 'b', 'c'] })).toBe('yes');
    expect(processTwig('{% if "z" in items %}yes{% else %}no{% endif %}', { items: ['a', 'b', 'c'] })).toBe('no');
  });

  it('resolves object-key membership', () => {
    expect(processTwig('{% if "k" in obj %}yes{% else %}no{% endif %}', { obj: { k: 1 } })).toBe('yes');
    expect(processTwig('{% if "x" in obj %}yes{% else %}no{% endif %}', { obj: { k: 1 } })).toBe('no');
  });

  it('resolves substring membership on strings', () => {
    expect(processTwig('{% if "ell" in word %}yes{% endif %}', { word: 'hello' })).toBe('yes');
  });

  it('combines `in` with `and`', () => {
    expect(processTwig('{% if "b" in items and active %}yes{% endif %}', { items: ['a', 'b'], active: true })).toBe(
      'yes'
    );
  });
});

describe('processTwig — filter arguments as expressions', () => {
  it('evaluates a variable argument', () => {
    expect(processTwig('{{ name | slice(0, n) }}', { name: 'hello', n: 3 })).toBe('hel');
  });

  it('evaluates an arithmetic argument', () => {
    expect(processTwig('{{ name | slice(0, a + b) }}', { name: 'hello', a: 1, b: 2 })).toBe('hel');
  });

  it('evaluates a variable default argument', () => {
    expect(processTwig('{{ missing | default(fallback) }}', { fallback: 'from-var' })).toBe('from-var');
  });

  it('applies a filter to a parenthesized concat subject', () => {
    expect(processTwig('{{ (a ~ b) | upper }}', { a: 'hello', b: 'world' })).toBe('HELLOWORLD');
  });

  it('applies a filter chain to a function-call subject', () => {
    expect(processTwig('{{ max(a, b) | abs }}', { a: -5, b: -9 })).toBe('5');
  });

  it('passes a quoted comma inside a string argument intact', () => {
    expect(processTwig('{{ items | join(", ") }}', { items: ['a', 'b'] })).toBe('a, b');
  });
});

describe('processTwig — previously uncovered filters', () => {
  it('camelize', () => {
    expect(processTwig('{{ v | camelize }}', { v: 'foo_bar-baz' })).toBe('fooBarBaz');
  });

  it('kebab and snake', () => {
    expect(processTwig('{{ v | kebab }}', { v: 'fooBar baz' })).toBe('foo-bar-baz');
    expect(processTwig('{{ v | snake }}', { v: 'fooBar baz' })).toBe('foo_bar_baz');
  });

  it('number_format with thousands separator', () => {
    expect(processTwig("{{ v | number_format(2, '.', ',') }}", { v: 1234567.891 })).toBe('1,234,567.89');
  });

  it('round with ceil and floor modes', () => {
    expect(processTwig("{{ v | round(0, 'ceil') }}", { v: 3.1 })).toBe('4');
    expect(processTwig("{{ v | round(0, 'floor') }}", { v: 3.9 })).toBe('3');
  });

  it('striptags keeping allowed tags', () => {
    expect(processTwig("{{ v | striptags('<b>') }}", { v: '<b>hi</b> <i>there</i>' })).toBe('<b>hi</b> there');
  });

  it('url_encode on an object produces a query string', () => {
    expect(processTwig('{{ v | url_encode }}', { v: { a: '1', b: 'x y' } })).toBe('a=1&b=x+y');
  });

  it('format with %f and %% placeholders', () => {
    expect(processTwig('{{ tpl | format(3.5) }}', { tpl: '%f%% done' })).toBe('3.5% done');
  });

  it('to_json / json_encode / object_as_json', () => {
    expect(processTwig('{{ o | json_encode }}', { o: { a: 1 } })).toBe('{"a":1}');
    expect(processTwig('{{ n | object_as_json }}', { n: 42 })).toBe('42');
  });

  it('unknown filter is skipped, not thrown', () => {
    expect(() => processTwig('{{ name | no_such_filter }}', { name: 'x' })).not.toThrow();
    expect(processTwig('{{ name | no_such_filter }}', { name: 'x' })).toBe('x');
  });
});

describe('processTwig — apply tag argument parsing', () => {
  it('apply with a filter that takes an argument', () => {
    expect(processTwig('{% apply replace("a", "o") %}banana{% endapply %}', {})).toBe('bonono');
  });

  it('apply chain mixing arg and no-arg filters', () => {
    expect(processTwig('{% apply trim | upper | slice(0, 3) %}  hello  {% endapply %}', {})).toBe('HEL');
  });
});
