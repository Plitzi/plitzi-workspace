import { describe, expect, it } from 'vitest';

import { credentialsFromEnv } from './credentials';

describe('credentialsFromEnv', () => {
  it('reads the credentials a project keeps in its environment, by id', () => {
    expect(
      credentialsFromEnv({ PLITZI_CREDENTIALS: '{"google":{"clientId":"id","clientSecret":"secret"}}' })
    ).toEqual({ google: { clientId: 'id', clientSecret: 'secret' } });
    expect(credentialsFromEnv({})).toEqual({});
    expect(credentialsFromEnv({ PLITZI_CREDENTIALS: '  ' })).toEqual({});
  });

  /** A value that does not read would leave every credential missing, and the integration failing far from here. */
  it('refuses a value it cannot read, saying how it is written', () => {
    expect(() => credentialsFromEnv({ PLITZI_CREDENTIALS: '{google' })).toThrow('PLITZI_CREDENTIALS is not JSON');
    expect(() => credentialsFromEnv({ PLITZI_CREDENTIALS: '["google"]' })).toThrow('is one object');
    expect(() => credentialsFromEnv({ PLITZI_CREDENTIALS: '{"google":{"port":443}}' })).toThrow(
      '"google" is an object of strings'
    );
  });
});
