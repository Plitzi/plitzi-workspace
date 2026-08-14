import type { MysqlStore } from '@plitzi/sdk-server/mysql';

/**
 * Two accounts and the roles behind them.
 *
 * This is the part a real deployment replaces with an admin screen, an invitation flow or an import — but it has to
 * exist somewhere, because nothing a visitor can do creates the FIRST account with any authority. Signing up makes
 * an ordinary one.
 *
 * Every call is idempotent, so restarting the server is not a way to break it.
 */
export const seed = async (store: MysqlStore): Promise<void> => {
  const { admin } = store;

  /**
   * A permission is a capability of the ACCOUNT, and a role is a named bundle of them. Neither says anything about
   * a particular space — that is the other half, below, and both halves have to agree before anyone may write.
   */
  await admin.ensureRole('editor', {
    description: 'May change the space',
    permissions: ['spaceRead', 'spaceUpdate']
  });

  await admin.ensureRole('viewer', {
    description: 'May look at the space',
    permissions: ['spaceRead']
  });

  /**
   * `userManage` is the capability the `/auth/admin/*` flows check for. The name is this deployment's — the server
   * takes it from `createAuth({ api: { adminPermission } })` and assumes nothing about what you call yours.
   */
  await admin.ensureRole('admin', {
    description: 'May administer accounts',
    permissions: ['spaceRead', 'spaceUpdate', 'userManage']
  });

  const ada = await admin.ensureAccount({
    username: 'ada',
    email: 'ada@example.test',
    password: 'password',
    verified: true,
    roles: ['editor']
  });

  const grace = await admin.ensureAccount({
    username: 'grace',
    email: 'grace@example.test',
    password: 'password',
    verified: true,
    roles: ['viewer']
  });

  const root = await admin.ensureAccount({
    username: 'root',
    email: 'root@example.test',
    password: 'password',
    verified: true,
    roles: ['admin']
  });

  /**
   * Membership of space 1 — the space this server renders.
   *
   * Both are signed in; only `ada` may change anything, and it takes BOTH facts to say so: the global `spaceUpdate`
   * her account holds, and the role she has inside this space. A capability on its own is not a claim about any
   * particular space, which is what lets somebody edit one space and only read another.
   */
  await admin.addMember(1, ada, 'editor', { owner: true });
  await admin.addMember(1, grace, 'viewer');
  await admin.addMember(1, root, 'admin');
};
