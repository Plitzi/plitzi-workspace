import { describe, expect, it } from 'vitest';

import { attentionTone, targetAttention } from './targetAttention';

import type { SpaceDeploySummary, SpaceTarget } from '@plitzi/sdk-shared';

const target = (domain: string, extra: Partial<SpaceTarget> = {}): SpaceTarget => ({
  id: 1,
  domain,
  verified: true,
  plitziOwned: false,
  mode: 'spa',
  provider: 'github',
  providerLabel: 'GitHub Pages',
  atomic: true,
  environment: 'production',
  revision: null,
  serves: null,
  rollback: null,
  config: null,
  credential: null,
  bucket: null,
  protected: false,
  hook: false,
  lastDeploy: null,
  running: null,
  update: null,
  locked: null,
  required: null,
  ...extra
});

const deploy = (status: SpaceDeploySummary['status'], error: string | null = null) =>
  ({ status, error, environment: 'production', revision: 4 }) as SpaceDeploySummary;

describe('targetAttention', () => {
  it('says nothing of a target that needs nothing', () => {
    expect(targetAttention([target('a.com'), target('b.plitzi.app', { mode: 'ssr', verified: false })])).toEqual([]);
  });

  it('puts a failed deploy first, then one under way, then the rest', () => {
    const attention = targetAttention([
      target('update.com', {
        update: {
          words: 'The SDK 0.40 is out',
          runs: { sdk: '0.39', react: '19', sdkServer: '0.39' },
          newest: { sdk: '0.40', react: '19', sdkServer: '0.40' }
        }
      }),
      target('running.com', { running: deploy('building') }),
      target('failed.com', { lastDeploy: deploy('failed', 'Bad credentials') })
    ]);

    expect(attention.map(({ domain, tone }) => [domain, tone])).toEqual([
      ['failed.com', 'danger'],
      ['running.com', 'progress'],
      ['update.com', 'warning']
    ]);
    expect(attention[0].words).toBe('Its last deploy failed: Bad credentials');
    expect(attentionTone(attention)).toBe('danger');
  });
});
