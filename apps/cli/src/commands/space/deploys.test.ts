import { stripVTControlCharacters } from 'node:util';

import { describe, expect, it } from 'vitest';

import { deployLine, targetLine } from './deploys';

const plain = (text: string) => stripVTControlCharacters(text);

describe('the deploy commands', () => {
  it('say a deploy: when (UTC), where, what, how it ended and why', () => {
    expect(
      plain(
        deployLine({
          id: 7,
          domain: 'example.com',
          status: 'failed',
          environment: 'production',
          revision: 12,
          provider: 'github',
          error: 'Bad credentials',
          url: null,
          kept: false,
          createdAt: Date.UTC(2026, 10, 16, 9, 30) / 1000
        })
      )
    ).toBe('#7  2026-11-16 09:30 UTC  example.com  production r12  failed — Bad credentials');
  });

  it('say a target: where its site is, what it serves, what it asks', () => {
    const target = {
      domain: 'example.com',
      mode: 'spa',
      providerLabel: 'GitHub Pages',
      verified: true,
      serves: { environment: 'production', revision: 12 },
      lastDeploy: null,
      update: { words: 'The SDK 0.40.0 is out (this target runs 0.39.4)' },
      required: null,
      locked: null
    };

    expect(plain(targetLine(target))).toBe(
      'example.com  GitHub Pages (SPA)  serves production r12  The SDK 0.40.0 is out (this target runs 0.39.4)'
    );
    expect(plain(targetLine({ ...target, mode: 'ssr', providerLabel: 'Plitzi', update: null }))).toBe(
      'example.com  Plitzi  serves production r12'
    );
  });
});
