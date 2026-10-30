import useStorage from '@plitzi/plitzi-ui/hooks/useStorage';
import Modal, { useModal } from '@plitzi/plitzi-ui/Modal';
import clsx from 'clsx';
import { use, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useBuilderStore } from '@plitzi/sdk-shared/store';
import ViewPage from '@pmodules/App/components/ViewPage';

import E2eRunView from './components/E2eRunView';
import TestsArea from './components/TestsArea';
import TestsSummary from './components/TestsSummary';
import UnitTestForm from './components/UnitTestForm';
import UnitTests from './components/UnitTests';
import { elementOptions, newUnitTest, problemsOfKind, testsNeedingLook, withUnitTest } from './helpers';
import useSpaceTests from './hooks/useSpaceTests';
import useTestProblems from './hooks/useTestProblems';
import TestStudioContext from './studio/TestStudioContext';

import type { UnitTest } from '@plitzi/sdk-shared';
import type { TSpaceRunE2eTestsMutation } from '@plitzi/sdk-shared/network';

type Tab = 'flows' | 'checks';

export type TestsProps = {
  /** The editor's own CSS for the canvas the flows are played on. */
  externalStyle?: string;
};

const TABS: { id: Tab; label: string }[] = [
  { id: 'flows', label: 'Flows' },
  { id: 'checks', label: 'Element checks' }
];

/**
 * The space's own tests (RFC 0031), kept in its document and held where it ships. Its flows — what a visitor does, end
 * to end — beside the page they are played on; its element checks — one element for a state, checked on every save.
 */
