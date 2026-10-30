import Modal, { useModal } from '@plitzi/plitzi-ui/Modal';
import { use, useCallback, useEffect, useMemo, useState } from 'react';

import { getPageFullPath } from '@plitzi/sdk-navigation';
import { useBuilderStore } from '@plitzi/sdk-shared/store';
import ViewPage from '@pmodules/App/components/ViewPage';

import E2eRunView from './components/E2eRunView';
import E2eTestForm from './components/E2eTestForm';
import E2eTests from './components/E2eTests';
import TestsSummary from './components/TestsSummary';
import UnitTestForm from './components/UnitTestForm';
import UnitTests from './components/UnitTests';
import { elementOptions, newE2eTest, newUnitTest, stepOf, withE2eTest, withUnitTest } from './helpers';
import useSpaceTests from './hooks/useSpaceTests';
import TestsRecordingContext from './recording/TestsRecordingContext';

import type { E2eTest, UnitTest } from '@plitzi/sdk-shared';
import type { TSpaceRunE2eTestsMutation } from '@plitzi/sdk-shared/network';

type Editing = { kind: 'unit'; test: UnitTest } | { kind: 'e2e'; test: E2eTest } | { kind: 'run'; id: string };

/**
 * The space's own tests (RFC 0031), kept in its document and held where it ships: unit tests — one element resolved
 * for a state, no browser — and e2e tests — a visitor's steps on a page — apart, each listed with how it stands.
 */
const Tests = () => {
  const { answer, isLoading, save, runE2e } = useSpaceTests();
  const [run, setRun] = useState<TSpaceRunE2eTestsMutation>();
  const [running, setRunning] = useState(false);
  const { showDialog } = useModal();
  const [[flat, pageDefinitions, pageFolders, elementSelected]] = useBuilderStore([
    'schema.flat',
    'pageDefinitions',
    'schema.pageFolders',
    'elementSelected'
  ]);
  const [editing, setEditing] = useState<Editing>();
  const { take } = use(TestsRecordingContext);
  // A recording that ended brings its test back to its form, the steps recorded added.
  useEffect(() => {
    const recorded = take();
    if (recorded) {
      setEditing({ kind: 'e2e', test: { ...recorded.test, steps: recorded.rows.map(stepOf) } });
    }
  }, [take]);
  const elements = useMemo(() => elementOptions(flat), [flat]);
  const pages = useMemo(
    () => Object.keys(pageDefinitions).map(id => getPageFullPath(pageDefinitions, pageFolders, id, true)),
    [pageDefinitions, pageFolders]
  );
  const selected =
    typeof elementSelected === 'string' && elementSelected ? elementSelected : (elements[0]?.value ?? '');
  const tests = useMemo(() => answer?.tests ?? { unit: [], e2e: [] }, [answer]);
  const unit = useMemo(() => tests.unit ?? [], [tests]);
  const e2e = useMemo(() => tests.e2e ?? [], [tests]);

  const saved = useCallback(
    async (next: typeof tests) => {
      const result = await save(next);

      return result.ok ? undefined : result.problem;
    },
    [save]
  );
  const handleSaveUnit = useCallback(
    (test: UnitTest) => saved(withUnitTest(tests, test, editing?.kind === 'unit' ? editing.test.id : test.id)),
    [editing, saved, tests]
  );
  const handleSaveE2e = useCallback(
    (test: E2eTest) => saved(withE2eTest(tests, test, editing?.kind === 'e2e' ? editing.test.id : test.id)),
    [editing, saved, tests]
  );
  const handleBack = useCallback(() => setEditing(undefined), []);
  const handleView = useCallback((id: string) => setEditing({ kind: 'run', id }), []);
  const handleRun = useCallback(async () => {
    setRunning(true);
    try {
      const played = await runE2e();
      setRun({ results: played.results, notRun: played.notRun });
    } finally {
      setRunning(false);
    }
  }, [runE2e]);
  const handleAddUnit = useCallback(
    () => setEditing({ kind: 'unit', test: newUnitTest(selected, unit) }),
    [selected, unit]
  );
  const handleAddE2e = useCallback(
    () => setEditing({ kind: 'e2e', test: newE2eTest(pages[0] ?? '/', e2e) }),
    [e2e, pages]
  );
  const handleEditUnit = useCallback(
    (id: string) => {
      const test = unit.find(each => each.id === id);
      if (test) {
        setEditing({ kind: 'unit', test });
      }
    },
    [unit]
  );
  const handleEditE2e = useCallback(
    (id: string) => {
      const test = e2e.find(each => each.id === id);
      if (test) {
        setEditing({ kind: 'e2e', test });
      }
    },
    [e2e]
  );
  const confirmRemove = useCallback(
    (title: string) =>
      showDialog(
        <Modal.Header>
          <h4>Remove the test</h4>
        </Modal.Header>,
        <Modal.Body>
          <div className="px-3 py-2">
            <h4>“{title}” stops being held at the next snapshot. Remove it?</h4>
          </div>
        </Modal.Body>
      ),
    [showDialog]
  );
  const handleRemoveUnit = useCallback(
    async (id: string) => {
      if (await confirmRemove(unit.find(each => each.id === id)?.title || id)) {
        await saved(withUnitTest(tests, undefined, id));
      }
    },
    [confirmRemove, saved, tests, unit]
  );
  const handleRemoveE2e = useCallback(
    async (id: string) => {
      if (await confirmRemove(e2e.find(each => each.id === id)?.title || id)) {
        await saved(withE2eTest(tests, undefined, id));
      }
    },
    [confirmRemove, e2e, saved, tests]
  );

  const viewed = editing?.kind === 'run' ? run?.results.find(result => result.id === editing.id) : undefined;
  const viewedTest = editing?.kind === 'run' ? e2e.find(each => each.id === editing.id) : undefined;
  if (viewed && viewedTest) {
    return <E2eRunView test={viewedTest} result={viewed} onBack={handleBack} />;
  }

  if (editing?.kind === 'unit') {
    return <UnitTestForm test={editing.test} elements={elements} onSave={handleSaveUnit} onBack={handleBack} />;
  }

  if (editing?.kind === 'e2e') {
    return (
      <E2eTestForm
        test={editing.test}
        elements={elements}
        pages={pages}
        elementId={selected}
        onSave={handleSaveE2e}
        onBack={handleBack}
      />
    );
  }

  return (
    <ViewPage
      className="gap-8"
      description="What this space must do, said once and held every time: unit tests on every save, and a snapshot or a publish waits for them all."
    >
      {isLoading && <div className="text-sm text-gray-500">Loading…</div>}
      {answer && <TestsSummary answer={answer} />}
      <UnitTests
        tests={unit}
        results={answer?.unit ?? []}
        onAdd={handleAddUnit}
        onEdit={handleEditUnit}
        onRemove={handleRemoveUnit}
      />
      <E2eTests
        tests={e2e}
        run={run}
        running={running}
        onRun={handleRun}
        onView={handleView}
        onAdd={handleAddE2e}
        onEdit={handleEditE2e}
        onRemove={handleRemoveE2e}
      />
    </ViewPage>
  );
};

export default Tests;
