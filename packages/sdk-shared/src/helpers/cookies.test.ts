import { describe, expect, it } from 'vitest';

import { cookieFromHeader } from './cookies';

describe('cookieFromHeader', () => {
  it('finds a cookie by its exact name, decoded', () => {
    expect(cookieFromHeader('a=1; theme=dark; b=2', 'theme')).toBe('dark');
    expect(cookieFromHeader('themed=dark; my_theme=light', 'theme')).toBeUndefined();
    expect(cookieFromHeader('v=%7B%22a%22%3A1%7D', 'v')).toBe('{"a":1}');
  });

  it('answers nothing for no header, no such cookie, or a value that does not decode', () => {
    expect(cookieFromHeader(undefined, 'a')).toBeUndefined();
    expect(cookieFromHeader('', 'a')).toBeUndefined();
    expect(cookieFromHeader('a=%E0%A4%A', 'a')).toBeUndefined();
  });
});
