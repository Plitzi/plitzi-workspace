import { describe, expect, it } from 'vitest';

import { isSingleEmailAddress, readSmtpCredential } from './smtp';

const credential = {
  host: 'smtp.example.test',
  port: '587',
  security: 'starttls',
  username: 'ana',
  password: 'secret',
  fromEmail: 'hola@example.test',
  fromName: 'Ceniza'
};

const keysOf = (data: Record<string, unknown>) => readSmtpCredential(data).problems.map(problem => problem.key);

describe('readSmtpCredential', () => {
  it('reads a credential, which stores text, as the settings a connection is opened with', () => {
    expect(readSmtpCredential(credential)).toEqual({ settings: { ...credential, port: 587 }, problems: [] });
  });

  /** One problem per key, so the form puts each sentence under its own field. */
  it('names the key each problem is about', () => {
    expect(
      keysOf({
        ...credential,
        host: 'smtp://smtp.example.test:587',
        port: '70000',
        security: 'ssl',
        fromEmail: 'hola@example.test, eve@example.test'
      })
    ).toEqual(['host', 'port', 'security', 'fromEmail']);
  });

  it('refuses a password with no user, and accepts a relay that needs neither', () => {
    expect(keysOf({ ...credential, username: '' })).toEqual(['username']);
    expect(keysOf({ ...credential, username: '', password: '' })).toEqual([]);
  });

  /** The sender's name is a header: a line break in it would be a second one. */
  it('refuses a sender name that is more than one line', () => {
    expect(keysOf({ ...credential, fromName: 'Ceniza\nBcc: eve@example.test' })).toEqual(['fromName']);
  });

  it('reads nothing as every required key missing', () => {
    expect(keysOf({})).toEqual(['host', 'port', 'security', 'fromEmail']);
  });
});

describe('isSingleEmailAddress', () => {
  it('accepts one address and nothing a header could be split on', () => {
    expect(isSingleEmailAddress('ana@example.test')).toBe(true);
    expect(isSingleEmailAddress('ana@example.test,eve@example.test')).toBe(false);
    expect(isSingleEmailAddress('Ana <ana@example.test>')).toBe(false);
    expect(isSingleEmailAddress('ana@localhost')).toBe(false);
  });
});
