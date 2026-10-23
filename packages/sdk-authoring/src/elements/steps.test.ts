import { describe, expect, it } from 'vitest';

import { closeModal, onLoad, onPageLoad, openModal, scrollBy, scrollTo, setFieldValue } from './steps';

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

describe('setFieldValue', () => {
  it('writes one control of a form, on the form, by the control’s name', () => {
    expect(setFieldValue('profile-form', 'username', '{{ auth.details.username }}')).toEqual({
      type: 'callback',
      action: 'setFieldValue',
      title: 'Set Field Value',
      on: 'profile-form',
      params: { name: 'username', value: '{{ auth.details.username }}' }
    });
  });
});

// lx-controls: `scrollBy('categories-row', { x: -180 })` was refused by the type, though pixels are what most moves are.
describe('a scroll step', () => {
  it('takes pixels as a number or as text, and a share of the box as text — each held as the editor writes it', () => {
    expect(scrollBy('row', { x: -180 }).params).toEqual({ x: '-180' });
    expect(scrollBy('row', { x: '80%', behavior: 'smooth' }).params).toEqual({ x: '80%', behavior: 'smooth' });
    expect(scrollTo('row', { x: 'start' }).params).toEqual({ x: 'start' });
  });
});