const Tests = ({ externalStyle = '' }: TestsProps) => {
  const { answer, isLoading, save, runE2e } = useSpaceTests();
  const studio = use(TestStudioContext);
  // Read here, against the document being edited — as a snapshot reads them.
  const problems = useTestProblems(studio.tests, studio.flow);
  const { enter, leave, load } = studio;
  const { showDialog } = useModal();
  const [flat] = useBuilderStore('schema.flat');
  const [elementSelected] = useBuilderStore('elementSelected');
  // The tab last open, open again after a reload.
  const [storedTab, setTab] = useStorage<Tab>('builder-state.tests.tab', 'flows');
  const tab: Tab = storedTab === 'checks' ? 'checks' : 'flows';
  const [editing, setEditing] = useState<UnitTest>();
  const [serverRun, setServerRun] = useState<TSpaceRunE2eTestsMutation>();
  const [serverRunning, setServerRunning] = useState(false);
  const [viewing, setViewing] = useState<string>();
  const elements = useMemo(() => elementOptions(flat), [flat]);
  const tests = useMemo(() => answer?.tests ?? { unit: [], e2e: [] }, [answer]);
  const unit = useMemo(() => tests.unit ?? [], [tests]);
  const selected =
    typeof elementSelected === 'string' && elementSelected ? elementSelected : (elements[0]?.value ?? '');

  // The area opens on the tests as the document has them, and closes with the view: the canvas, the preview and the
  // author's state put back as they were.
  const entered = useRef(false);
  useEffect(() => {
    if (!answer) {
      return;
    }

    if (entered.current) {
      load(answer.tests);
    } else {
      entered.current = true;
      enter(answer.tests);
    }
  }, [answer, enter, load]);
  useEffect(() => leave, [leave]);

  // What each tab holds that needs a look: the flows' problems on Flows, the element checks' and their misses on theirs.
  const needsLook: Record<Tab, number> = {
    flows: testsNeedingLook(problems, 'e2e').length,
    checks: problemsOfKind(problems, 'unit').length + (answer?.unitFailed ?? 0)
  };
  const handleTab = useCallback((next: Tab) => () => setTab(next), [setTab]);
  const handleRunOnServer = useCallback(async () => {
    setServerRunning(true);
    try {
      setServerRun(await runE2e());
    } finally {
      setServerRunning(false);
    }
  }, [runE2e]);
  const handleSaveUnit = useCallback(
    async (test: UnitTest) => {
      const result = await save(withUnitTest(studio.tests, test, editing?.id ?? test.id));

      return result.ok ? undefined : result.problem;
    },
    [editing, save, studio.tests]
  );
  const handleAddUnit = useCallback(() => setEditing(newUnitTest(selected, unit)), [selected, unit]);
  const handleEditUnit = useCallback((id: string) => setEditing(unit.find(each => each.id === id)), [unit]);
  const handleRemoveUnit = useCallback(
    async (id: string) => {
      const title = unit.find(each => each.id === id)?.title || id;
      const sure = await showDialog(
        <Modal.Header>
          <h4>Remove the check</h4>
        </Modal.Header>,
        <Modal.Body>
          <div className="px-3 py-2">
            <h4>“{title}” stops being checked at the next snapshot. Remove it?</h4>
          </div>
        </Modal.Body>
      );
      if (sure) {
        await save(withUnitTest(studio.tests, undefined, id));
      }
    },
    [save, showDialog, studio.tests, unit]
  );
  const handleBack = useCallback(() => {
    setEditing(undefined);
    setViewing(undefined);
  }, []);

  const viewedResult = viewing ? serverRun?.results.find(result => result.id === viewing) : undefined;
  const viewedFlow = viewing ? studio.tests.e2e?.find(each => each.id === viewing) : undefined;
  if (viewedResult && viewedFlow) {
    return <E2eRunView test={viewedFlow} result={viewedResult} onBack={handleBack} />;
  }

  if (editing) {
    return <UnitTestForm test={editing} elements={elements} onSave={handleSaveUnit} onBack={handleBack} />;
  }

  return (
    <div className="flex min-h-0 grow flex-col">
      <div className="flex h-11 shrink-0 items-end gap-1 border-b border-gray-300 px-4 dark:border-zinc-700">
        {TABS.map(each => (
          <button
            key={each.id}
            type="button"
            role="tab"
            aria-selected={tab === each.id}
            className={clsx(
              'focus-visible:outline-primary-500 -mb-px flex cursor-pointer items-center gap-1.5 border-b-2 px-3 pb-2.5 text-sm transition-colors duration-150 focus-visible:outline-2',
              {
                'border-primary-ui text-primary-text font-medium': tab === each.id,
                'border-transparent text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100':
                  tab !== each.id
              }
            )}
            onClick={handleTab(each.id)}
          >
            {each.label}
            {needsLook[each.id] > 0 && (
              <i
                role="img"
                aria-label={`${String(needsLook[each.id])} to look at`}
                title={
                  needsLook[each.id] === 1
                    ? '1 test here needs a look'
                    : `${String(needsLook[each.id])} tests here need a look`
                }
                className="fa-solid fa-circle-exclamation text-xs text-amber-500"
              />
            )}
          </button>
        ))}
      </div>
      {tab === 'flows' ? (
        <TestsArea
          externalStyle={externalStyle}
          answer={answer}
          problems={problems}
          serverRun={serverRun}
          serverRunning={serverRunning}
          onRunOnServer={handleRunOnServer}
          onViewServerRun={setViewing}
          onChecks={handleTab('checks')}
        />
      ) : (
        <ViewPage
          className="gap-8"
          description="One element in a given situation — shown or hidden, the words it reads, the look it wears — checked in an instant on every save. A snapshot or a publish waits for them, as it waits for the flows."
        >
          {isLoading && <div className="text-sm text-gray-500">Loading…</div>}
          {answer && <TestsSummary answer={answer} problems={problems} />}
          <UnitTests
            tests={unit}
            results={answer?.unit ?? []}
            problems={problems}
            onAdd={handleAddUnit}
            onEdit={handleEditUnit}
            onRemove={handleRemoveUnit}
          />
        </ViewPage>
      )}
    </div>
  );
};

export default Tests;
