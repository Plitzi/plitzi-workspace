import { describe, expect, it } from 'vitest';

import { metadataFromText } from './metadataFromText';

describe('metadataFromText', () => {
  it('takes a JSON object as the modal data', () => {
    expect(metadataFromText('{"id":7,"name":"Nova"}')).toEqual({ id: 7, name: 'Nova' });
  });

  it.each(['42', 'true', 'null', '[1,2]', 'plain words'])('keeps %s as content, as written', text => {
    expect(metadataFromText(text)).toEqual({ content: text });
  });
});
