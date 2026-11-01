import { describe, expect, it } from 'vitest';

import { sentenceOf } from './sentences';

// A press on a map's canvas lands on a point of it: said, where a centre is said by the element alone.
describe('a click as a person reads it', () => {
  it('says where in the element it lands, when not its centre', () => {
    expect(sentenceOf({ kind: 'click', element: 'map', point: { x: 30, y: 60 } }).parts).toEqual([
      { text: 'Click' },
      { element: 'map' },
      { text: 'at' },
      { value: '30% across, 60% down' }
    ]);
    expect(sentenceOf({ kind: 'click', element: 'add' }).parts).toEqual([{ text: 'Click' }, { element: 'add' }]);
  });
});
