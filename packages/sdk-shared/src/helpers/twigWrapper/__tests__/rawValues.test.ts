import { describe, expect, it } from 'vitest';

import { processTwig } from '../index';

/**
 * What a template reads as when its value is wanted rather than its text — a flow step's params. A number is handed on
 * as a number only when it IS that number: text that would not read back the same stays text.
 */
describe('processTwig as a raw value', () => {
  const raw = (template: string, scope: Record<string, unknown>) => processTwig(template, scope, false, true);

  it('hands on a number, a boolean and an object as what they are', () => {
    expect(raw('{{ age }}', { age: '30' })).toBe(30);
    expect(raw('{{ on }}', { on: 'true' })).toBe(true);
    expect(raw('{{ doc }}', { doc: '{"a":1}' })).toEqual({ a: 1 });
  });

  /** A second-factor code, a PIN, a zip code: `012345` sent as `12345` is a different one. */
  it('keeps a number with a leading zero as the text it was typed as', () => {
    expect(raw('{{ code }}', { code: '012345' })).toBe('012345');
  });

  it('keeps a number too long to hold exactly as its text, not the nearest double', () => {
    expect(raw('{{ id }}', { id: '12345678901234567890' })).toBe('12345678901234567890');
  });
});
