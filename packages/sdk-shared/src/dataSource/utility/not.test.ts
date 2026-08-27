import { describe, expect, it } from 'vitest';

import not from './not';

const invert = (value: unknown): unknown => not.callback(value, {}, {}, {});

describe('the `not` transformer', () => {
  it('inverts a boolean', () => {
    expect(invert(true)).toBe(false);
    expect(invert(false)).toBe(true);
  });

  /**
   * The reason this transformer cannot just be `!value`. A boolean that travelled as text — through a Twig token,
   * a query string, a JSON field somebody stringified — arrives as `"false"`, which JavaScript calls true. Reading
   * it that way shows the element the author asked to hide, and nothing anywhere reports it.
   */
  it('reads a boolean that travelled as text', () => {
    expect(invert('false')).toBe(true);
    expect(invert('False')).toBe(true);
    expect(invert(' false ')).toBe(true);
    expect(invert('0')).toBe(true);
    expect(invert('true')).toBe(false);
    expect(invert('anything else')).toBe(false);
  });

  it('treats nothing at all as false', () => {
    expect(invert(undefined)).toBe(true);
    expect(invert(null)).toBe(true);
    expect(invert('')).toBe(true);
    expect(invert(0)).toBe(true);
  });

  // What an author means by an empty list: nothing to show.
  it('treats an empty array as false and a filled one as true', () => {
    expect(invert([])).toBe(true);
    expect(invert([1])).toBe(false);
  });

  /**
   * Deliberately NOT false. A data source answers `{}` both for "no record" and for a record with no fields, and
   * choosing between those two is a decision this transformer has no way to make correctly.
   */
  it('treats an empty object as true', () => {
    expect(invert({})).toBe(false);
  });

  it('always answers a boolean, never the value it was given', () => {
    expect(invert('text')).toBe(false);
    expect(invert(42)).toBe(false);
  });
});
