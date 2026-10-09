import { describe, expect, it } from 'vitest';

import { metadataOf } from './metadataOf';

describe('metadataOf', () => {
  it('takes an object, or a JSON object in text, as the data', () => {
    expect(metadataOf({ id: 7 })).toEqual({ id: 7 });
    expect(metadataOf('{"id":7,"name":"Nova"}')).toEqual({ id: 7, name: 'Nova' });
  });

  it.each(['42', 'true', 'null', '[1,2]', 'plain words'])('keeps the text %s as content, as written', text => {
    expect(metadataOf(text)).toEqual({ content: text });
  });

  it.each([42, false, [1, 2]])('keeps %j as content', value => {
    expect(metadataOf(value)).toEqual({ content: value });
  });

  it('is empty when nothing was handed', () => {
    expect(metadataOf(undefined)).toEqual({});
    expect(metadataOf(null)).toEqual({});
  });
});
