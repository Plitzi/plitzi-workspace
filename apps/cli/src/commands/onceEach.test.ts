import { describe, expect, it } from 'vitest';

import { onceEach } from './measure';

// A run's designer read one failed action four times a width, once for each element measured after it.
describe('a measure’s lines', () => {
  it('says each once, with how many times it came', () => {
    expect(onceEach(['✗ the action failed', 'a: 10', '✗ the action failed', 'b: 12', '✗ the action failed'])).toEqual([
      '✗ the action failed (×3)',
      'a: 10',
      'b: 12'
    ]);
  });
});
