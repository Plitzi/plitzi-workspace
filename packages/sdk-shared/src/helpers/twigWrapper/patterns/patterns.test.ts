/* eslint-disable quotes, @typescript-eslint/no-non-null-assertion */
import { expect, describe, it } from 'vitest';

import {
  TOKEN_REGEX,
  TOKEN_STRICT_REGEX,
  TOKEN_MATCH,
  TOKEN_INNER,
  FILTER_RE,
  IF_BLOCK,
  COMPARISON,
  STRING_LITERAL,
  FOR_OPEN,
  FOR_TAG,
  RANGE_EXPR,
  BREAK_TAG,
  CONTINUE_TAG,
  SET_ASSIGN,
  SET_BLOCK,
  APPLY_TAG
} from './patterns';

describe('TOKEN_REGEX (non-strict detection)', () => {
  it('matches double-brace tokens', () => {
    expect(TOKEN_REGEX.source).toContain('\\{\\{');
  });

  it('detects simple tokens anywhere in a string', () => {
    TOKEN_REGEX.lastIndex = 0;
    expect(TOKEN_REGEX.test('{{ var }}')).toBe(true);
  });

  it('detects triple-brace tokens', () => {
    TOKEN_REGEX.lastIndex = 0;
    expect(TOKEN_REGEX.test('{{{ var }}}')).toBe(true);
  });

  it('detects token embedded in text', () => {
    TOKEN_REGEX.lastIndex = 0;
    expect(TOKEN_REGEX.test('Hello {{ name }} world')).toBe(true);
  });

  it('rejects empty braces', () => {
    TOKEN_REGEX.lastIndex = 0;
    expect(TOKEN_REGEX.test('{{}}')).toBe(false);
  });

  it('rejects numeric-starting path', () => {
    TOKEN_REGEX.lastIndex = 0;
    expect(TOKEN_REGEX.test('{{ 123abc }}')).toBe(false);
  });

  it('rejects path with leading digit', () => {
    TOKEN_REGEX.lastIndex = 0;
    expect(TOKEN_REGEX.test('{{ 1var }}')).toBe(false);
  });

  it('detects hyphenated path', () => {
    TOKEN_REGEX.lastIndex = 0;
    expect(TOKEN_REGEX.test('{{ my-var.item }}')).toBe(true);
  });

  it('detects nested path', () => {
    TOKEN_REGEX.lastIndex = 0;
    expect(TOKEN_REGEX.test('{{ a.b.c }}')).toBe(true);
  });

  it('detects token with default expression', () => {
    TOKEN_REGEX.lastIndex = 0;
    expect(TOKEN_REGEX.test("{{ x ?? 'default' }}")).toBe(true);
  });

  it('detects token with filter', () => {
    TOKEN_REGEX.lastIndex = 0;
    expect(TOKEN_REGEX.test('{{ x | upper }}')).toBe(true);
  });

  it('detects token with filter chain', () => {
    TOKEN_REGEX.lastIndex = 0;
    expect(TOKEN_REGEX.test('{{ x | upper | truncate(10) }}')).toBe(true);
  });

  it('rejects space in path segment', () => {
    TOKEN_REGEX.lastIndex = 0;
    expect(TOKEN_REGEX.test('{{ va r }}')).toBe(false);
  });

  it('rejects trailing dot in path', () => {
    TOKEN_REGEX.lastIndex = 0;
    expect(TOKEN_REGEX.test('{{ x. }}')).toBe(false);
  });

  it('rejects leading dot in path', () => {
    TOKEN_REGEX.lastIndex = 0;
    expect(TOKEN_REGEX.test('{{ .x }}')).toBe(false);
  });

  it('rejects empty filter pipe', () => {
    TOKEN_REGEX.lastIndex = 0;
    expect(TOKEN_REGEX.test('{{ x | }}')).toBe(false);
  });
});

