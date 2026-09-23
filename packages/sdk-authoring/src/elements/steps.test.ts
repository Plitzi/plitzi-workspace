import { describe, expect, it } from 'vitest';

import { closeModal, onLoad, onPageLoad, openModal } from './steps';

describe('element trigger builders', () => {
  it('keeps the generic load event and exposes the page-specific one without raw action strings', () => {
    expect(onLoad()).toMatchObject({ type: 'trigger', action: 'onLoad', title: 'On Load' });
    expect(onPageLoad()).toMatchObject({
      type: 'trigger',
      action: 'onPageLoad',
      title: 'On Page Load',
      preview: { pageId: '', routeParams: '', queryParams: '' }
    });
  });

  it('opens and closes a modal by its id, handing it what it should show', () => {
    expect(openModal('credits', 'Thanks')).toEqual({
      type: 'callback',
      action: 'openModal',
      title: 'Open Modal',
      on: 'credits',
      params: { metadata: 'Thanks' }
    });
    expect(closeModal('credits')).toMatchObject({ type: 'callback', action: 'closeModal', on: 'credits', params: {} });
  });
});
