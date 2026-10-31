import { useCallback } from 'react';

import type { E2eAccount } from '@plitzi/sdk-shared';

export type AccountRowProps = {
  account: E2eAccount;
  locked: boolean;
  onEdit: (id: string) => void;
  onRemove: (id: string) => void;
};

/** One test account in the list: its id, and what it may — its roles and permissions — in a line. */
const AccountRow = ({ account, locked, onEdit, onRemove }: AccountRowProps) => {
  const handleEdit = useCallback(() => onEdit(account.id), [account.id, onEdit]);
  const handleRemove = useCallback(() => onRemove(account.id), [account.id, onRemove]);
  const may = [...(account.roles ?? []), ...(account.permissions ?? [])];

  return (
    <li className="flex items-center gap-2 py-1.5">
      <i className="fa-solid fa-user-check text-xs text-zinc-400" />
      <div className="flex min-w-0 grow flex-col">
        <span className="truncate font-mono text-xs font-medium text-zinc-900 dark:text-zinc-100">{account.id}</span>
        <span className="truncate text-[11px] text-zinc-500 dark:text-zinc-400">
          {may.length > 0 ? may.join(' · ') : 'Signed in, with no role or permission'}
        </span>
      </div>
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
    </li>
  );
};

export default AccountRow;