describe('TOKEN_STRICT_REGEX (strict detection)', () => {
  it('matches only a whole-string single token', () => {
    expect(TOKEN_STRICT_REGEX.test('{{ var }}')).toBe(true);
    expect(TOKEN_STRICT_REGEX.test('{{{ var }}}')).toBe(true);
  });

  it('rejects token inside surrounding text', () => {
    expect(TOKEN_STRICT_REGEX.test('text {{ var }}')).toBe(false);
    expect(TOKEN_STRICT_REGEX.test('{{ var }} text')).toBe(false);
  });

  it('rejects multiple tokens', () => {
    expect(TOKEN_STRICT_REGEX.test('{{ a }} {{ b }}')).toBe(false);
  });

  it('rejects empty braces', () => {
    expect(TOKEN_STRICT_REGEX.test('{{}}')).toBe(false);
    expect(TOKEN_STRICT_REGEX.test('{{{}}}')).toBe(false);
  });

  it('rejects malformed token', () => {
    expect(TOKEN_STRICT_REGEX.test('{{123}}')).toBe(false);
    expect(TOKEN_STRICT_REGEX.test('{{ .x }}')).toBe(false);
  });

  it('accepts token with default', () => {
    expect(TOKEN_STRICT_REGEX.test("{{ x ?? 'd' }}")).toBe(true);
    expect(TOKEN_STRICT_REGEX.test("{{{ x ?? 'd' }}}")).toBe(true);
  });

  it('accepts token with filter chain', () => {
    expect(TOKEN_STRICT_REGEX.test('{{ x | upper | truncate(5) }}')).toBe(true);
  });

  it('accepts nested path', () => {
    expect(TOKEN_STRICT_REGEX.test('{{ a.b.c }}')).toBe(true);
    expect(TOKEN_STRICT_REGEX.test('{{{ a.b.c }}}')).toBe(true);
  });
});

describe('TOKEN_MATCH (capture groups)', () => {
  it('captures double-brace content in group 2', () => {
    TOKEN_MATCH.lastIndex = 0;
    const result = TOKEN_MATCH.exec('{{ var }}');
    expect(result).not.toBeNull();
    expect(result![1]).toBeUndefined();
    expect(result![2]).toBe(' var ');
  });

  it('captures triple-brace content in group 1', () => {
    TOKEN_MATCH.lastIndex = 0;
    const result = TOKEN_MATCH.exec('{{{ var }}}');
    expect(result).not.toBeNull();
    expect(result![1]).toBe(' var ');
    expect(result![2]).toBeUndefined();
  });

  it('triple-brace matches before double-brace', () => {
    TOKEN_MATCH.lastIndex = 0;
    const result = TOKEN_MATCH.exec('{{{ var }}}');
    expect(result).not.toBeNull();
    expect(result![1]).toBe(' var ');
  });

  it('captures content with whitespace', () => {
    TOKEN_MATCH.lastIndex = 0;
    const result = TOKEN_MATCH.exec('{{  var  }}');
    expect(result).not.toBeNull();
    expect(result![2]).toBe('  var  ');
  });

  it('captures content with filter', () => {
    TOKEN_MATCH.lastIndex = 0;
    const result = TOKEN_MATCH.exec('{{ var | upper }}');
    expect(result).not.toBeNull();
    expect(result![2]).toBe(' var | upper ');
  });

  it('captures content with default', () => {
    TOKEN_MATCH.lastIndex = 0;
    const result = TOKEN_MATCH.exec("{{ var ?? 'd' }}");
    expect(result).not.toBeNull();
    expect(result![2]).toBe(" var ?? 'd' ");
  });

  it('finds multiple tokens in a string', () => {
    const fresh = new RegExp(TOKEN_MATCH.source, TOKEN_MATCH.flags);
    const matches = [...'{{ a }} and {{{ b }}}'.matchAll(fresh)];
    expect(matches).toHaveLength(2);
    expect(matches[0][2]).toBe(' a ');
    expect(matches[1][1]).toBe(' b ');
  });

  it('captures nested path content', () => {
    TOKEN_MATCH.lastIndex = 0;
    const result = TOKEN_MATCH.exec('{{ a.b.c.d }}');
    expect(result).not.toBeNull();
    expect(result![2]).toBe(' a.b.c.d ');
  });
});

