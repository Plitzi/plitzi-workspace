/* eslint-disable quotes */
import { expect, describe, vi, it } from 'vitest';

import { processTwig, hasValidToken } from './twigWrapper';

vi.mock('plitziSdkFederation/usePlitziServiceContext');

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
