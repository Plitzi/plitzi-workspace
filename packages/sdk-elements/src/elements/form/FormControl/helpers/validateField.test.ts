import { describe, expect, it } from 'vitest';

import { REQUIRED_MESSAGE, validateField } from './validateField';

import type { FieldRules } from './validateField';

const rules = (overrides: Partial<FieldRules> = {}): FieldRules => ({
  required: false,
  minLength: 0,
  maxLength: 0,
  pattern: '',
  patternMessage: '',
  matches: '',
  matchesMessage: '',
  ...overrides
});

describe('validateField', () => {
  describe('required', () => {
    it('refuses a blank required value', () => {
      expect(validateField('', rules({ required: true }), {})).toBe(REQUIRED_MESSAGE);
      expect(validateField(undefined, rules({ required: true }), {})).toBe(REQUIRED_MESSAGE);
    });

    it('treats an unticked required checkbox as blank', () => {
      expect(validateField(false, rules({ required: true }), {})).toBe(REQUIRED_MESSAGE);
      expect(validateField(true, rules({ required: true }), {})).toBe('');
    });

    it('accepts a blank optional value whatever else it asks for', () => {
      expect(validateField('', rules({ minLength: 10, pattern: '\\d+', matches: 'password' }), { password: 'x' })).toBe(
        ''
      );
    });
  });

  describe('length', () => {
    it('refuses a value shorter than the minimum, and says by how much it has to grow', () => {
      expect(validateField('short', rules({ minLength: 10 }), {})).toBe('Use at least 10 characters');
      expect(validateField('long enough', rules({ minLength: 10 }), {})).toBe('');
    });

    it('refuses a value longer than the maximum', () => {
      expect(validateField('a'.repeat(6), rules({ maxLength: 5 }), {})).toBe('Use at most 5 characters');
      expect(validateField('a'.repeat(5), rules({ maxLength: 5 }), {})).toBe('');
    });

    it('counts what a person typed, not UTF-16 units', () => {
      expect(validateField('🔑🔑🔑', rules({ maxLength: 3 }), {})).toBe('');
      expect(validateField('🔑🔑', rules({ minLength: 3 }), {})).toBe('Use at least 3 characters');
    });

    it('reads a number as the text it was typed as', () => {
      expect(validateField(12345, rules({ minLength: 6 }), {})).toBe('Use at least 6 characters');
    });
  });

  describe('pattern', () => {
    it('matches the whole value, without the author anchoring it', () => {
      expect(validateField('abc123', rules({ pattern: '[a-z]+' }), {})).toBe('This is not in the expected format');
      expect(validateField('abc', rules({ pattern: '[a-z]+' }), {})).toBe('');
    });

    it('says what the author asked it to say', () => {
      expect(validateField('1', rules({ pattern: '[a-z]+', patternMessage: 'Letters only' }), {})).toBe('Letters only');
    });

    it('refuses every value when the expression does not compile, instead of guarding nothing', () => {
      expect(validateField('anything', rules({ pattern: '([a-z' }), {})).toBe('This is not in the expected format');
    });
  });

  describe('matches', () => {
    it('refuses a value that does not repeat the named control', () => {
      const values = { password: 'correct horse battery' };

      expect(validateField('correct horse', rules({ matches: 'password' }), values)).toBe('This does not match');
      expect(validateField('correct horse battery', rules({ matches: 'password' }), values)).toBe('');
    });

    it('says what the author asked it to say', () => {
      expect(
        validateField('b', rules({ matches: 'password', matchesMessage: 'The passwords do not match' }), {
          password: 'a'
        })
      ).toBe('The passwords do not match');
    });

    it('treats a control that has not been typed into as empty', () => {
      expect(validateField('a', rules({ matches: 'password' }), {})).toBe('This does not match');
    });
  });

  it('reports the first rule broken, in the order a person fixes them', () => {
    const all = rules({ required: true, minLength: 10, pattern: '\\S+', matches: 'password' });

    expect(validateField('has space', all, { password: 'x' })).toBe('Use at least 10 characters');
    expect(validateField('has spaces in it', all, { password: 'x' })).toBe('This is not in the expected format');
    expect(validateField('nospacesinit', all, { password: 'x' })).toBe('This does not match');
  });
});
