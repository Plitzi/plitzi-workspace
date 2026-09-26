import { describe, expect, it } from 'vitest';

import {
  PAINTED_STATE_BUDGET,
  paintedEntryFromCookies,
  paintedKeys,
  paintedStateCookieName,
  paintedStateFor,
  writePaintedEntry
} from './paintedState';

const header = (name: string, value: unknown): string => `a=1; ${name}=${encodeURIComponent(JSON.stringify(value))}`;

describe('paintedStateCookieName', () => {
  // A cookie's scope has no port: two spaces on `localhost` would otherwise read each other's.
  it('carries the port, when the host has one', () => {
    expect(paintedStateCookieName(0, 'localhost:4016')).toBe('plitzi_0_painted_4016');
    expect(paintedStateCookieName(7, 'pizarra.plitzi.app')).toBe('plitzi_7_painted');
    expect(paintedStateCookieName(7, undefined)).toBe('plitzi_7_painted');
  });
});

describe('paintedKeys', () => {
  it('reads the declared keys, and nothing that is not one', () => {
    expect(paintedKeys({ paintedState: ['toolPick', '', 3, 'name'] })).toEqual(new Set(['toolPick', 'name']));
    expect(paintedKeys({ paintedState: 'toolPick' })).toEqual(new Set());
    expect(paintedKeys(undefined)).toEqual(new Set());
  });
});

describe('paintedEntryFromCookies', () => {
  it('reads an entry', () => {
    expect(paintedEntryFromCookies(header('p', { owner: '', values: { a: 1 } }), 'p')).toEqual({
      owner: '',
      values: { a: 1 }
    });
  });

  // The cookie is the visitor's to edit: a shape that is not an entry is no entry.
  it.each([
    ['not JSON', 'p=%7Bnope'],
    ['no owner', header('p', { values: { a: 1 } })],
    ['values not an object', header('p', { owner: '', values: [1] })],
    ['absent', 'a=1']
  ])('answers nothing for a cookie that is %s', (_label, cookies) => {
    expect(paintedEntryFromCookies(cookies, 'p')).toBeUndefined();
  });
});

describe('paintedStateFor', () => {
  const keys = new Set(['toolPick', 'name']);

  it('answers only the keys the space declares', () => {
    const cookies = header('p', { owner: 'user:7', values: { toolPick: 'star', admin: true } });

    expect(paintedStateFor(cookies, 'p', keys)).toEqual({ toolPick: 'star' });
  });

  it('answers nothing for a space that declares no keys, or a cookie with none of them', () => {
    const cookies = header('p', { owner: '', values: { toolPick: 'star' } });

    expect(paintedStateFor(cookies, 'p', new Set())).toBeUndefined();
    expect(paintedStateFor(header('p', { owner: '', values: { other: 1 } }), 'p', keys)).toBeUndefined();
  });
});

describe('writePaintedEntry', () => {
  it('writes an entry the reader reads back', () => {
    expect(writePaintedEntry('w', { owner: '', values: { toolPick: 'star' } })).toBe('written');
    expect(paintedEntryFromCookies(document.cookie, 'w')).toEqual({ owner: '', values: { toolPick: 'star' } });
  });

  it('refuses an entry over the budget, and removes the one there', () => {
    writePaintedEntry('big', { owner: '', values: { toolPick: 'star' } });

    expect(writePaintedEntry('big', { owner: '', values: { name: 'x'.repeat(PAINTED_STATE_BUDGET) } })).toBe(
      'too-large'
    );
    expect(paintedEntryFromCookies(document.cookie, 'big')).toBeUndefined();
  });
});