describe('TOKEN_INNER (content parser)', () => {
  it('parses simple path', () => {
    const m = TOKEN_INNER.exec(' var ');
    expect(m).not.toBeNull();
    expect(m![1]).toBe('var');
    expect(m![2]).toBeUndefined();
    expect(m![3]).toBe('');
  });

  it('parses path with optional chaining marker', () => {
    const m = TOKEN_INNER.exec(' var?.sub ');
    expect(m).not.toBeNull();
    expect(m![1]).toBe('var?.sub');
  });

  it('parses nested path', () => {
    const m = TOKEN_INNER.exec(' a.b.c ');
    expect(m).not.toBeNull();
    expect(m![1]).toBe('a.b.c');
  });

  it('parses default expression', () => {
    const m = TOKEN_INNER.exec(" var ?? 'fallback' ");
    expect(m).not.toBeNull();
    expect(m![1]).toBe('var');
    expect(m![2]).toBe("'fallback'");
  });

  it('parses default with numeric value', () => {
    const m = TOKEN_INNER.exec(' var ?? 0 ');
    expect(m).not.toBeNull();
    expect(m![1]).toBe('var');
    expect(m![2]).toBe('0');
  });

  it('parses single filter', () => {
    const m = TOKEN_INNER.exec(' var | upper ');
    expect(m).not.toBeNull();
    expect(m![1]).toBe('var');
    expect(m![3]).toContain('upper');
  });

  it('parses filter with arguments', () => {
    const m = TOKEN_INNER.exec(' var | truncate(10) ');
    expect(m).not.toBeNull();
    expect(m![1]).toBe('var');
    expect(m![3]).toContain('truncate(10)');
  });

  it('parses filter chain', () => {
    const m = TOKEN_INNER.exec(' var | upper | truncate(5) ');
    expect(m).not.toBeNull();
    expect(m![1]).toBe('var');
    expect(m![3]).toContain('upper');
    expect(m![3]).toContain('truncate(5)');
  });

  it('parses hyphenated path', () => {
    const m = TOKEN_INNER.exec(' my-var.item ');
    expect(m).not.toBeNull();
    expect(m![1]).toBe('my-var.item');
  });

  it('parses path with optional chaining and default', () => {
    const m = TOKEN_INNER.exec(" a?.b ?? 'x' ");
    expect(m).not.toBeNull();
    expect(m![1]).toBe('a?.b');
    expect(m![2]).toBe("'x'");
  });

  it('rejects numeric start', () => {
    expect(TOKEN_INNER.exec(' 123 ')).toBeNull();
  });

  it('rejects empty input', () => {
    expect(TOKEN_INNER.exec(' ')).toBeNull();
  });

  it('rejects leading dot', () => {
    expect(TOKEN_INNER.exec(' .x ')).toBeNull();
  });

  it('rejects trailing dot', () => {
    expect(TOKEN_INNER.exec(' x. ')).toBeNull();
  });

  it('rejects space in segment', () => {
    expect(TOKEN_INNER.exec(' va r ')).toBeNull();
  });
});

describe('FILTER_RE', () => {
  it('matches a simple filter', () => {
    FILTER_RE.lastIndex = 0;
    const m = FILTER_RE.exec('| upper');
    expect(m).not.toBeNull();
    expect(m![1]).toBe('upper');
  });

  it('matches filter with arguments', () => {
    FILTER_RE.lastIndex = 0;
    const m = FILTER_RE.exec('| truncate(10)');
    expect(m).not.toBeNull();
    expect(m![1]).toBe('truncate');
    expect(m![2]).toBe('10');
  });

  it('matches filter chain', () => {
    FILTER_RE.lastIndex = 0;
    const matches = [...'| upper | truncate(5)'.matchAll(FILTER_RE)];
    expect(matches).toHaveLength(2);
    expect(matches[0][1]).toBe('upper');
    expect(matches[1][1]).toBe('truncate');
    expect(matches[1][2]).toBe('5');
  });

  it('matches filter with string argument', () => {
    FILTER_RE.lastIndex = 0;
    const m = FILTER_RE.exec("| default('N/A')");
    expect(m).not.toBeNull();
    expect(m![1]).toBe('default');
    expect(m![2]).toBe("'N/A'");
  });

  it('matches filter with spaces', () => {
    FILTER_RE.lastIndex = 0;
    const m = FILTER_RE.exec('|  upper  ');
    expect(m).not.toBeNull();
    expect(m![1]).toBe('upper');
  });

  it('matches filter names containing digits', () => {
    FILTER_RE.lastIndex = 0;
    const m = FILTER_RE.exec('| nl2br');
    expect(m).not.toBeNull();
    expect(m![1]).toBe('nl2br');
    expect(m![2]).toBeUndefined();
  });

  it('returns null for non-filter string', () => {
    FILTER_RE.lastIndex = 0;
    expect(FILTER_RE.exec('no filter here')).toBeNull();
  });
});

