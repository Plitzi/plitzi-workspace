import { useCallback } from 'react';

import RoleChip from '../RoleChip';

import type { E2eAccount } from '@plitzi/sdk-shared';

export type AccountRowProps = {
  account: E2eAccount;
  /** The space's visitor roles: one of the account's it no longer has is warned of. */
  spaceRoles: readonly string[];
  locked: boolean;
  onEdit: (id: string) => void;
  onRemove: (id: string) => void;
};

/** One test account in the list: its id and its roles — one the space has removed since, warned of. */
const AccountRow = ({ account, spaceRoles, locked, onEdit, onRemove }: AccountRowProps) => {
  const handleEdit = useCallback(() => onEdit(account.id), [account.id, onEdit]);
  const handleRemove = useCallback(() => onRemove(account.id), [account.id, onRemove]);
  const roles = account.roles ?? [];
  const gone = roles.filter(role => !spaceRoles.includes(role));

  return (
    <li className="flex flex-col gap-1.5 py-2.5">
      <div className="flex items-center gap-2">
        <i className="fa-solid fa-user-check text-xs text-zinc-400" />
        <span className="min-w-0 grow truncate font-mono text-xs font-medium text-zinc-900 dark:text-zinc-100">
          {account.id}
        </span>
        {!locked && (
          <>
            <button
              type="button"
              title={`Edit ${account.id}`}
              className="cursor-pointer px-1 text-xs text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
              onClick={handleEdit}
            >
              <i className="fa-solid fa-pen" />
            </button>
            <button
              type="button"
              title={`Remove ${account.id}`}
              className="cursor-pointer px-1 text-xs text-zinc-500 hover:text-red-600 dark:text-zinc-400 dark:hover:text-red-400"
              onClick={handleRemove}
            >
              <i className="fa-solid fa-trash" />
            </button>
          </>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-1.5 pl-5">
        {roles.length === 0 && (
          <span className="text-[11px] text-zinc-500 dark:text-zinc-400">Signed in, with no role</span>
        )}
        {roles.map(role => (
          <RoleChip key={role} role={role} gone={!spaceRoles.includes(role)} />
        ))}
      </div>
      {gone.length > 0 && (
        <p className="pl-5 text-[11px] text-amber-700 dark:text-amber-300">
          {gone.length === 1
            ? `The space has no role "${gone[0]}" now`
            : `The space has none of ${gone.join(', ')} now`}
          : a journey plays it without — choose one it has.
        </p>
      )}
    </li>
  );
};

export default AccountRow;
