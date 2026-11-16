import { describe, expect, it } from 'vitest';

import { domainLine, parseVersion, releaseLine, versionName } from './releases';

const plain = (text: string) => text.replace(/\u001b\[[0-9;]*m/g, '');

describe('the releases commands', () => {
  it('name a version the way the builder does', () => {
    expect(versionName({ environment: 'production', revision: 12 })).toBe('production r12');
    expect(versionName({ environment: 'main', revision: 0 })).toBe('the draft');
  });

  it('read --to as environment@revision, and nothing else', () => {
    expect(parseVersion('production@9')).toEqual({ environment: 'production', revision: 9 });
    expect(parseVersion('staging:3')).toEqual({ environment: 'staging', revision: 3 });
    expect(parseVersion('r9')).toBeUndefined();
    expect(parseVersion('prod@9')).toBeUndefined();
  });

  it('list a domain with what it serves and what a rollback would put back', () => {
    expect(
      plain(
        domainLine({
          domain: 'example.com',
          verified: true,
          serves: { environment: 'production', revision: 12 },
          rollback: { environment: 'production', revision: 11 }
        })
      )
    ).toBe('example.com  production r12  rollback: production r11');
    expect(plain(domainLine({ domain: 'new.example.com', verified: false, serves: null, rollback: null }))).toBe(
      'new.example.com  not verified'
    );
  });

  it('list a release with its moment in UTC, what it put back and who', () => {
    expect(
      plain(
        releaseLine({
          environment: 'production',
          revision: 11,
          kind: 'rollback',
          at: 1790000000,
          by: { username: 'ana' }
        })
      )
    ).toBe('2026-09-21 14:13 UTC  rolled back to production r11 · ana');
  });
});