describe('IF_BLOCK', () => {
  it('matches a simple if/endif block', () => {
    const m = IF_BLOCK.exec('{% if x %}yes{% endif %}');
    expect(m).not.toBeNull();
    expect(m![1]).toBe('x');
    expect(m![2]).toBe('yes');
    expect(m![3]).toBeUndefined();
  });

  it('matches if/else/endif block', () => {
    const m = IF_BLOCK.exec('{% if x %}yes{% else %}no{% endif %}');
    expect(m).not.toBeNull();
    expect(m![1]).toBe('x');
    expect(m![2]).toBe('yes');
    expect(m![3]).toBe('no');
  });

  it('captures condition with spaces', () => {
    const m = IF_BLOCK.exec('{%  if  x  %}yes{% endif %}');
    expect(m).not.toBeNull();
    expect(m![1]).toBe('x');
  });

  it('captures condition with comparison operator', () => {
    const m = IF_BLOCK.exec('{% if x == 5 %}yes{% endif %}');
    expect(m).not.toBeNull();
    expect(m![1]).toBe('x == 5');
  });

  it('captures condition with != operator', () => {
    const m = IF_BLOCK.exec('{% if x != 0 %}yes{% endif %}');
    expect(m).not.toBeNull();
    expect(m![1]).toBe('x != 0');
  });

  it('captures nested if blocks inner-first', () => {
    const m = IF_BLOCK.exec('{% if a %}{% if b %}inner{% endif %}{% endif %}');
    expect(m).not.toBeNull();
    expect(m![1]).toBe('b');
    expect(m![2]).toBe('inner');
  });

  it('matches empty then body', () => {
    const m = IF_BLOCK.exec('{% if x %}{% endif %}');
    expect(m).not.toBeNull();
    expect(m![2]).toBe('');
  });

  it('matches empty else body', () => {
    const m = IF_BLOCK.exec('{% if x %}yes{% else %}{% endif %}');
    expect(m).not.toBeNull();
    expect(m![3]).toBe('');
  });

  it('does not match missing endif', () => {
    expect(IF_BLOCK.exec('{% if x %}yes')).toBeNull();
  });

  it('does not match missing if', () => {
    expect(IF_BLOCK.exec('yes{% endif %}')).toBeNull();
  });

  it('does not match mismatched tags', () => {
    expect(IF_BLOCK.exec('{% if x %}yes{% endfor %}')).toBeNull();
  });

  it('matches then body containing tokens', () => {
    const m = IF_BLOCK.exec('{% if x %}{{ name }}{% endif %}');
    expect(m).not.toBeNull();
    expect(m![2]).toBe('{{ name }}');
  });

  it('matches else body containing tokens', () => {
    const m = IF_BLOCK.exec('{% if x %}yes{% else %}{{ fallback }}{% endif %}');
    expect(m).not.toBeNull();
    expect(m![3]).toBe('{{ fallback }}');
  });

  it('matches condition with >= operator', () => {
    const m = IF_BLOCK.exec('{% if x >= 10 %}yes{% endif %}');
    expect(m).not.toBeNull();
    expect(m![1]).toBe('x >= 10');
  });

  it('matches condition with <= operator', () => {
    const m = IF_BLOCK.exec('{% if x <= 10 %}yes{% endif %}');
    expect(m).not.toBeNull();
    expect(m![1]).toBe('x <= 10');
  });

  it('matches condition with > operator', () => {
    const m = IF_BLOCK.exec('{% if x > 5 %}yes{% endif %}');
    expect(m).not.toBeNull();
    expect(m![1]).toBe('x > 5');
  });

  it('matches condition with < operator', () => {
    const m = IF_BLOCK.exec('{% if x < 5 %}yes{% endif %}');
    expect(m).not.toBeNull();
    expect(m![1]).toBe('x < 5');
  });

  it('matches condition with quoted string', () => {
    const m = IF_BLOCK.exec("{% if x == 'hello' %}yes{% endif %}");
    expect(m).not.toBeNull();
    expect(m![1]).toBe("x == 'hello'");
  });

  it('matches then body with HTML-like content', () => {
    const m = IF_BLOCK.exec('{% if x %}<div class="a">text</div>{% endif %}');
    expect(m).not.toBeNull();
    expect(m![2]).toBe('<div class="a">text</div>');
  });
});

