import { describe, expect, it } from 'vitest';

import { deploySteps, deployWords, latestEnvironmentOf, showsWords, targetWhere, versionName } from './helpers';

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

  it('says what a domain shows as its owner reads it', () => {
    expect(showsWords(null)).toBe('Nothing published yet');
    expect(showsWords({ environment: 'main', revision: 0 })).toBe('Shows every change as you save it');
    expect(showsWords({ environment: 'production', revision: 4 })).toBe('Shows Production r4');
  });

  it('keeps the latest changes where the domain is already, or nearest the public the plan allows', () => {
    const open = () => false;

    expect(latestEnvironmentOf('staging', open)).toBe('staging');
    expect(latestEnvironmentOf('main', open)).toBe('production');
    expect(latestEnvironmentOf(undefined, environment => environment !== 'development')).toBe('development');
    expect(latestEnvironmentOf(undefined, () => true)).toBeUndefined();
  });
});
