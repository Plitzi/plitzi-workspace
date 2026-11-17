import { describe, expect, it } from 'vitest';

import { CREDENTIAL_GROUPS, CREDENTIAL_KINDS, isDeployCredentialKind } from './kinds';
import { credentialData, credentialProblems } from './problems';

describe('a credential', () => {
  it('names every field it lacks, a choice it does not take and a shape its provider never issues', () => {
    expect(credentialProblems('ftp', { host: 'ftp.example.com', secure: 'maybe' })).toEqual([
      { key: 'user', message: 'User is required' },
      { key: 'password', message: 'Password is required' },
      { key: 'secure', message: 'Security is one of explicit, implicit, none' }
    ]);
    expect(credentialProblems('github', { token: 'github_pat_x' })).toEqual([]);
    expect(credentialProblems('r2', { accessKeyId: 'AKIA1234', secretAccessKey: 'a'.repeat(64) })).toEqual([
      { key: 'accessKeyId', message: 'Access Key ID is 32 hexadecimal characters; this one is 8 characters' }
    ]);
  });

  it('says a signed token pasted where a key belongs as such', () => {
    const token = `${'a'.repeat(40)}.${'b'.repeat(40)}.${'c'.repeat(40)}`;

    expect(credentialProblems('s3', { accessKeyId: 'AKIAIOSFODNN7EXAMPLE', secretAccessKey: token })).toEqual([
      { key: 'secretAccessKey', message: 'Secret Access Key is 40 characters; this one is a signed token, not a key' }
    ]);
  });

  it('asks a site password for a user and a password, and keeps only those', () => {
    expect(credentialProblems('ssr', { user: 'x' })).toEqual([
      { key: 'user', message: 'User is 2 to 20 characters; this one is 1 characters' },
      { key: 'pass', message: 'Password is required' }
    ]);
    expect(credentialData('ssr', { user: ' ana ', pass: ' secret ', type: 'left behind' })).toEqual({
      user: 'ana',
      pass: ' secret '
    });
  });

  it('judges an SMTP server by the rule a flow sends with, each field once', () => {
    expect(
      credentialProblems('smtp', {
        host: 'smtp.example.com',
        port: '587',
        security: 'starttls',
        password: 'p',
        fromEmail: ''
      })
    ).toEqual([
      { key: 'fromEmail', message: 'Send as (email) is required' },
      { key: 'username', message: 'A password needs the user it belongs to' }
    ]);
  });

  it('of an API holds named values of its author’s', () => {
    expect(credentialProblems('custom', {})).toHaveLength(1);
    expect(credentialProblems('custom', { token: 't' })).toEqual([]);
    expect(credentialData('custom', { ' token ': 't', '': 'nameless' })).toEqual({ token: 't' });
  });

  it('is listed in a group the builder offers', () => {
    const groups = new Set(CREDENTIAL_GROUPS.map(group => group.id));

    expect(Object.values(CREDENTIAL_KINDS).filter(kind => !groups.has(kind.group))).toEqual([]);
    expect(isDeployCredentialKind('netlify')).toBe(true);
    expect(isDeployCredentialKind('s3')).toBe(false);
  });
});