describe('COMPARISON', () => {
  it('parses == operator', () => {
    const m = 'x == 5'.match(COMPARISON);
    expect(m).not.toBeNull();
    expect(m![1]).toBe('x');
    expect(m![2]).toBe('==');
    expect(m![3]).toBe('5');
  });

  it('parses != operator', () => {
    const m = 'x != 0'.match(COMPARISON);
    expect(m).not.toBeNull();
    expect(m![1]).toBe('x');
    expect(m![2]).toBe('!=');
    expect(m![3]).toBe('0');
  });

  it('parses > operator', () => {
    const m = 'x > 5'.match(COMPARISON);
    expect(m).not.toBeNull();
    expect(m![2]).toBe('>');
  });

  it('parses < operator', () => {
    const m = 'x < 5'.match(COMPARISON);
    expect(m).not.toBeNull();
    expect(m![2]).toBe('<');
  });

  it('parses >= operator', () => {
    const m = 'x >= 10'.match(COMPARISON);
    expect(m).not.toBeNull();
    expect(m![2]).toBe('>=');
  });

  it('parses <= operator', () => {
    const m = 'x <= 10'.match(COMPARISON);
    expect(m).not.toBeNull();
    expect(m![2]).toBe('<=');
  });

  it('parses nested path on left', () => {
    const m = 'a.b.c == 5'.match(COMPARISON);
    expect(m).not.toBeNull();
    expect(m![1]).toBe('a.b.c');
  });

  it('parses quoted string on right', () => {
    const m = "x == 'hello'".match(COMPARISON);
    expect(m).not.toBeNull();
    expect(m![3]).toBe("'hello'");
  });

  it('parses nested path on right', () => {
    const m = 'x == a.b'.match(COMPARISON);
    expect(m).not.toBeNull();
    expect(m![3]).toBe('a.b');
  });

  it('parses numeric on both sides', () => {
    const m = '5 == 5'.match(COMPARISON);
    expect(m).not.toBeNull();
    expect(m![1]).toBe('5');
    expect(m![3]).toBe('5');
  });

  it('returns null for no operator', () => {
    expect('x y'.match(COMPARISON)).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(''.match(COMPARISON)).toBeNull();
  });

  it('parses comparison with extra whitespace', () => {
    const m = 'x   ==   5'.match(COMPARISON);
    expect(m).not.toBeNull();
    expect(m![1]).toBe('x');
    expect(m![3]).toBe('5');
  });
});

describe('STRING_LITERAL', () => {
  it('matches single-quoted string', () => {
    const m = "'hello'".match(STRING_LITERAL);
    expect(m).not.toBeNull();
    expect(m![1]).toBe("'");
    expect(m![2]).toBe('hello');
  });

  it('matches double-quoted string', () => {
    const m = '"hello"'.match(STRING_LITERAL);
    expect(m).not.toBeNull();
    expect(m![1]).toBe('"');
    expect(m![2]).toBe('hello');
  });

  it('matches empty string', () => {
    const m = "''".match(STRING_LITERAL);
    expect(m).not.toBeNull();
    expect(m![2]).toBe('');
  });

  it('matches string with spaces', () => {
    const m = "'hello world'".match(STRING_LITERAL);
    expect(m).not.toBeNull();
    expect(m![2]).toBe('hello world');
  });

  it('matches string with special chars', () => {
    const m = "'a-b_c'".match(STRING_LITERAL);
    expect(m).not.toBeNull();
    expect(m![2]).toBe('a-b_c');
  });

  it('returns null for unmatched quotes', () => {
    expect('\'hello"'.match(STRING_LITERAL)).toBeNull();
  });

  it('returns null for no quotes', () => {
    expect('hello'.match(STRING_LITERAL)).toBeNull();
  });

  it('returns null for unmatched closing quote', () => {
    expect('"hello\''.match(STRING_LITERAL)).toBeNull();
  });
});

