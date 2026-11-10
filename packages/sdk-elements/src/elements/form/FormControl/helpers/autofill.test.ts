import { describe, expect, it } from 'vitest';

import { autocompleteOf } from './autofill';

describe('what a field tells a password manager', () => {
  it('names the account’s current password on a password field the author left alone', () => {
    expect(autocompleteOf(true, 'password', true)).toBe('current-password');
  });

  it('writes the token the author named', () => {
    expect(autocompleteOf('new-password', 'password', true)).toBe('new-password');
    expect(autocompleteOf('username', 'text', true)).toBe('username');
    expect(autocompleteOf('one-time-code', 'text', true)).toBe('one-time-code');
  });

  it('leaves any other field to the browser, and asks it not to fill when told', () => {
    expect(autocompleteOf(true, 'text', true)).toBe('on');
    expect(autocompleteOf(false, 'password', true)).toBe('off');
  });

  it('fills nothing in the builder’s canvas', () => {
    expect(autocompleteOf('username', 'text', false)).toBe('off');
    expect(autocompleteOf(true, 'password', false)).toBe('off');
  });
});
