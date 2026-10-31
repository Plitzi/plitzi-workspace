import Button from '@plitzi/plitzi-ui/Button';
import Input from '@plitzi/plitzi-ui/Input';
import Select from '@plitzi/plitzi-ui/Select';
import { useCallback, useState } from 'react';

import { accountFrom, draftOf } from '../../../../accounts';
import RoleChip from '../RoleChip';

import type { AccountDraft } from '../../../../accounts';
import type { E2eAccount } from '@plitzi/sdk-shared';

export type AccountFormProps = {
  /** The account edited — none for a new one. Its id is kept: the journeys name it by it. */
  account?: E2eAccount;
  /** The other accounts' ids. */
  taken: readonly string[];
  /** The space's visitor roles (`settings.visitorRoles`): the only ones an account may be given. */
  spaceRoles: readonly string[];
  /** Saves it: nothing when it was saved, or why not. */
  onSave: (account: E2eAccount) => Promise<string | undefined>;
  onCancel: () => void;
};

/** One test account written: its id and address, and its roles chosen from the space's own — never typed. */
const AccountForm = ({ account, taken, spaceRoles, onSave, onCancel }: AccountFormProps) => {
  const [draft, setDraft] = useState<AccountDraft>(() => draftOf(account));
  const [problem, setProblem] = useState<string>();
  const [saving, setSaving] = useState(false);
  const offered = spaceRoles.filter(role => !draft.roles.includes(role));

  const handleId = useCallback((id: string) => setDraft(current => ({ ...current, id })), []);
  const handleEmail = useCallback((email: string) => setDraft(current => ({ ...current, email })), []);
  const handleAddRole = useCallback((role: string) => {
    if (role) {
      setDraft(current => ({ ...current, roles: [...current.roles, role] }));
    }
  }, []);
  const handleRemoveRole = useCallback(
    (role: string) => setDraft(current => ({ ...current, roles: current.roles.filter(each => each !== role) })),
    []
  );

  const handleSave = useCallback(async () => {
    const read = accountFrom(draft, taken);
    if ('problem' in read) {
      setProblem(read.problem);

      return;
    }

    setSaving(true);
    const refused = await onSave(read);
    setSaving(false);
    setProblem(refused);
  }, [draft, onSave, taken]);

  const handleSaveClick = useCallback(() => void handleSave(), [handleSave]);

  return (
    <div className="flex flex-col gap-2.5 rounded-md bg-zinc-50 p-3 dark:bg-zinc-800/60">
      <Input
        size="sm"
        name="id"
        label="Id"
        placeholder="editor"
        value={draft.id}
        disabled={account !== undefined}
        onChange={handleId}
      />
      <Input
        size="sm"
        name="email"
        label="Email"
        placeholder="editor@test.invalid"
        value={draft.email}
        onChange={handleEmail}
      />
      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">Roles</span>
        {draft.roles.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {draft.roles.map(role => (
              <RoleChip key={role} role={role} gone={!spaceRoles.includes(role)} onRemove={handleRemoveRole} />
            ))}
          </div>
        )}
        {spaceRoles.length === 0 && (
          <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
            The space declares no visitor roles: the account is signed in with none.
          </p>
        )}
        {offered.length > 0 && (
          <Select size="sm" name="role" aria-label="Add a role" value="" onChange={handleAddRole}>
            <option value="">Add a role…</option>
            {offered.map(role => (
              <option key={role} value={role}>
                {role}
              </option>
            ))}
          </Select>
        )}
      </div>
      {problem && <p className="text-xs text-red-600 dark:text-red-400">{problem}</p>}
      <div className="flex justify-end gap-2">
        <Button size="xs" intent="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button size="xs" disabled={saving} onClick={handleSaveClick}>
          {saving ? 'Saving…' : 'Save'}
        </Button>
      </div>
    </div>
  );
};

export default AccountForm;
