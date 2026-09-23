import { describe, expect, it } from 'vitest';

import { checkboxParams } from './checkboxParams';
import dateConverter from './dateConverter';

describe('checkbox params', () => {
  it('reads a checkbox written as text as the boolean it means', () => {
    expect(checkboxParams(dateConverter, { asAge: 'false', isUnix: 'true' })).toEqual({ asAge: false, isUnix: true });
  });

  it('leaves real booleans, other text and other params alone', () => {
    const params = { asAge: true, format: 'false' };

    expect(checkboxParams(dateConverter, params)).toBe(params);
  });

  // The failure it exists for: an ISO date with `isUnix: 'false'` came back as the raw string.
  it('makes dateConverter read an ISO date when told it is not unix', () => {
    const params = checkboxParams(dateConverter, { format: 'yyyy-MM-dd', isUnix: 'false', isUtc: 'true' });

    expect(dateConverter.callback('2026-09-23T10:00:00.000Z', params ?? {}, {}, {})).toBe('2026-09-23');
  });
});
