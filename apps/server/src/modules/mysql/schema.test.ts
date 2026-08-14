import { describe, expect, it } from 'vitest';

import { resolveTables, tableNames } from './config';
import { SCHEMA_VERSION, schemaStatements } from './schema';

describe('table naming', () => {
  it('prefixes every table, and quotes every name', () => {
    const tables = resolveTables('acme_');

    for (const name of Object.values(tables)) {
      expect(name).toMatch(/^`acme_[a-z_]+`$/);
    }

    expect(tableNames('acme_').account).toBe('acme_account');
  });

  it('names nothing when no prefix was asked for', () => {
    expect(resolveTables().account).toBe('`account`');
  });
});

describe('schema statements', () => {
  const sql = schemaStatements(resolveTables()).join('\n');

  it('creates every table the adapters read', () => {
    for (const name of Object.values(tableNames())) {
      if (name !== 'schema_version') {
        expect(sql).toContain(`CREATE TABLE IF NOT EXISTS \`${name}\``);
      }
    }
  });

  /**
   * A JWT's length is set by its `aud` claim — one host per environment — so a refresh token on a stack with seven
   * audiences is 549 characters. `VARCHAR(512)` kills every login on the deployment with the most environments and
   * nowhere else, which is as late and as confusing as this fails.
   */
  it('stores credentials as TEXT, never VARCHAR', () => {
    expect(sql).toContain('token TEXT NOT NULL');
    expect(sql).toContain('refresh_token TEXT');
    // The single-use reset and validation tokens are deliberately VARCHAR: they are short opaque strings this
    // server generates, not JWTs whose length follows their claims.
    expect(sql).not.toMatch(/\brefresh_token VARCHAR/);
    expect(sql).not.toMatch(/^\s+token VARCHAR/m);
  });

  /** A signed INT runs out in 2038, and the render credential is the one allowed to be given a far-future date. */
  it('stores unix seconds as BIGINT, never INT', () => {
    expect(sql).toMatch(/expires_at BIGINT NOT NULL/);
    expect(sql).toMatch(/refresh_expires_at BIGINT/);
    expect(sql).not.toMatch(/expires_at INT/);
  });

  it('indexes the columns every lookup filters on', () => {
    expect(sql).toContain('KEY session_token (token(191))');
    expect(sql).toContain('KEY session_refresh_token (refresh_token(191))');
    expect(sql).toContain('KEY space_token_token (token(191))');
  });

  /**
   * Sessions are rows, not columns on the account. A pair on the account row means signing in on a phone signs you
   * out on a laptop, and "sign out my other devices" cannot be built at all.
   */
  it('keeps sessions out of the account table', () => {
    const account = sql.slice(sql.indexOf('`account` ('), sql.indexOf('CREATE TABLE IF NOT EXISTS `session`'));

    expect(account).not.toContain('access_token');
    expect(account).not.toContain('refresh_token');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS `session`');
  });

  it('deletes an account\u2019s sessions with it', () => {
    const session = sql.slice(sql.indexOf('`session` ('));

    expect(session).toMatch(/FOREIGN KEY \(account_id\) REFERENCES `account` \(id\) ON DELETE CASCADE/);
  });

  /** Spaces are not this schema's — a deployment keeps them wherever it keeps them. */
  it('puts no foreign key on space_id', () => {
    expect(sql).not.toMatch(/FOREIGN KEY \(space_id\)/);
  });

  it('applies nothing when the database is already current', () => {
    expect(schemaStatements(resolveTables(), SCHEMA_VERSION)).toEqual([]);
  });
});
