import Button from '@plitzi/plitzi-ui/Button';
import Input from '@plitzi/plitzi-ui/Input';
import { useCallback, useState } from 'react';

import { accountFrom, draftOf } from '../../../../accounts';

import type { AccountDraft } from '../../../../accounts';
import type { E2eAccount } from '@plitzi/sdk-shared';

export type AccountFormProps = {
  /** The account edited — none for a new one. Its id is kept: the journeys name it by it. */
  account?: E2eAccount;
  /** The other accounts' ids. */
  taken: readonly string[];
  /** Saves it: nothing when it was saved, or why not. */
  onSave: (account: E2eAccount) => Promise<string | undefined>;
  onCancel: () => void;
};

/** One test account written: its id, address, roles and permissions — each list as a person types it. */
const AccountForm = ({ account, taken, onSave, onCancel }: AccountFormProps) => {
  const [draft, setDraft] = useState<AccountDraft>(() => draftOf(account));
  const [problem, setProblem] = useState<string>();
  const [saving, setSaving] = useState(false);

  const handleId = useCallback((id: string) => setDraft(current => ({ ...current, id })), []);
  const handleEmail = useCallback((email: string) => setDraft(current => ({ ...current, email })), []);
  const handleRoles = useCallback((roles: string) => setDraft(current => ({ ...current, roles })), []);
  const handlePermissions = useCallback(
    (permissions: string) => setDraft(current => ({ ...current, permissions })),
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
    <div className="flex flex-col gap-2 rounded-md bg-zinc-50 p-2.5 dark:bg-zinc-800/60">
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
      <Input
        size="sm"
        name="roles"
        label="Roles"
        placeholder="editor, viewer"
        value={draft.roles}
        onChange={handleRoles}
      />
      <Input
        size="sm"
        name="permissions"
        label="Permissions"
        placeholder="spaceEdit, spaceView"
        value={draft.permissions}
        onChange={handlePermissions}
      />
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
