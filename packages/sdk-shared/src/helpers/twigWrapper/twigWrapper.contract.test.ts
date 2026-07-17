/* eslint-disable quotes */
import { expect, describe, it } from 'vitest';

import { processTwig, hasValidToken } from '.';

// Behavioural contract for twigWrapper. It pins the exact output every consumer relies on, captured from the
// current Twig-backed implementation, so a custom interpreter can replace Twig and prove zero regression by
// staying green here. Each expectation is the real observed value, not an assumed one.
//
// Consumers this guards: sdk-elements (useElementInternal, ApiContainer, Link, Image) via keepEmptyTokens;
// sdk-interactions (InteractionsHelper loop, twigTemplate) via asRaw + iteration; sdk-shared/sdk-interactions
// twigTemplate transformers (plain, may carry `{% if %}`); sdk-auth (plain + JSON.parse); builder NodeBodyParam
// (hasValidToken strict).

describe('processTwig — passthrough', () => {
  it('returns a non-string untouched', () => {
    expect(processTwig(42 as unknown as string)).toBe(42);
    expect(processTwig(null as unknown as string)).toBeNull();
    expect(processTwig(undefined as unknown as string)).toBeUndefined();
  });

  it('returns a string with no tokens unchanged (idempotent tail of the interactions loop)', () => {
    expect(processTwig('already resolved')).toBe('already resolved');
    expect(processTwig('')).toBe('');
  });

  it('returns the original template on a twig syntax error', () => {
    expect(processTwig('{{ invalid ')).toBe('{{ invalid ');
  });
});

describe('processTwig — plain interpolation', () => {
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

  it('renders an object token as [object Object]', () => {
    expect(processTwig('{{ o }}', { o: { a: 1 } })).toBe('[object Object]');
  });

  it('merges variables.variables into the root context', () => {
    expect(processTwig('Hello {{ name }}', { variables: { name: 'Peter' } })).toBe('Hello Peter');
  });
});

describe('processTwig — default (??) coalescing', () => {
  it('uses the default only when the value is undefined', () => {
    expect(processTwig("{{ x ?? 'def' }}", {})).toBe('def');
  });

  it('keeps an empty string and a zero rather than coalescing', () => {
    expect(processTwig("{{ x ?? 'def' }}", { x: '' })).toBe('');
    expect(processTwig("{{ x ?? 'def' }}", { x: 0 })).toBe('0');
  });
});

