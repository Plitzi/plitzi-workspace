/* eslint-disable quotes */
import { expect, describe, it } from 'vitest';

import { processTwig, hasValidToken } from '../..';

describe('triple braces {{{ variable }}}', () => {
  it('renders object as toString (raw)', () => {
    expect(processTwig('{{{ o }}}', { o: { a: 1 } })).toBe('[object Object]');
  });

  it('renders array as toString (comma-separated)', () => {
    expect(processTwig('{{{ items }}}', { items: [1, 2, 3] })).toBe('1,2,3');
  });

  it('renders primitive same as double braces', () => {
    expect(processTwig('{{{ name }}}', { name: 'Peter' })).toBe('Peter');
    expect(processTwig('{{{ count }}}', { count: 42 })).toBe('42');
    expect(processTwig('{{{ flag }}}', { flag: true })).toBe('true');
    expect(processTwig('{{{ nothing }}}', { nothing: null })).toBe('');
  });

  it('renders undefined/null as empty', () => {
    expect(processTwig('{{{ missing }}}', {})).toBe('');
    expect(processTwig('{{{ val }}}', { val: null })).toBe('');
  });

  it('supports nested paths', () => {
    const result = processTwig('{{{ user.profile.name }}}', {
      user: { profile: { name: 'Alice' } }
    });
    expect(result).toBe('Alice');
  });

  it('supports nested path to object — raw toString', () => {
    const result = processTwig('{{{ user.profile }}}', {
      user: { profile: { name: 'Alice' } }
    });
    expect(result).toBe('[object Object]');
  });

  it('supports default expression', () => {
    expect(processTwig('{{{ name ?? "Guest" }}}', {})).toBe('Guest');
    expect(processTwig('{{{ name ?? "Guest" }}}', { name: 'Bob' })).toBe('Bob');
  });

  it('supports filters', () => {
    expect(processTwig('{{{ name | upper }}}', { name: 'alice' })).toBe('ALICE');
    expect(processTwig('{{{ name | default("N/A") }}}', {})).toBe('N/A');
  });

  it('supports whitespace flexibility', () => {
    expect(processTwig('{{{name}}}', { name: 'X' })).toBe('X');
    expect(processTwig('{{{  name  }}}', { name: 'X' })).toBe('X');
    expect(processTwig('{{{ name }}}', { name: 'X' })).toBe('X');
  });

  it('mixed with double braces — different rendering for same object', () => {
    const result = processTwig('JSON: {{ data }} RAW: {{{ data }}}', {
      data: { key: 'value' }
    });
    expect(result).toBe('JSON: {"key":"value"} RAW: [object Object]');
  });

  it('inside a loop', () => {
    const result = processTwig('{% for item in items %}{{{ item }}}|{% endfor %}', {
      items: [{ a: 1 }, { b: 2 }]
    });
    expect(result).toBe('[object Object]|[object Object]|');
  });

  it('inside a conditional', () => {
    const result = processTwig('{% if show %}{{{ data }}}{% endif %}', {
      show: true,
      data: { x: 1 }
    });
    expect(result).toBe('[object Object]');
  });

  it('left untouched when malformed', () => {
    expect(processTwig('{{{}}}', {})).toBe('{{{}}}');
    expect(processTwig('{{{ }}}', {})).toBe('{{{ }}}');
    expect(processTwig('{{{ var1', {})).toBe('{{{ var1');
  });

  it('does not interfere with adjacent double braces', () => {
    const result = processTwig('{{{ a }}} and {{ b }}', { a: { x: 1 }, b: 'hello' });
    expect(result).toBe('[object Object] and hello');
  });

  it('multiple triple-brace tokens', () => {
    const result = processTwig('{{{ a }}}-{{{ b }}}', { a: { x: 1 }, b: [1, 2] });
    expect(result).toBe('[object Object]-1,2');
  });

  it('triple braces with keepEmptyTokens — unresolved token kept', () => {
    const result = processTwig('Hello {{{ name }}}', {}, true);
    expect(result).toBe('Hello {{{ name }}}');
  });

  it('cycle function still works inside triple braces context', () => {
    const result = processTwig('{% for i in 0..2 %}{{ cycle(["X", "Y"], i) }}{% endfor %}', {});
    expect(result).toBe('XYX');
  });

  it('token before and after triple braces resolves', () => {
    const result = processTwig('{{ prefix }}{{{ obj }}}{{ suffix }}', {
      prefix: '>>',
      obj: { a: 1 },
      suffix: '<<'
    });
    expect(result).toBe('>>[object Object]<<');
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

describe('hasValidToken - triple braces non-strict', () => {
  it('should detect simple triple-brace token', () => {
    expect(hasValidToken('{{{ token }}}')).toBe(true);
  });

  it('should detect triple-brace token without spaces', () => {
    expect(hasValidToken('{{{token}}}')).toBe(true);
  });

  it('should detect triple-brace token with irregular spacing', () => {
    expect(hasValidToken('{{{   token   }}}')).toBe(true);
    expect(hasValidToken('{{{\ttoken\t}}}')).toBe(true);
    expect(hasValidToken('{{{\ntoken\n}}}')).toBe(true);
  });

  it('should detect triple-brace token with nested path', () => {
    expect(hasValidToken('{{{ a.b.c }}}')).toBe(true);
    expect(hasValidToken('{{{a.b.c}}}')).toBe(true);
  });

  it('should detect triple-brace token with default expression', () => {
    expect(hasValidToken("{{{ token ?? 'fallback' }}}")).toBe(true);
    expect(hasValidToken('{{{ token ?? 0 }}}')).toBe(true);
  });

  it('should detect triple-brace token with filter chain', () => {
    expect(hasValidToken('{{{ token | upper }}}')).toBe(true);
    expect(hasValidToken('{{{ token | upper | truncate(10) }}}')).toBe(true);
  });

  it('should detect triple-brace token with hyphenated path', () => {
    expect(hasValidToken('{{{ my-var.item }}}')).toBe(true);
  });

  it('should detect triple-brace token inside surrounding text', () => {
    expect(hasValidToken('Hello {{{ name }}, welcome!')).toBe(true);
    expect(hasValidToken('prefix {{{ x }}} suffix')).toBe(true);
  });

  it('should detect multiple triple-brace tokens', () => {
    expect(hasValidToken('{{{ a }}} and {{{ b }}}')).toBe(true);
  });

  it('should detect mixed double and triple-brace tokens', () => {
    expect(hasValidToken('{{ a }} {{{ b }}}')).toBe(true);
  });

  it('should reject numeric path in triple braces', () => {
    expect(hasValidToken('{{{123}}}')).toBe(false);
    expect(hasValidToken('{{{ 123 }}}')).toBe(false);
  });

  it('should reject empty triple braces', () => {
    expect(hasValidToken('{{{}}}')).toBe(false);
    expect(hasValidToken('{{{  }}}')).toBe(false);
  });

  it('should reject path starting with number in triple braces', () => {
    expect(hasValidToken('{{{1a}}}')).toBe(false);
    expect(hasValidToken('{{{ 1a }}}')).toBe(false);
  });
});

describe('hasValidToken - triple braces strict', () => {
  it('should accept a whole-string triple-brace token', () => {
    expect(hasValidToken('{{{ token }}}', true)).toBe(true);
    expect(hasValidToken('{{{token}}}', true)).toBe(true);
  });

  it('should accept triple-brace token with nested path', () => {
    expect(hasValidToken('{{{ a.b.c }}}', true)).toBe(true);
  });

  it('should accept triple-brace token with default', () => {
    expect(hasValidToken("{{{ token ?? 'def' }}}", true)).toBe(true);
  });

  it('should accept triple-brace token with filter', () => {
    expect(hasValidToken('{{{ token | upper }}}', true)).toBe(true);
  });

  it('should reject triple-brace token inside surrounding text', () => {
    expect(hasValidToken('text {{{ token }}} text', true)).toBe(false);
    expect(hasValidToken('prefix {{{ token }}}', true)).toBe(false);
    expect(hasValidToken('{{{ token }}} suffix', true)).toBe(false);
  });

  it('should reject numeric path in triple braces strict', () => {
    expect(hasValidToken('{{{123}}}', true)).toBe(false);
    expect(hasValidToken('{{{ 123 }}}', true)).toBe(false);
  });

  it('should reject empty triple braces strict', () => {
    expect(hasValidToken('{{{}}}', true)).toBe(false);
    expect(hasValidToken('{{{  }}}', true)).toBe(false);
  });
});

describe('hasValidToken - malformed tokens', () => {
  const malformedTokens = [
    // Double braces
    '{{}}',
    '{{ }}',
    '{{ var',
    '{{ var }',
    '{ var }}',
    '{{ var. }}',
    '{{ .var }}',
    '{{ var 1 }}',
    '{{ var | }}',
    // Triple braces
    '{{{}}}',
    '{{{ }}}',
    '{{{ var',
    '{{{ var }',
    '{ var }}}',
    '{{{ var. }}}',
    '{{{ .var }}}',
    '{{{ var 1 }}}',
    '{{{ var | }}}'
  ];

  it.each(malformedTokens)('rejects %j in non-strict mode', template => {
    expect(hasValidToken(template)).toBe(false);
  });

  it.each(malformedTokens)('rejects %j in strict mode', template => {
    expect(hasValidToken(template, true)).toBe(false);
  });
});

describe('Twig functions', () => {
  describe('cycle()', () => {
    it('cycles through array values', () => {
      expect(processTwig('{{ cycle(["odd", "even"], index) }}', { index: 0 })).toBe('odd');
      expect(processTwig('{{ cycle(["odd", "even"], index) }}', { index: 1 })).toBe('even');
      expect(processTwig('{{ cycle(["odd", "even"], index) }}', { index: 2 })).toBe('odd');
    });

    it('handles single-element array', () => {
      expect(processTwig('{{ cycle(["only"], 0) }}', {})).toBe('only');
      expect(processTwig('{{ cycle(["only"], 5) }}', {})).toBe('only');
    });

    it('handles empty array', () => {
      expect(processTwig('{{ cycle([], 0) }}', {})).toBe('');
    });
  });

  describe('max()', () => {
    it('returns max of numbers', () => {
      expect(processTwig('{{ max(1, 2, 3) }}', {})).toBe('3');
      expect(processTwig('{{ max(10, 5, 8) }}', {})).toBe('10');
    });

    it('returns max of two arguments', () => {
      expect(processTwig('{{ max(a, b) }}', { a: 5, b: 10 })).toBe('10');
    });

    it('returns max of variables and literals', () => {
      expect(processTwig('{{ max(a, 20) }}', { a: 5 })).toBe('20');
    });

    it('returns max of single argument', () => {
      expect(processTwig('{{ max(42) }}', {})).toBe('42');
    });

    it('returns empty for no arguments', () => {
      expect(processTwig('{{ max() }}', {})).toBe('{{ max() }}');
    });
  });

  describe('min()', () => {
    it('returns min of numbers', () => {
      expect(processTwig('{{ min(1, 2, 3) }}', {})).toBe('1');
      expect(processTwig('{{ min(10, 5, 8) }}', {})).toBe('5');
    });

    it('returns min of two arguments', () => {
      expect(processTwig('{{ min(a, b) }}', { a: 5, b: 10 })).toBe('5');
    });

    it('returns min of variables and literals', () => {
      expect(processTwig('{{ min(a, 20) }}', { a: 5 })).toBe('5');
    });

    it('returns min of single argument', () => {
      expect(processTwig('{{ min(42) }}', {})).toBe('42');
    });
  });

  describe('range()', () => {
    it('generates range 1..5', () => {
      const result = processTwig('{{ range(1, 5) }}', {});
      expect(result).toBe('[1,2,3,4,5]');
    });

    it('generates range with step', () => {
      const result = processTwig('{{ range(0, 10, 2) }}', {});
      expect(result).toBe('[0,2,4,6,8,10]');
    });

    it('generates reverse range', () => {
      const result = processTwig('{{ range(5, 1) }}', {});
      expect(result).toBe('[5,4,3,2,1]');
    });

    it('generates empty range when explicit step opposes direction', () => {
      const result = processTwig('{{ range(5, 1, 1) }}', {});
      expect(result).toBe('[]');
    });

    it('generates range with variables', () => {
      const result = processTwig('{{ range(start, end) }}', { start: 1, end: 3 });
      expect(result).toBe('[1,2,3]');
    });
  });
});
