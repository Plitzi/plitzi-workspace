import { describe, expect, it } from 'vitest';

import { deploySteps, deployWords, targetWhere, versionName } from './helpers';

describe('the publish sheet’s words', () => {
  it('names a version and where a target is', () => {
    expect(versionName({ environment: 'main', revision: 0 })).toBe('the draft');
    expect(targetWhere({ mode: 'spa', providerLabel: 'GitHub Pages' })).toBe('GitHub Pages · Single-page app');
    expect(targetWhere({ mode: 'ssr', providerLabel: 'Plitzi' })).toBe('Plitzi');
  });

  it('ticks a deploy’s steps as it goes', () => {
    expect(deploySteps('uploading').map(step => step.state)).toEqual(['done', 'done', 'current', 'todo']);
    expect(deploySteps('succeeded').map(step => step.state)).toEqual(['done', 'done', 'done', 'done']);
    expect(deployWords('failed')).toEqual({ words: 'Failed', going: false });
  });
});