describe('FOR_OPEN', () => {
  it('matches simple for loop', () => {
    const m = '{% for item in list %}'.match(FOR_OPEN);
    expect(m).not.toBeNull();
    expect(m![1]).toBe('item');
    expect(m![2]).toBeUndefined();
    expect(m![3]).toBe('list');
  });

  it('matches for with key/value', () => {
    const m = '{% for key, value in obj %}'.match(FOR_OPEN);
    expect(m).not.toBeNull();
    expect(m![1]).toBe('key');
    expect(m![2]).toBe('value');
    expect(m![3]).toBe('obj');
  });

  it('matches for with nested path', () => {
    const m = '{% for item in data.items %}'.match(FOR_OPEN);
    expect(m).not.toBeNull();
    expect(m![1]).toBe('item');
    expect(m![3]).toBe('data.items');
  });

  it('matches for with range expression', () => {
    const m = '{% for i in 0..10 %}'.match(FOR_OPEN);
    expect(m).not.toBeNull();
    expect(m![1]).toBe('i');
    expect(m![3]).toBe('0..10');
  });

  it('matches for with variable range', () => {
    const m = '{% for i in start..end %}'.match(FOR_OPEN);
    expect(m).not.toBeNull();
    expect(m![3]).toBe('start..end');
  });

  it('matches for with various whitespace', () => {
    const m = '{%  for  item  in  list  %}'.match(FOR_OPEN);
    expect(m).not.toBeNull();
    expect(m![1]).toBe('item');
    expect(m![3]).toBe('list');
  });

  it('matches for with no spaces around keywords', () => {
    const m = '{%for item in list%}'.match(FOR_OPEN);
    expect(m).not.toBeNull();
    expect(m![1]).toBe('item');
    expect(m![3]).toBe('list');
  });

  it('does not match missing in keyword', () => {
    expect('{% for item list %}'.match(FOR_OPEN)).toBeNull();
  });

  it('does not match missing for keyword', () => {
    expect('{% if item in list %}'.match(FOR_OPEN)).toBeNull();
  });

  it('does not match missing collection', () => {
    expect('{% for item in %}'.match(FOR_OPEN)).toBeNull();
  });

  it('matches for with quoted character range', () => {
    const m = "{% for c in 'a'..'z' %}".match(FOR_OPEN);
    expect(m).not.toBeNull();
    expect(m![3]).toBe("'a'..'z'");
  });
});

describe('FOR_TAG', () => {
  it('matches for opening tag', () => {
    FOR_TAG.lastIndex = 0;
    const m = FOR_TAG.exec('{% for item in list %}');
    expect(m).not.toBeNull();
    expect(m![1]).toBe('for item in list');
  });

  it('matches endfor tag', () => {
    FOR_TAG.lastIndex = 0;
    const m = FOR_TAG.exec('{% endfor %}');
    expect(m).not.toBeNull();
    expect(m![1]).toBe('endfor');
  });

  it('matches else tag', () => {
    FOR_TAG.lastIndex = 0;
    const m = FOR_TAG.exec('{% else %}');
    expect(m).not.toBeNull();
    expect(m![1]).toBe('else');
  });

  it('matches if tag', () => {
    FOR_TAG.lastIndex = 0;
    const m = FOR_TAG.exec('{% if x %}');
    expect(m).not.toBeNull();
    expect(m![1]).toBe('if x');
  });

  it('matches endif tag', () => {
    FOR_TAG.lastIndex = 0;
    const m = FOR_TAG.exec('{% endif %}');
    expect(m).not.toBeNull();
    expect(m![1]).toBe('endif');
  });

  it('matches with various whitespace', () => {
    FOR_TAG.lastIndex = 0;
    const m = FOR_TAG.exec('{%  for  item  in  list  %}');
    expect(m).not.toBeNull();
    expect(m![1]).toBe('for  item  in  list');
  });

  it('finds multiple tags in a string', () => {
    const input = '{% for x in list %}{% if x %}{% endif %}{% endfor %}';
    const fresh = new RegExp(FOR_TAG.source, FOR_TAG.flags);
    const matches = [...input.matchAll(fresh)];
    expect(matches.length).toBeGreaterThanOrEqual(2);
    expect(matches[0][1]).toBe('for x in list');
  });

  it('does not match plain text', () => {
    FOR_TAG.lastIndex = 0;
    expect(FOR_TAG.exec('plain text')).toBeNull();
  });

  it('does not match single brace', () => {
    FOR_TAG.lastIndex = 0;
    expect(FOR_TAG.exec('{%break%}')).toBeNull();
  });

  it('does not match unknown tags', () => {
    FOR_TAG.lastIndex = 0;
    expect(FOR_TAG.exec('{% set x = 5 %}')).toBeNull();
  });
});

