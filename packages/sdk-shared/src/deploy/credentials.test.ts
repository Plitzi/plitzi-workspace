import { describe, expect, it } from 'vitest';

import { deployCredentialProblems, isDeployCredentialKind } from './credentials';

describe('a deploy credential', () => {
  it('names every field it lacks, and a choice it does not take', () => {
    expect(deployCredentialProblems('ftp', { host: 'ftp.example.com', secure: 'maybe' })).toEqual([
      'User is required',
      'Password is required',
      'Security is one of explicit, implicit, none'
    ]);
    expect(deployCredentialProblems('github', { token: 'github_pat_x' })).toEqual([]);
  });

  it('is one of the kinds deploys sign in with', () => {
    expect(isDeployCredentialKind('netlify')).toBe(true);
    expect(isDeployCredentialKind('smtp')).toBe(false);
  });
});
