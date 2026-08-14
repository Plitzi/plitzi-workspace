import { execute, selectOne, selectRows } from './query';
import { hashPassword } from '../../core/auth/passwords';

import type { Tables } from './config';
import type { SpaceScope } from '../../core/auth/tokens';
import type { Pool } from 'mysql2/promise';

export interface AccountSeed {
  username: string;
  email: string;
  /** Plain text, hashed here. Omit for an account that signs in through an identity provider and has no password. */
  password?: string;
  verified?: boolean;
  /** Global roles. They must exist — `ensureRole` first, or an unknown name is a mistake worth failing on. */
  roles?: string[];
}

export interface SpaceTokenSeed {
  token: string;
  scope?: SpaceScope;
  isDefault?: boolean;
  origins?: string[];
  expiresAt?: number | null;
  accountId?: number;
}

/**
 * Everything that puts rows in these tables that no request ever will.
 *
 * The auth flows read accounts, roles and memberships; almost none of them create one. Signing up creates an
 * account and that is the whole of it — a role, a permission, a space membership and a space's first credential all
 * come from somewhere else: a seed script, an admin screen, the moment a space is created. That somewhere else
 * needs statements, and a deployment writing them by hand against a schema it did not design is a deployment about
 * to get a join wrong.
 *
 * Every operation is idempotent, because the place they are called from is usually a startup path that runs again.
 */
export const createAdmin = (pool: Pool, t: Tables) => {
  const idOf = async (table: string, name: string): Promise<number | undefined> => {
    const row = await selectOne<{ id: number }>(pool, `SELECT id FROM ${table} WHERE name = ? LIMIT 1`, [name]);

    return row?.id;
  };

  const ensurePermissions = async (names: string[]): Promise<void> => {
    if (names.length === 0) {
      return;
    }

    const values = names.map(() => '(?)').join(', ');
    await execute(pool, `INSERT IGNORE INTO ${t.permission} (name) VALUES ${values}`, names);
  };

  /**
   * Declarative: the permission list given is the permission list the role ends up with. A role that only ever
   * gained permissions could never lose one, and the first thing anybody does with a role is take something away.
   */
  const ensureRole = async (
    name: string,
    options: { permissions?: string[]; description?: string } = {}
  ): Promise<number> => {
    const { permissions = [], description } = options;

    await execute(
      pool,
      `INSERT INTO ${t.role} (name, description) VALUES (?, ?)
       ON DUPLICATE KEY UPDATE description = COALESCE(VALUES(description), description)`,
      [name, description ?? null]
    );

    const roleId = await idOf(t.role, name);
    if (roleId === undefined) {
      throw new Error(`@plitzi/sdk-server/mysql: role "${name}" could not be read back after being written.`);
    }

    await ensurePermissions(permissions);

    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();
      await execute(connection, `DELETE FROM ${t.rolePermission} WHERE role_id = ?`, [roleId]);

      if (permissions.length > 0) {
        const placeholders = permissions.map(() => '?').join(', ');
        await execute(
          connection,
          `INSERT INTO ${t.rolePermission} (role_id, permission_id)
           SELECT ?, id FROM ${t.permission} WHERE name IN (${placeholders})`,
          [roleId, ...permissions]
        );
      }

      await connection.commit();
    } catch (error: unknown) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }

    return roleId;
  };

  const requireRole = async (name: string): Promise<number> => {
    const roleId = await idOf(t.role, name);
    if (roleId === undefined) {
      throw new Error(`@plitzi/sdk-server/mysql: no role named "${name}". Create it with ensureRole() first.`);
    }

    return roleId;
  };

  const grantRole = async (accountId: number, role: string): Promise<void> => {
    const roleId = await requireRole(role);
    await execute(pool, `INSERT IGNORE INTO ${t.accountRole} (account_id, role_id) VALUES (?, ?)`, [accountId, roleId]);
  };

  const revokeRole = async (accountId: number, role: string): Promise<void> => {
    const roleId = await requireRole(role);
    await execute(pool, `DELETE FROM ${t.accountRole} WHERE account_id = ? AND role_id = ?`, [accountId, roleId]);
  };

  /**
   * Keyed by username. The password is re-hashed on every call so a seed stays the source of truth for it — which
   * is what a seed is for, and the reason this must never be pointed at a database where people change their own.
   */
  const ensureAccount = async (seed: AccountSeed): Promise<number> => {
    const passwordHash = seed.password === undefined ? null : await hashPassword(seed.password);

    await execute(
      pool,
      `INSERT INTO ${t.account} (username, email, password_hash, verified) VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         email = VALUES(email),
         password_hash = COALESCE(VALUES(password_hash), password_hash),
         verified = VALUES(verified)`,
      [seed.username, seed.email, passwordHash, seed.verified ? 1 : 0]
    );

    const row = await selectOne<{ id: number }>(pool, `SELECT id FROM ${t.account} WHERE username = ? LIMIT 1`, [
      seed.username
    ]);

    if (!row) {
      throw new Error(`@plitzi/sdk-server/mysql: account "${seed.username}" could not be read back after writing.`);
    }

    for (const role of seed.roles ?? []) {
      await grantRole(row.id, role);
    }

    return row.id;
  };

  return {
    ensurePermissions,
    ensureRole,
    grantRole,
    revokeRole,
    ensureAccount,

    /** Membership of one space, with the role that decides what they may do inside it. */
    addMember: async (
      spaceId: number,
      accountId: number,
      role: string,
      options: { owner?: boolean } = {}
    ): Promise<void> => {
      const roleId = await requireRole(role);
      await execute(
        pool,
        `INSERT INTO ${t.spaceMember} (space_id, account_id, role_id, is_owner) VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE role_id = VALUES(role_id), is_owner = VALUES(is_owner)`,
        [spaceId, accountId, roleId, options.owner ? 1 : 0]
      );
    },

    removeMember: async (spaceId: number, accountId: number): Promise<void> => {
      await execute(pool, `DELETE FROM ${t.spaceMember} WHERE space_id = ? AND account_id = ?`, [spaceId, accountId]);
    },

    listMembers: (spaceId: number): Promise<{ accountId: number; username: string; role: string; owner: boolean }[]> =>
      selectRows(
        pool,
        `SELECT sm.account_id AS accountId, a.username, r.name AS role, sm.is_owner AS owner
           FROM ${t.spaceMember} sm
           JOIN ${t.account} a ON a.id = sm.account_id
           JOIN ${t.role} r ON r.id = sm.role_id
          WHERE sm.space_id = ?`,
        [spaceId]
      ),

    /**
     * A space's credential row. Replaces the default one rather than adding a second: exactly one row per space
     * carries `is_default`, and two of them make `loadDefault` answer whichever the database happened to return.
     */
    createSpaceToken: async (spaceId: number, seed: SpaceTokenSeed): Promise<number> => {
      const isDefault = seed.isDefault ?? true;

      if (isDefault) {
        await execute(pool, `DELETE FROM ${t.spaceToken} WHERE space_id = ? AND is_default = 1`, [spaceId]);
      }

      const result = await execute(
        pool,
        `INSERT INTO ${t.spaceToken} (space_id, token, scope, is_default, origins, expires_at, account_id)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          spaceId,
          seed.token,
          seed.scope ?? 'render',
          isDefault ? 1 : 0,
          (seed.origins ?? []).join(','),
          seed.expiresAt ?? null,
          seed.accountId ?? null
        ]
      );

      return result.insertId;
    }
  };
};

export type MysqlAdmin = ReturnType<typeof createAdmin>;
