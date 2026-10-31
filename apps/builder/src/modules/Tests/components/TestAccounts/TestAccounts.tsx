import Button from '@plitzi/plitzi-ui/Button';
import { use, useCallback, useMemo, useState } from 'react';

import { useBuilderStore } from '@plitzi/sdk-shared/store';

import AccountForm from './components/AccountForm';
import AccountRow from './components/AccountRow';
import { playedAs, withAccount } from '../../accounts';
import useMayTest from '../../hooks/useMayTest';
import useSaveSpaceTests from '../../hooks/useSaveSpaceTests';
import TestStudioContext from '../../studio/TestStudioContext';

import type { E2eAccount } from '@plitzi/sdk-shared';

/**
 * The space's test accounts: who a journey plays as, signed in, to see a page for signed-in visitors or a role's view —
 * declared here alone, no account of the platform's. Saved as they are written, with the rest of the tests.
 */
const TestAccounts = () => {
  const { tests, flow, mode, load } = use(TestStudioContext);
  const { mayTest } = useMayTest();
  const [visitorRoles] = useBuilderStore('schema.settings.visitorRoles');
  const spaceRoles = useMemo(() => Object.keys(visitorRoles ?? {}), [visitorRoles]);
  const store = useSaveSpaceTests();
  const [editing, setEditing] = useState<string>();
  const [problem, setProblem] = useState<string>();
  const accounts = useMemo(() => tests.accounts ?? [], [tests.accounts]);
  const locked = mode !== 'idle' || !mayTest;

  const saveAll = useCallback(
    async (next: E2eAccount[]): Promise<string | undefined> => {
      const saved = { ...tests, accounts: next };
      const answer = await store(saved);
      if (!answer.ok) {
        return answer.problem;
      }

      load(saved);
      setEditing(undefined);
      setProblem(undefined);

      return undefined;
    },
    [load, store, tests]
  );

  const handleSave = useCallback((account: E2eAccount) => saveAll(withAccount(accounts, account)), [accounts, saveAll]);
  const handleAdd = useCallback(() => setEditing(''), []);
  const handleCancel = useCallback(() => setEditing(undefined), []);
  const handleRemove = useCallback(
    (id: string) => {
      // A journey that plays as it would play as nobody: said, and kept, until they play as a guest or another.
      const playing = playedAs([...(tests.e2e ?? []), ...(flow ? [flow] : [])], id);
      if (playing.length > 0) {
        setProblem(
          `${playing.join(', ')} ${playing.length === 1 ? 'plays' : 'play'} as ${id}: play it as a guest or another account first.`
        );

        return;
      }

      void saveAll(accounts.filter(each => each.id !== id)).then(setProblem);
    },
    [accounts, flow, saveAll, tests.e2e]
  );

  const editedAccount = accounts.find(each => each.id === editing);
  const taken = accounts.filter(each => each.id !== editing).map(each => each.id);

  return (
    <section
      aria-label="Test accounts"
      className="flex shrink-0 flex-col gap-1.5 rounded-lg border border-gray-300 px-3 py-2.5 dark:border-zinc-700"
    >
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-semibold tracking-wider text-zinc-500 uppercase dark:text-zinc-400">
          Test accounts
        </span>
        {!locked && editing === undefined && (
          <Button size="xs" intent="secondary" iconPlacement="before" className="ml-auto" onClick={handleAdd}>
            <Button.Icon icon="fa-solid fa-plus" />
            Add
          </Button>
        )}
      </div>
      <p className="text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
        Who a journey plays as, signed in, with the space’s visitor roles. No real account: what the page asks the API,
        it asks as a guest.
      </p>
      {accounts.length > 0 && (
        <ul className="divide-y divide-gray-200 dark:divide-zinc-700">
          {accounts.map(account => (
            <AccountRow
              key={account.id}
              account={account}
              spaceRoles={spaceRoles}
              locked={locked}
              onEdit={setEditing}
              onRemove={handleRemove}
            />
          ))}
        </ul>
      )}
      {editing !== undefined && (
        <AccountForm
          key={editing}
          {...(editedAccount ? { account: editedAccount } : {})}
          taken={taken}
          spaceRoles={spaceRoles}
          onSave={handleSave}
          onCancel={handleCancel}
        />
      )}
      {problem && <p className="text-xs text-red-600 dark:text-red-400">{problem}</p>}
    </section>
  );
};

export default TestAccounts;
