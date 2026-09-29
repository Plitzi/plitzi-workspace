import { describe, expect, it } from 'vitest';

import { matchRoute } from './routes';

describe('which route answers a request', () => {
  const keys = ['GET /boards', 'GET /boards/:board', 'POST /boards/:board/cards/:card', 'GET /files/a b'];

  it('is the declared one with the same method and segments, its params decoded', () => {
    expect(matchRoute(keys, 'GET', '/boards/team%20a')).toEqual({
      key: 'GET /boards/:board',
      params: { board: 'team a' }
    });
    expect(matchRoute(keys, 'POST', '/boards/x/cards/7')).toEqual({
      key: 'POST /boards/:board/cards/:card',
      params: { board: 'x', card: '7' }
    });
    expect(matchRoute(keys, 'GET', '/boards')).toEqual({ key: 'GET /boards', params: {} });
  });

  it('is none for another method, another depth, an empty param or a malformed path', () => {
    expect(matchRoute(keys, 'DELETE', '/boards/x')).toBeUndefined();
    expect(matchRoute(keys, 'GET', '/boards/x/y')).toBeUndefined();
    expect(matchRoute(keys, 'GET', '/boards/')).toBeUndefined();
    expect(matchRoute(keys, 'GET', '/boards/%E0%A4%A')).toBeUndefined();
  });
});