describe('processTwig — keepEmptyTokens', () => {
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

describe('processTwig — asRaw', () => {
  it('returns a parsed object and typed primitives', () => {
    expect(processTwig('{{ o }}', { o: { a: 1, nested: { b: 2 } } }, false, true)).toEqual({ a: 1, nested: { b: 2 } });
    expect(processTwig('{{ n }}', { n: 5 }, false, true)).toBe(5);
    expect(processTwig('{{ b }}', { b: true }, false, true)).toBe(true);
  });

  it('returns a plain string when the result is not JSON', () => {
    expect(processTwig('{{ s }}', { s: 'hi' }, false, true)).toBe('hi');
  });

  it('supports the object_as_json filter explicitly', () => {
    const result = processTwig('Data: {{ data | object_as_json }}', { data: { key: 'value' } }, false, true);

    expect(result).toBe(`Data: ${JSON.stringify({ key: 'value' })}`);
  });
});

describe('processTwig — hyphenated source tokens', () => {
  it('resolves a hyphenated <type>_<idRef> token instead of subtracting', () => {
    expect(
      processTwig('X {{ apiContainer_products-api.data.name }} Y', {
        'apiContainer_products-api': { data: { name: 'hello' } }
      })
    ).toBe('X hello Y');
  });

  it('resolves a hyphen in the first and in a later segment', () => {
    expect(processTwig('{{ node_flow-1.my-field }}', { 'node_flow-1': { 'my-field': 'ok' } })).toBe('ok');
  });

  it('keeps a hyphenated miss with keepEmptyTokens and resolves it asRaw', () => {
    expect(processTwig('{{ list_card-1.item.missing }}', {}, true)).toBe('{{ list_card-1.item.missing }}');
    expect(processTwig('{{ list_card-1.item }}', { 'list_card-1': { item: { a: 1 } } }, false, true)).toEqual({ a: 1 });
  });
});

describe('processTwig — {% if %} control flow (the only non-interpolation syntax in the schemas)', () => {
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

  it('reproduces the real seed transformer that appends "(You)" for the current user', () => {
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
});

describe('hasValidToken — non-strict (detection inside text)', () => {
  it('detects a token, with spaces, nested paths, defaults and inside text', () => {
    expect(hasValidToken('{{ token }}')).toBe(true);
    expect(hasValidToken('{{          token        }}')).toBe(true);
    expect(hasValidToken('{{test.abc.def}}')).toBe(true);
    expect(hasValidToken("{{ test.pp ?? 'nice' }}")).toBe(true);
    expect(hasValidToken('this is a test {{ token }}')).toBe(true);
  });

  it('detects a hyphenated source token', () => {
    expect(hasValidToken('{{ list_card-1.item }}')).toBe(true);
  });

  it('rejects a numeric token, a missing value and a non-string', () => {
    expect(hasValidToken('{{123}}')).toBe(false);
    expect(hasValidToken('{{1a}}')).toBe(false);
    expect(hasValidToken(undefined)).toBe(false);
    expect(hasValidToken('plain text')).toBe(false);
  });
});

describe('hasValidToken — strict (builder binding-mode toggle)', () => {
  it('accepts only a whole-string single token', () => {
    expect(hasValidToken('{{ token }}', true)).toBe(true);
    expect(hasValidToken('{{ test.abc.def }}', true)).toBe(true);
    expect(hasValidToken("{{ test.pp ?? 'nice' }}", true)).toBe(true);
  });

  it('rejects a token inside surrounding text and an invalid token', () => {
    expect(hasValidToken('this is {{ token }}', true)).toBe(false);
    expect(hasValidToken('{{123}}', true)).toBe(false);
  });
});

// Templates are user-written and frequently mistyped. Detection must accept every well-formed token regardless of
// spacing and reject the malformed ones, and processTwig must never throw — it leaves anything it cannot resolve
// exactly as written.

describe('robustness — well-formed tokens across spacing', () => {
  const context = { var1: 'V', a: { b: 'AB' } };

  it.each(['{{var1}}', '{{ var1}}', '{{var1 }}', '{{ var1 }}', '{{   var1   }}', '{{\tvar1\n}}'])(
    'detects and resolves %j regardless of surrounding whitespace',
    template => {
      expect(hasValidToken(template)).toBe(true);
      expect(processTwig(template, context)).toBe('V');
    }
  );

  it('resolves a nested path with any spacing', () => {
    expect(processTwig('{{a.b}}', context)).toBe('AB');
    expect(processTwig('{{  a.b  }}', context)).toBe('AB');
  });
});

describe('robustness — malformed tokens are rejected and left untouched', () => {
  const malformed = [
    '{{}}',
    '{{ }}',
    '{{1var}}',
    '{{var 1}}',
    '{{ var 1 }}',
    '{{var.1}}',
    '{{ var1. }}',
    '{{ .var1 }}',
    '{{ var1 | }}',
    '{{ var1',
    '{{ var1 }',
    '{ var1 }}'
  ];

  it.each(malformed)('reports %j as not a valid token', template => {
    expect(hasValidToken(template)).toBe(false);
    expect(hasValidToken(template, true)).toBe(false);
  });

  it.each(malformed)('leaves %j untouched instead of throwing', template => {
    expect(() => processTwig(template, { var1: 'V' })).not.toThrow();
    expect(processTwig(template, { var1: 'V' })).toBe(template);
  });
});

describe('robustness — {% if %} blocks tolerate malformed and nested input', () => {
  const context = { source: 's', a: { b: 'AB' }, x: 5, y: 3 };

  it('supports the relational operators, degrading an unknown path to false', () => {
    expect(processTwig('{% if x > y %}G{% endif %}', context)).toBe('G');
    expect(processTwig('{% if x < y %}L{% else %}NL{% endif %}', context)).toBe('NL');
    expect(processTwig('{% if x >= 5 %}GE{% endif %}', context)).toBe('GE');
    expect(processTwig('{% if missing %}U{% else %}NU{% endif %}', context)).toBe('NU');
  });

  it('resolves nested blocks inner-first', () => {
    expect(processTwig('{% if a %}{% if source %}N{% endif %}{% endif %}', {})).toBe('');
    expect(processTwig('{% if source %}[{% if x == 5 %}IN{% endif %}]{% endif %}', context)).toBe('[IN]');
    expect(processTwig('{% if source %}{% if y == 5 %}A{% else %}B{% endif %}{% endif %}', context)).toBe('B');
  });

  it.each([
    '{% if %}empty{% endif %}',
    '{% if source %}no endif here',
    'a{% endif %}b',
    'a{% else %}b',
    '{% if source %}A{% else %}B',
    '{% for item in list %}L{% endfor %}'
  ])('leaves the malformed or unsupported block %j untouched without throwing', template => {
    expect(() => processTwig(template, context)).not.toThrow();
    expect(processTwig(template, context)).toBe(template);
  });
});