describe('RANGE_EXPR', () => {
  it('matches numeric range 0..10', () => {
    const m = '0..10'.match(RANGE_EXPR);
    expect(m).not.toBeNull();
    expect(m![2]).toBe('0');
    expect(m![4]).toBe('10');
  });

  it('matches variable range start..end', () => {
    const m = 'start..end'.match(RANGE_EXPR);
    expect(m).not.toBeNull();
    expect(m![2]).toBe('start');
    expect(m![4]).toBe('end');
  });

  it('matches single-char range a..z', () => {
    const m = 'a..z'.match(RANGE_EXPR);
    expect(m).not.toBeNull();
    expect(m![2]).toBe('a');
    expect(m![4]).toBe('z');
  });

  it('matches quoted character range', () => {
    const m = "'a'..'z'".match(RANGE_EXPR);
    expect(m).not.toBeNull();
    expect(m![1]).toBe("'");
    expect(m![2]).toBe('a');
    expect(m![3]).toBe("'");
    expect(m![4]).toBe('z');
  });

  it('matches double-quoted character range', () => {
    const m = '"a".."z"'.match(RANGE_EXPR);
    expect(m).not.toBeNull();
    expect(m![1]).toBe('"');
    expect(m![2]).toBe('a');
    expect(m![3]).toBe('"');
    expect(m![4]).toBe('z');
  });

  it('matches negative number range', () => {
    const m = '-2..2'.match(RANGE_EXPR);
    expect(m).not.toBeNull();
    expect(m![2]).toBe('-2');
    expect(m![4]).toBe('2');
  });

  it('matches same value range', () => {
    const m = '5..5'.match(RANGE_EXPR);
    expect(m).not.toBeNull();
    expect(m![2]).toBe('5');
    expect(m![4]).toBe('5');
  });

  it('returns null for no dots', () => {
    expect('0 10'.match(RANGE_EXPR)).toBeNull();
  });

  it('returns null for single dot', () => {
    expect('0.10'.match(RANGE_EXPR)).toBeNull();
  });

  it('returns null for three dots', () => {
    expect('0...10'.match(RANGE_EXPR)).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(''.match(RANGE_EXPR)).toBeNull();
  });
});

describe('BREAK_TAG', () => {
  it('matches {% break %}', () => {
    expect('{% break %}'.match(BREAK_TAG)).not.toBeNull();
  });

  it('matches with no spaces', () => {
    expect('{%break%}'.match(BREAK_TAG)).not.toBeNull();
  });

  it('matches with excessive whitespace', () => {
    expect('{%  break  %}'.match(BREAK_TAG)).not.toBeNull();
  });

  it('matches with tabs', () => {
    expect('{%\tbreak\t%}'.match(BREAK_TAG)).not.toBeNull();
  });

  it('matches with newlines', () => {
    expect('{%\nbreak\n%}'.match(BREAK_TAG)).not.toBeNull();
  });

  it('does not match break outside braces', () => {
    expect('break'.match(BREAK_TAG)).toBeNull();
  });

  it('does not match similar tags', () => {
    expect('{% breaking %}'.match(BREAK_TAG)).toBeNull();
    expect('{% breakout %}'.match(BREAK_TAG)).toBeNull();
  });

  it('does not match {% continue %}', () => {
    expect('{% continue %}'.match(BREAK_TAG)).toBeNull();
  });
});

describe('CONTINUE_TAG', () => {
  it('matches {% continue %}', () => {
    expect('{% continue %}'.match(CONTINUE_TAG)).not.toBeNull();
  });

  it('matches with no spaces', () => {
    expect('{%continue%}'.match(CONTINUE_TAG)).not.toBeNull();
  });

  it('matches with excessive whitespace', () => {
    expect('{%  continue  %}'.match(CONTINUE_TAG)).not.toBeNull();
  });

  it('matches with tabs', () => {
    expect('{%\tcontinue\t%}'.match(CONTINUE_TAG)).not.toBeNull();
  });

  it('matches with newlines', () => {
    expect('{%\ncontinue\n%}'.match(CONTINUE_TAG)).not.toBeNull();
  });

  it('does not match continue outside braces', () => {
    expect('continue'.match(CONTINUE_TAG)).toBeNull();
  });

  it('does not match similar tags', () => {
    expect('{% continuing %}'.match(CONTINUE_TAG)).toBeNull();
    expect('{% continued %}'.match(CONTINUE_TAG)).toBeNull();
  });

  it('does not match {% break %}', () => {
    expect('{% break %}'.match(CONTINUE_TAG)).toBeNull();
  });
});

