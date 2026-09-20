import { describe, expect, it } from 'vitest';

import { onLoad, onPageLoad } from './steps';

describe('element trigger builders', () => {
  it('keeps the generic load event and exposes the page-specific one without raw action strings', () => {
    expect(onLoad()).toMatchObject({ type: 'trigger', action: 'onLoad', title: 'On Load' });
    expect(onPageLoad()).toMatchObject({ type: 'trigger', action: 'onPageLoad', title: 'onPageLoad' });
  });
});
