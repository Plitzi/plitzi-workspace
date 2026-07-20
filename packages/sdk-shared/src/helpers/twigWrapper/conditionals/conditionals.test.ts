import { expect, describe, it } from 'vitest';

import { processTwig } from '../..';

describe('conditionals', () => {
  describe('basic if', () => {
    it('renders if block when condition is truthy', () => {
      expect(processTwig('{% if show %}yes{% endif %}', { show: true })).toBe('yes');
    });

    it('does not render if block when condition is falsy', () => {
      expect(processTwig('{% if show %}yes{% endif %}', { show: false })).toBe('');
    });

    it('renders if/else correctly', () => {
      const tpl = '{% if source %}Yes{% else %}No{% endif %}';
      expect(processTwig(tpl, { source: 'x' })).toBe('Yes');
      expect(processTwig(tpl, { source: '' })).toBe('No');
      expect(processTwig(tpl, {})).toBe('No');
    });

    it('renders surrounding text', () => {
      expect(processTwig('pre {% if x %}Y{% endif %} post', { x: true })).toBe('pre Y post');
    });

    it('empty if body renders empty string', () => {
      expect(processTwig('{% if true %}{% endif %}', {})).toBe('');
    });
  });

  describe('nested if', () => {
    it('supports nested if blocks', () => {
      const tpl = '{% if a %}{% if b %}AB{% endif %}{% endif %}';
      expect(processTwig(tpl, { a: true, b: true })).toBe('AB');
      expect(processTwig(tpl, { a: true, b: false })).toBe('');
      expect(processTwig(tpl, { a: false, b: true })).toBe('');
    });

    it('survives deeply nested ifs (5 levels)', () => {
      const tpl =
        '{% if a %}{% if b %}{% if c %}{% if d %}{% if e %}DEEP{% endif %}{% endif %}{% endif %}{% endif %}{% endif %}';
      expect(processTwig(tpl, { a: true, b: true, c: true, d: true, e: true })).toBe('DEEP');
      expect(processTwig(tpl, { a: true, b: true, c: true, d: true, e: false })).toBe('');
    });
  });

  describe('equality comparison', () => {
    it('renders if on equality comparison', () => {
      expect(processTwig('{% if a == b %}(You){% endif %}', { a: 5, b: 5 })).toBe('(You)');
      expect(processTwig('{% if a == b %}(You){% endif %}', { a: 5, b: 6 })).toBe('');
    });

    it('renders if on nested equality comparison', () => {
      expect(processTwig('{% if u.id == it.uid %}(You){% endif %}', { u: { id: 'z' }, it: { uid: 'z' } })).toBe(
        '(You)'
      );
    });

    it('supports != operator', () => {
      expect(processTwig('{% if a != b %}diff{% endif %}', { a: 1, b: 2 })).toBe('diff');
      expect(processTwig('{% if a != b %}diff{% endif %}', { a: 1, b: 1 })).toBe('');
    });

    it('supports string equality', () => {
      expect(processTwig('{% if x == "hello" %}match{% endif %}', { x: 'hello' })).toBe('match');
      expect(processTwig('{% if x == "hello" %}match{% endif %}', { x: 'world' })).toBe('');
    });
  });

  describe('comparison operators', () => {
    it('supports > operator', () => {
      expect(processTwig('{% if n > 5 %}big{% endif %}', { n: 10 })).toBe('big');
      expect(processTwig('{% if n > 5 %}big{% endif %}', { n: 3 })).toBe('');
    });

    it('supports < operator', () => {
      expect(processTwig('{% if n < 5 %}small{% endif %}', { n: 3 })).toBe('small');
      expect(processTwig('{% if n < 5 %}small{% endif %}', { n: 10 })).toBe('');
    });

    it('supports >= operator', () => {
      expect(processTwig('{% if n >= 5 %}ok{% endif %}', { n: 5 })).toBe('ok');
      expect(processTwig('{% if n >= 5 %}ok{% endif %}', { n: 4 })).toBe('');
    });

    it('supports <= operator', () => {
      expect(processTwig('{% if n <= 5 %}ok{% endif %}', { n: 5 })).toBe('ok');
      expect(processTwig('{% if n <= 5 %}ok{% endif %}', { n: 6 })).toBe('');
    });
  });

  describe('not operator', () => {
    it('inverts a truthy value', () => {
      expect(processTwig('{% if not flag %}no{% endif %}', { flag: false })).toBe('no');
      expect(processTwig('{% if not flag %}no{% endif %}', { flag: true })).toBe('');
    });

    it('works with equality', () => {
      expect(processTwig('{% if not x == "b" %}not-b{% endif %}', { x: 'a' })).toBe('not-b');
      expect(processTwig('{% if not x == "b" %}not-b{% endif %}', { x: 'b' })).toBe('');
    });

    it('works with nested path', () => {
      expect(processTwig('{% if not item.hidden %}visible{% endif %}', { item: { hidden: false } })).toBe('visible');
      expect(processTwig('{% if not item.hidden %}visible{% endif %}', { item: { hidden: true } })).toBe('');
    });
  });

  describe('whitespace flexibility', () => {
    it('handles no spaces around keywords', () => {
      expect(processTwig('{%if x%}Y{%endif%}', { x: true })).toBe('Y');
    });

    it('handles excessive whitespace', () => {
      expect(processTwig('{%   if   x   %}Y{%   endif   %}', { x: true })).toBe('Y');
    });

    it('handles whitespace in else clause', () => {
      expect(processTwig('{%  if  x  %}Y{%  else  %}N{%  endif  %}', { x: false })).toBe('N');
    });
  });

  describe('robustness', () => {
    it('missing endif — template passed through', () => {
      const tpl = '{% if true %}hello';
      expect(() => processTwig(tpl, {})).not.toThrow();
      expect(processTwig(tpl, {})).toBe(tpl);
    });

    it('extra endif — template passed through', () => {
      const tpl = '{% if true %}hello{% endif %}{% endif %}';
      expect(() => processTwig(tpl, {})).not.toThrow();
      expect(processTwig(tpl, {})).toBe('hello{% endif %}');
    });

    it('malformed if tag — left untouched', () => {
      const tpl = '{% if %}hello{% endif %}';
      expect(() => processTwig(tpl, {})).not.toThrow();
      expect(processTwig(tpl, {})).toBe(tpl);
    });

    it('non-string template input — returned as-is', () => {
      expect(processTwig(null as unknown as string, {})).toBe(null);
      expect(processTwig(42 as unknown as string, {})).toBe(42);
      expect(processTwig(undefined as unknown as string, {})).toBe(undefined);
      expect(processTwig(true as unknown as string, {})).toBe(true);
    });
  });

  describe('combined with other features', () => {
    it('if with token interpolation', () => {
      expect(processTwig('{% if show %}{{ name }}{% endif %}', { show: true, name: 'Alice' })).toBe('Alice');
    });

    it('if with default filter', () => {
      const result = processTwig(
        '{% if user.name %}{{ user.name | upper }}{% else %}{{ user.email ?? "unknown" }}{% endif %}',
        { user: { email: 'test@test.com' } }
      );
      expect(result).toBe('test@test.com');
    });

    it('if with not operator + token', () => {
      expect(
        processTwig('{% if not item.hidden %}{{ item.value }}{% endif %}', { item: { value: 'A', hidden: false } })
      ).toBe('A');
      expect(
        processTwig('{% if not item.hidden %}{{ item.value }}{% endif %}', { item: { value: 'A', hidden: true } })
      ).toBe('');
    });

    it('reproduces the real seed transformer with "(You)"', () => {
      const tpl =
        '{{source}} ({{list_x.item.user.email}}) {% if otherSources.user.user.id == fullSource.item.user.id %}(You){% endif %}';
      const base = { source: 'Nice', list_x: { item: { user: { email: 'me@x.com' } } } };

      expect(
        processTwig(tpl, {
          ...base,
          otherSources: { user: { user: { id: '1' } } },
          fullSource: { item: { user: { id: '1' } } }
        })
      ).toBe('Nice (me@x.com) (You)');

      expect(
        processTwig(tpl, {
          ...base,
          otherSources: { user: { user: { id: '1' } } },
          fullSource: { item: { user: { id: '2' } } }
        })
      ).toBe('Nice (me@x.com) ');
    });

    it('if with triple braces', () => {
      expect(processTwig('{% if show %}{{{ data }}}{% endif %}', { show: true, data: { x: 1 } })).toBe(
        '[object Object]'
      );
    });
  });

  describe('elseif', () => {
    it('resolves the first matching elseif branch', () => {
      const tpl = '{% if a %}A{% elseif b %}B{% endif %}';
      expect(processTwig(tpl, { a: true, b: true })).toBe('A');
      expect(processTwig(tpl, { a: false, b: true })).toBe('B');
      expect(processTwig(tpl, { a: false, b: false })).toBe('');
    });

    it('resolves else when all conditions are false', () => {
      const tpl = '{% if a %}A{% elseif b %}B{% else %}C{% endif %}';
      expect(processTwig(tpl, { a: true })).toBe('A');
      expect(processTwig(tpl, { b: true })).toBe('B');
      expect(processTwig(tpl, {})).toBe('C');
    });

    it('supports three elseif branches', () => {
      const tpl = '{% if x == 1 %}one{% elseif x == 2 %}two{% elseif x == 3 %}three{% else %}other{% endif %}';
      expect(processTwig(tpl, { x: 1 })).toBe('one');
      expect(processTwig(tpl, { x: 2 })).toBe('two');
      expect(processTwig(tpl, { x: 3 })).toBe('three');
      expect(processTwig(tpl, { x: 9 })).toBe('other');
    });

    it('picks only the first truthy branch', () => {
      const tpl = '{% if a %}A{% elseif b %}B{% elseif c %}C{% endif %}';
      expect(processTwig(tpl, { a: true, b: true, c: true })).toBe('A');
      expect(processTwig(tpl, { a: false, b: true, c: true })).toBe('B');
      expect(processTwig(tpl, { a: false, b: false, c: true })).toBe('C');
    });

    it('handles elseif with nested paths', () => {
      const tpl =
        '{% if user.role == "admin" %}Admin{% elseif user.role == "editor" %}Editor{% else %}Viewer{% endif %}';
      expect(processTwig(tpl, { user: { role: 'admin' } })).toBe('Admin');
      expect(processTwig(tpl, { user: { role: 'editor' } })).toBe('Editor');
      expect(processTwig(tpl, { user: { role: 'viewer' } })).toBe('Viewer');
    });

    it('handles elseif with whitespace variations', () => {
      const tpl = '{%if a%}A{%elseif b%}B{%else%}C{%endif%}';
      expect(processTwig(tpl, { a: false, b: true })).toBe('B');
      expect(processTwig(tpl, { a: false, b: false })).toBe('C');
    });

    it('handles elseif with tokens in body', () => {
      const tpl = '{% if a %}{{ x }}{% elseif b %}{{ y }}{% else %}{{ z }}{% endif %}';
      expect(processTwig(tpl, { a: true, x: 'XA' })).toBe('XA');
      expect(processTwig(tpl, { a: false, b: true, y: 'YB' })).toBe('YB');
      expect(processTwig(tpl, { a: false, b: false, z: 'ZC' })).toBe('ZC');
    });

    it('elseif inside a loop', () => {
      const tpl = '{% for i in items %}{% if i > 5 %}big{% elseif i > 2 %}mid{% else %}small{% endif %},{% endfor %}';
      expect(processTwig(tpl, { items: [1, 3, 7] })).toBe('small,mid,big,');
    });

    it('elseif with comparison operators', () => {
      const tpl = '{% if n >= 10 %}high{% elseif n >= 5 %}mid{% else %}low{% endif %}';
      expect(processTwig(tpl, { n: 15 })).toBe('high');
      expect(processTwig(tpl, { n: 7 })).toBe('mid');
      expect(processTwig(tpl, { n: 2 })).toBe('low');
    });

    it('elseif without else — empty when no branch matches', () => {
      const tpl = '{% if a %}A{% elseif b %}B{% endif %}';
      expect(processTwig(tpl, { a: false, b: false })).toBe('');
    });
  });

  describe('and / or operators', () => {
    it('and — both true', () => {
      expect(processTwig('{% if a and b %}Y{% endif %}', { a: true, b: true })).toBe('Y');
    });

    it('and — one false', () => {
      expect(processTwig('{% if a and b %}Y{% endif %}', { a: true, b: false })).toBe('');
      expect(processTwig('{% if a and b %}Y{% endif %}', { a: false, b: true })).toBe('');
    });

    it('or — one true', () => {
      expect(processTwig('{% if a or b %}Y{% endif %}', { a: true, b: false })).toBe('Y');
      expect(processTwig('{% if a or b %}Y{% endif %}', { a: false, b: true })).toBe('Y');
    });

    it('or — both false', () => {
      expect(processTwig('{% if a or b %}Y{% endif %}', { a: false, b: false })).toBe('');
    });

    it('and/or combined — or is lower precedence than and', () => {
      // `a or b and c` should be `a or (b and c)`
      expect(processTwig('{% if a or b and c %}Y{% endif %}', { a: false, b: true, c: true })).toBe('Y');
      expect(processTwig('{% if a or b and c %}Y{% endif %}', { a: false, b: true, c: false })).toBe('');
      expect(processTwig('{% if a or b and c %}Y{% endif %}', { a: true, b: false, c: false })).toBe('Y');
    });

    it('not has higher precedence than and', () => {
      // `not a and b` should be `(not a) and b`
      expect(processTwig('{% if not a and b %}Y{% endif %}', { a: false, b: true })).toBe('Y');
      expect(processTwig('{% if not a and b %}Y{% endif %}', { a: true, b: true })).toBe('');
      expect(processTwig('{% if not a and b %}Y{% endif %}', { a: false, b: false })).toBe('');
    });

    it('not has higher precedence than or', () => {
      // `not a or b` should be `(not a) or b`
      expect(processTwig('{% if not a or b %}Y{% endif %}', { a: false, b: false })).toBe('Y');
      expect(processTwig('{% if not a or b %}Y{% endif %}', { a: true, b: true })).toBe('Y');
      expect(processTwig('{% if not a or b %}Y{% endif %}', { a: true, b: false })).toBe('');
    });

    it('and with comparisons', () => {
      const tpl = '{% if x > 5 and x < 10 %}ok{% endif %}';
      expect(processTwig(tpl, { x: 7 })).toBe('ok');
      expect(processTwig(tpl, { x: 3 })).toBe('');
      expect(processTwig(tpl, { x: 12 })).toBe('');
    });

    it('or with comparisons', () => {
      const tpl = '{% if x == "a" or x == "b" %}matched{% endif %}';
      expect(processTwig(tpl, { x: 'a' })).toBe('matched');
      expect(processTwig(tpl, { x: 'b' })).toBe('matched');
      expect(processTwig(tpl, { x: 'c' })).toBe('');
    });

    it('complex expression with and, or, and not', () => {
      const tpl = '{% if not a or b and c %}Y{% endif %}';
      // `(not a) or (b and c)`
      expect(processTwig(tpl, { a: true, b: true, c: true })).toBe('Y');
      expect(processTwig(tpl, { a: true, b: true, c: false })).toBe('');
      expect(processTwig(tpl, { a: true, b: false, c: true })).toBe('');
      expect(processTwig(tpl, { a: false, b: false, c: false })).toBe('Y');
    });

    it('three operands with and', () => {
      expect(processTwig('{% if a and b and c %}Y{% endif %}', { a: true, b: true, c: true })).toBe('Y');
      expect(processTwig('{% if a and b and c %}Y{% endif %}', { a: true, b: true, c: false })).toBe('');
    });

    it('three operands with or', () => {
      expect(processTwig('{% if a or b or c %}Y{% endif %}', { a: false, b: false, c: false })).toBe('');
      expect(processTwig('{% if a or b or c %}Y{% endif %}', { a: false, b: true, c: false })).toBe('Y');
    });
  });
});
