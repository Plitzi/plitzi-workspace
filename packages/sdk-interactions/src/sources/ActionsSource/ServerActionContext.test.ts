import { describe, expect, it } from 'vitest';

import { endedStatusOf } from './ServerActionContext';

describe('endedStatusOf', () => {
  it('keeps the words a run ends with, and reads any other as a run that did not complete', () => {
    expect(endedStatusOf('completed')).toBe('completed');
    expect(endedStatusOf('aborted')).toBe('aborted');
    expect(endedStatusOf(undefined)).toBe('completed');
    expect(endedStatusOf('accepted')).toBe('failed');
    expect(endedStatusOf('done')).toBe('failed');
  });
});