describe('SET_ASSIGN', () => {
  it('matches simple assignment', () => {
    SET_ASSIGN.lastIndex = 0;
    const result = SET_ASSIGN.exec('{% set name = "value" %}');
    expect(result).not.toBeNull();
    expect(result![1]).toBe('name');
    expect(result![2]).toBe('"value"');
  });

  it('matches numeric expression', () => {
    SET_ASSIGN.lastIndex = 0;
    const result = SET_ASSIGN.exec('{% set count = 42 %}');
    expect(result).not.toBeNull();
    expect(result![1]).toBe('count');
    expect(result![2]).toBe('42');
  });

  it('matches variable expression', () => {
    SET_ASSIGN.lastIndex = 0;
    const result = SET_ASSIGN.exec('{% set b = a %}');
    expect(result).not.toBeNull();
    expect(result![1]).toBe('b');
    expect(result![2]).toBe('a');
  });

  it('matches with extra whitespace', () => {
    SET_ASSIGN.lastIndex = 0;
    const result = SET_ASSIGN.exec('{%  set   x  =  y  %}');
    expect(result).not.toBeNull();
    expect(result![1]).toBe('x');
  });

  it('does not match without braces', () => {
    SET_ASSIGN.lastIndex = 0;
    expect(SET_ASSIGN.exec('set x = y')).toBeNull();
  });

  it('does not match without equals sign', () => {
    SET_ASSIGN.lastIndex = 0;
    expect(SET_ASSIGN.exec('{% set x %}')).toBeNull();
  });
});

describe('SET_BLOCK', () => {
  it('matches block capture', () => {
    SET_BLOCK.lastIndex = 0;
    const result = SET_BLOCK.exec('{% set content %}Hello{% endset %}');
    expect(result).not.toBeNull();
    expect(result![1]).toBe('content');
    expect(result![2]).toBe('Hello');
  });

  it('matches multiline content', () => {
    SET_BLOCK.lastIndex = 0;
    const result = SET_BLOCK.exec('{% set html %}<div>\n<p>Hi</p>\n</div>{% endset %}');
    expect(result).not.toBeNull();
    expect(result![1]).toBe('html');
    expect(result![2]).toContain('<div>');
  });

  it('matches with extra whitespace', () => {
    SET_BLOCK.lastIndex = 0;
    const result = SET_BLOCK.exec('{%  set   content  %}test{%  endset  %}');
    expect(result).not.toBeNull();
    expect(result![1]).toBe('content');
    expect(result![2]).toBe('test');
  });

  it('does not match without endset', () => {
    SET_BLOCK.lastIndex = 0;
    expect(SET_BLOCK.exec('{% set content %}Hello')).toBeNull();
  });
});

describe('APPLY_TAG', () => {
  it('matches single filter', () => {
    APPLY_TAG.lastIndex = 0;
    const result = APPLY_TAG.exec('{% apply upper %}hello{% endapply %}');
    expect(result).not.toBeNull();
    expect(result![1]).toBe('upper');
    expect(result![2]).toBe('hello');
  });

  it('matches chained filters', () => {
    APPLY_TAG.lastIndex = 0;
    const result = APPLY_TAG.exec('{% apply upper|trim %}  hello  {% endapply %}');
    expect(result).not.toBeNull();
    expect(result![1]).toBe('upper|trim');
    expect(result![2]).toBe('  hello  ');
  });

  it('matches multiline content', () => {
    APPLY_TAG.lastIndex = 0;
    const result = APPLY_TAG.exec('{% apply nl2br %}line1\nline2{% endapply %}');
    expect(result).not.toBeNull();
    expect(result![1]).toBe('nl2br');
    expect(result![2]).toBe('line1\nline2');
  });

  it('matches with extra whitespace', () => {
    APPLY_TAG.lastIndex = 0;
    const result = APPLY_TAG.exec('{%  apply   upper  %}hi{%  endapply  %}');
    expect(result).not.toBeNull();
    expect(result![1]).toBe('upper');
    expect(result![2]).toBe('hi');
  });

  it('does not match without endapply', () => {
    APPLY_TAG.lastIndex = 0;
    expect(APPLY_TAG.exec('{% apply upper %}hello')).toBeNull();
  });
});
